/**
 * One-time (or scheduled) backfill of failed payments from Stripe.
 *
 * Webhooks only capture failures from the moment they're configured, so run
 * this once to pull in history:
 *
 *   npx tsx scripts/backfill.ts 90     # last 90 days (default 30)
 *
 * It also replays recent successes so the recovery matcher can link any
 * failures that were later recovered before this app existed.
 */
import "dotenv/config";
import { stripe } from "../lib/stripe";
import { prisma } from "../lib/db";
import { recordFailedPayment, handleSuccessfulPayment } from "../lib/recovery";

async function main() {
  const days = Number(process.argv[2] ?? 30);
  const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  console.log(`Backfilling PaymentIntents from the last ${days} days...`);

  let failed = 0;
  let succeeded = 0;

  // Walk every PaymentIntent in the window. Filtering locally keeps this
  // simple and avoids Search API index lag.
  for await (const pi of stripe.paymentIntents.list({
    created: { gte: since },
    limit: 100,
  })) {
    const hasFailure = !!pi.last_payment_error;
    const isDead =
      pi.status === "requires_payment_method" || pi.status === "canceled";

    if (hasFailure && pi.status !== "succeeded" && isDead) {
      await recordFailedPayment(pi);
      failed++;
    }
  }

  console.log(`Recorded ${failed} failed transactions. Replaying successes...`);

  for await (const pi of stripe.paymentIntents.list({
    created: { gte: since },
    limit: 100,
  })) {
    if (pi.status === "succeeded") {
      await handleSuccessfulPayment(pi);
      succeeded++;
    }
  }

  console.log(`Replayed ${succeeded} successful payments through the matcher.`);

  const totals = await prisma.failedTransaction.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.table(totals.map((t) => ({ status: t.status, count: t._count._all })));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
