import Stripe from "stripe";
import { prisma } from "./db";
import { stripe } from "./stripe";

/**
 * How many days after a failure a new, unlinked successful payment from the
 * same donor still counts as a "recovery" of that failure.
 */
const RECOVERY_WINDOW_DAYS = 30;

/** Always ignore failures at or above this amount (cents). Card-testing noise. */
const ABSOLUTE_MAX_CENTS = 10_000_000; // $100,000

/**
 * Above this amount (cents), require email or phone — otherwise treat as junk.
 * Real large online gifts almost always leave contact details.
 */
const CONTACT_REQUIRED_ABOVE_CENTS = 1_000_000; // $10,000

/**
 * Skip / auto-close failures that look like fraud or card testing:
 *  - amount >= $100,000, or
 *  - amount > $10,000 with neither email nor phone
 */
export function shouldIgnoreFailedPayment(opts: {
  amount: number;
  email?: string | null;
  phone?: string | null;
}): boolean {
  if (opts.amount >= ABSOLUTE_MAX_CENTS) return true;
  const hasContact = Boolean(opts.email?.trim() || opts.phone?.trim());
  if (opts.amount > CONTACT_REQUIRED_ABOVE_CENTS && !hasContact) return true;
  return false;
}

/** Upsert a donor from whatever identifiers Stripe gives us. */
export async function upsertDonor(opts: {
  stripeCustomerId?: string | null;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}) {
  const { stripeCustomerId, email, name, phone } = opts;

  if (stripeCustomerId) {
    return prisma.donor.upsert({
      where: { stripeCustomerId },
      update: {
        email: email ?? undefined,
        name: name ?? undefined,
        phone: phone ?? undefined,
      },
      create: { stripeCustomerId, email, name, phone },
    });
  }

  if (email) {
    const existing = await prisma.donor.findFirst({ where: { email } });
    if (existing) {
      return prisma.donor.update({
        where: { id: existing.id },
        data: { name: name ?? undefined, phone: phone ?? undefined },
      });
    }
    return prisma.donor.create({ data: { email, name, phone } });
  }

  return prisma.donor.create({ data: { name, phone } });
}

/** Record (or update) a failed PaymentIntent as a recoverable transaction.
 *  Returns null when the failure is filtered out as likely fraud/noise. */
export async function recordFailedPayment(pi: Stripe.PaymentIntent) {
  const customerId =
    typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null;

  // Pull richer contact details when a Customer exists.
  let email = pi.receipt_email ?? null;
  let name: string | null = null;
  let phone: string | null = null;

  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!("deleted" in customer)) {
        email = email ?? customer.email;
        name = customer.name ?? null;
        phone = customer.phone ?? null;
      }
    } catch {
      // Customer lookup is best-effort; the failure record still gets created.
    }
  }

  const err = pi.last_payment_error;
  const billing = err?.payment_method?.billing_details;
  email = email ?? billing?.email ?? null;
  name = name ?? billing?.name ?? null;
  phone = phone ?? billing?.phone ?? null;

  if (shouldIgnoreFailedPayment({ amount: pi.amount, email, phone })) {
    return null;
  }

  const donor = await upsertDonor({ stripeCustomerId: customerId, email, name, phone });

  return prisma.failedTransaction.upsert({
    where: { stripePaymentIntentId: pi.id },
    update: {
      failureCode: err?.code ?? err?.decline_code ?? null,
      failureMessage: err?.message ?? null,
      failedAt: new Date(pi.created * 1000),
    },
    create: {
      stripePaymentIntentId: pi.id,
      donorId: donor.id,
      amount: pi.amount,
      currency: pi.currency,
      failureCode: err?.code ?? err?.decline_code ?? null,
      failureMessage: err?.message ?? null,
      failedAt: new Date(pi.created * 1000),
    },
  });
}

/**
 * Called when a PaymentIntent succeeds. Applies the three recovery rules in
 * order of confidence:
 *
 *  1. SAME_INTENT   – the failed PaymentIntent itself was retried to success.
 *  2. RECOVERY_LINK – the new PaymentIntent carries metadata.recovery_of
 *                     pointing at the failed one (set when we email/text a
 *                     fresh Checkout link). Strongest attribution.
 *  3. DONOR_MATCH   – same donor (customer id or email) donated again within
 *                     RECOVERY_WINDOW_DAYS of an open failure.
 */
export async function handleSuccessfulPayment(pi: Stripe.PaymentIntent) {
  const recoveredAmount = pi.amount_received || pi.amount;
  const now = new Date();

  // Rule 1: same PaymentIntent finally succeeded.
  const same = await prisma.failedTransaction.findUnique({
    where: { stripePaymentIntentId: pi.id },
  });
  if (same) {
    if (same.status !== "RECOVERED") {
      await markRecovered(same.id, pi.id, recoveredAmount, "SAME_INTENT", now);
    }
    return;
  }

  // Rule 2: explicit recovery link (metadata.recovery_of = original PI id).
  const recoveryOf = pi.metadata?.recovery_of;
  if (recoveryOf) {
    const original = await prisma.failedTransaction.findUnique({
      where: { stripePaymentIntentId: recoveryOf },
    });
    if (original && original.status !== "RECOVERED") {
      await markRecovered(original.id, pi.id, recoveredAmount, "RECOVERY_LINK", now);
      return;
    }
  }

  // Rule 3: donor identity match within the recovery window.
  const customerId =
    typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null;
  const email = pi.receipt_email ?? null;

  const donorFilter: object[] = [];
  if (customerId) donorFilter.push({ stripeCustomerId: customerId });
  if (email) donorFilter.push({ email });
  if (donorFilter.length === 0) return;

  const windowStart = new Date(
    now.getTime() - RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const open = await prisma.failedTransaction.findFirst({
    where: {
      status: { in: ["NEW", "CONTACTED"] },
      failedAt: { gte: windowStart },
      donor: { OR: donorFilter },
    },
    orderBy: { failedAt: "asc" }, // recover the oldest open failure first
  });

  if (open) {
    await markRecovered(open.id, pi.id, recoveredAmount, "DONOR_MATCH", now);
  }
}

/**
 * Manual staff override from the dashboard. Unlike the automatic rules
 * above, this trusts staff judgment directly - no Stripe event required.
 * Setting status to RECOVERED requires an amount (so recoveredTotal() stays
 * accurate); moving a transaction to any other status clears prior recovery
 * bookkeeping so a corrected/undone recovery doesn't linger in the totals.
 */
export async function setStatusManually(
  id: string,
  status: "NEW" | "CONTACTED" | "RECOVERED" | "CLOSED",
  recoveredAmountCents?: number
) {
  if (status === "RECOVERED") {
    await prisma.failedTransaction.update({
      where: { id },
      data: {
        status,
        recoveredAt: new Date(),
        recoveredAmount: recoveredAmountCents,
        recoveryMethod: "MANUAL",
        recoveredByPaymentIntentId: null,
      },
    });
    return;
  }

  await prisma.failedTransaction.update({
    where: { id },
    data: {
      status,
      recoveredAt: null,
      recoveredAmount: null,
      recoveryMethod: null,
      recoveredByPaymentIntentId: null,
    },
  });
}

async function markRecovered(
  id: string,
  byPaymentIntentId: string,
  amount: number,
  method: string,
  when: Date
) {
  await prisma.failedTransaction.update({
    where: { id },
    data: {
      status: "RECOVERED",
      recoveredAt: when,
      recoveredAmount: amount,
      recoveredByPaymentIntentId: byPaymentIntentId,
      recoveryMethod: method,
    },
  });
}

/**
 * Total recovered between two dates, computed as a SUM over recoveredAt.
 * Deliberately NOT an incrementing counter: sums are idempotent, survive
 * webhook retries and backfills, and let you query any date range after
 * the fact.
 */
export async function recoveredTotal(start: Date, end: Date) {
  const result = await prisma.failedTransaction.aggregate({
    _sum: { recoveredAmount: true },
    _count: { _all: true },
    where: {
      status: "RECOVERED",
      recoveredAt: { gte: start, lte: end },
    },
  });
  return {
    totalCents: result._sum.recoveredAmount ?? 0,
    count: result._count._all,
  };
}

/**
 * Total still-open value (NEW + CONTACTED) between two dates, computed as a
 * SQL SUM over the full match set - not the paginated table list, which is
 * capped for display and would silently undercount once a range holds more
 * than that cap.
 */
export async function openTotal(start: Date, end: Date) {
  const result = await prisma.failedTransaction.aggregate({
    _sum: { amount: true },
    _count: { _all: true },
    where: {
      status: { in: ["NEW", "CONTACTED"] },
      failedAt: { gte: start, lte: end },
    },
  });
  return {
    totalCents: result._sum.amount ?? 0,
    count: result._count._all,
  };
}
