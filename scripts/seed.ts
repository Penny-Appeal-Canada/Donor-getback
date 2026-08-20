/**
 * Seed ~10 fake donors / failed transactions for local UI work.
 *
 *   npm run seed
 *
 * Idempotent: clears previous pi_seed_* / cus_seed_* rows first so re-runs
 * replace demo data without wiping real Stripe backfill.
 */
import "dotenv/config";
import { prisma } from "../lib/db";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

const seeds: Array<{
  donor: {
    stripeCustomerId: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  tx: {
    stripePaymentIntentId: string;
    amount: number;
    currency: string;
    failureCode: string;
    failureMessage: string;
    failedAt: Date;
    status: "NEW" | "CONTACTED" | "RECOVERED" | "CLOSED";
    recoveredAt?: Date;
    recoveredAmount?: number;
    recoveredByPaymentIntentId?: string;
    recoveryMethod?: "SAME_INTENT" | "RECOVERY_LINK" | "DONOR_MATCH";
  };
  contact?: { method: "EMAIL" | "CALL" | "TEXT"; notes: string; createdAt: Date };
}> = [
  {
    donor: {
      stripeCustomerId: "cus_seed_001",
      name: "Zia Yousaf",
      email: "zia.yousaf@pennyappeal.ca",
      phone: "+1-226-201-1834",
    },
    tx: {
      stripePaymentIntentId: "pi_seed_001",
      amount: 5000,
      currency: "cad",
      failureCode: "card_declined",
      failureMessage: "Your card was declined.",
      failedAt: daysAgo(1),
      status: "NEW",
    },
  },
  {
    donor: {
      stripeCustomerId: "cus_seed_002",
      name: "James Okafor",
      email: "james.okafor@example.com",
      phone: "+1-647-555-0102",
    },
    tx: {
      stripePaymentIntentId: "pi_seed_002",
      amount: 10000,
      currency: "cad",
      failureCode: "insufficient_funds",
      failureMessage: "Your card has insufficient funds.",
      failedAt: daysAgo(2),
      status: "NEW",
    },
  },
  {
    donor: {
      stripeCustomerId: "cus_seed_003",
      name: "Priya Sharma",
      email: "priya.sharma@example.com",
      phone: null,
    },
    tx: {
      stripePaymentIntentId: "pi_seed_003",
      amount: 2500,
      currency: "usd",
      failureCode: "expired_card",
      failureMessage: "Your card has expired.",
      failedAt: daysAgo(3),
      status: "NEW",
    },
  },
  {
    donor: {
      stripeCustomerId: "cus_seed_004",
      name: "Marcus Lee",
      email: null,
      phone: "+1-905-555-0104",
    },
    tx: {
      stripePaymentIntentId: "pi_seed_004",
      amount: 7500,
      currency: "cad",
      failureCode: "processing_error",
      failureMessage: "An error occurred while processing your card.",
      failedAt: daysAgo(5),
      status: "NEW",
    },
  },
  {
    donor: {
      stripeCustomerId: "cus_seed_005",
      name: "Sofia Alvarez",
      email: "sofia.alvarez@example.com",
      phone: "+1-416-555-0105",
    },
    tx: {
      stripePaymentIntentId: "pi_seed_005",
      amount: 15000,
      currency: "cad",
      failureCode: "card_declined",
      failureMessage: "Your card was declined.",
      failedAt: daysAgo(4),
      status: "CONTACTED",
    },
    contact: {
      method: "EMAIL",
      notes: "Sent recovery link by email (session cs_seed_demo_005)",
      createdAt: daysAgo(3),
    },
  },
  {
    donor: {
      stripeCustomerId: "cus_seed_006",
      name: "Daniel Chen",
      email: "daniel.chen@example.com",
      phone: "+1-289-555-0106",
    },
    tx: {
      stripePaymentIntentId: "pi_seed_006",
      amount: 3500,
      currency: "usd",
      failureCode: "authentication_required",
      failureMessage: "Your card requires authentication.",
      failedAt: daysAgo(7),
      status: "CONTACTED",
    },
    contact: {
      method: "CALL",
      notes: "Left voicemail about incomplete donation",
      createdAt: daysAgo(6),
    },
  },
  {
    donor: {
      stripeCustomerId: "cus_seed_007",
      name: "Emily Wright",
      email: "emily.wright@example.com",
      phone: "+1-416-555-0107",
    },
    tx: {
      stripePaymentIntentId: "pi_seed_007",
      amount: 20000,
      currency: "cad",
      failureCode: "card_declined",
      failureMessage: "Your card was declined.",
      failedAt: daysAgo(10),
      status: "RECOVERED",
      recoveredAt: daysAgo(8),
      recoveredAmount: 20000,
      recoveredByPaymentIntentId: "pi_seed_007_recovered",
      recoveryMethod: "RECOVERY_LINK",
    },
  },
  {
    donor: {
      stripeCustomerId: "cus_seed_008",
      name: "Noah Patel",
      email: "noah.patel@example.com",
      phone: "+1-647-555-0108",
    },
    tx: {
      stripePaymentIntentId: "pi_seed_008",
      amount: 4500,
      currency: "cad",
      failureCode: "insufficient_funds",
      failureMessage: "Your card has insufficient funds.",
      failedAt: daysAgo(14),
      status: "RECOVERED",
      recoveredAt: daysAgo(12),
      recoveredAmount: 4500,
      recoveredByPaymentIntentId: "pi_seed_008_recovered",
      recoveryMethod: "DONOR_MATCH",
    },
  },
  {
    donor: {
      stripeCustomerId: "cus_seed_009",
      name: "Olivia Brooks",
      email: "olivia.brooks@example.com",
      phone: "+1-905-555-0109",
    },
    tx: {
      stripePaymentIntentId: "pi_seed_009",
      amount: 8000,
      currency: "usd",
      failureCode: "do_not_honor",
      failureMessage: "The bank declined this payment.",
      failedAt: daysAgo(18),
      status: "CLOSED",
    },
  },
  {
    donor: {
      stripeCustomerId: "cus_seed_010",
      name: "Liam Nguyen",
      email: "liam.nguyen@example.com",
      phone: "+1-416-555-0110",
    },
    tx: {
      stripePaymentIntentId: "pi_seed_010",
      amount: 12500,
      currency: "cad",
      failureCode: "generic_decline",
      failureMessage: "Your card was declined for an unknown reason.",
      failedAt: daysAgo(21),
      status: "CLOSED",
    },
  },
];

async function main() {
  const existingTx = await prisma.failedTransaction.findMany({
    where: { stripePaymentIntentId: { startsWith: "pi_seed_" } },
    select: { id: true, donorId: true },
  });

  if (existingTx.length > 0) {
    const txIds = existingTx.map((t) => t.id);
    const donorIds = [...new Set(existingTx.map((t) => t.donorId))];

    await prisma.contactLog.deleteMany({ where: { transactionId: { in: txIds } } });
    await prisma.failedTransaction.deleteMany({ where: { id: { in: txIds } } });
    await prisma.donor.deleteMany({
      where: {
        OR: [{ id: { in: donorIds } }, { stripeCustomerId: { startsWith: "cus_seed_" } }],
      },
    });
    console.log(`Cleared ${existingTx.length} previous seed transaction(s).`);
  }

  for (const row of seeds) {
    const donor = await prisma.donor.create({ data: row.donor });
    const tx = await prisma.failedTransaction.create({
      data: {
        ...row.tx,
        donorId: donor.id,
      },
    });
    if (row.contact) {
      await prisma.contactLog.create({
        data: {
          transactionId: tx.id,
          method: row.contact.method,
          notes: row.contact.notes,
          createdAt: row.contact.createdAt,
        },
      });
    }
  }

  const totals = await prisma.failedTransaction.groupBy({
    by: ["status"],
    where: { stripePaymentIntentId: { startsWith: "pi_seed_" } },
    _count: { _all: true },
  });
  console.log(`Seeded ${seeds.length} failed transactions.`);
  console.table(totals.map((t) => ({ status: t.status, count: t._count._all })));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
