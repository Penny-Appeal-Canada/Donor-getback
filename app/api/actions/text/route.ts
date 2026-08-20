import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { money } from "@/lib/format";

export const runtime = "nodejs";

/**
 * POST /api/actions/text  { transactionId }
 *
 * Same idea as the email action, but the recovery link goes out by SMS
 * through Twilio. Requires the donor to have a phone number on file.
 */
export async function POST(req: NextRequest) {
  const { transactionId } = await req.json();

  const tx = await prisma.failedTransaction.findUnique({
    where: { id: transactionId },
    include: { donor: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (!tx.donor.phone) {
    return NextResponse.json({ error: "Donor has no phone number on file" }, { status: 400 });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const orgName = process.env.ORG_NAME ?? "Our Charity";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: tx.donor.stripeCustomerId ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: tx.currency,
          unit_amount: tx.amount,
          product_data: { name: `Donation to ${orgName}` },
        },
      },
    ],
    metadata: { recovery_of: tx.stripePaymentIntentId },
    payment_intent_data: {
      metadata: { recovery_of: tx.stripePaymentIntentId },
    },
    success_url: `${appUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: appUrl,
    expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  });

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER,
    to: tx.donor.phone,
    body: `Hi from ${orgName}! Your ${money(tx.amount, tx.currency)} donation didn't complete. Finish it securely here (link valid 24h): ${session.url}`,
  });

  await prisma.$transaction([
    prisma.contactLog.create({
      data: {
        transactionId: tx.id,
        method: "TEXT",
        notes: `Sent recovery link by SMS (session ${session.id})`,
      },
    }),
    prisma.failedTransaction.update({
      where: { id: tx.id },
      data: {
        status: tx.status === "NEW" ? "CONTACTED" : tx.status,
        stripeCheckoutSessionId: session.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
