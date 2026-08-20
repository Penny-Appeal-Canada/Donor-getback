import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { money } from "@/lib/format";

export const runtime = "nodejs";

/**
 * POST /api/actions/email  { transactionId }
 *
 * 1. Creates a fresh Checkout Session for the same amount, tagged with
 *    metadata.recovery_of = the failed PaymentIntent id (this is what lets
 *    the webhook attribute the eventual success back to this failure).
 * 2. Emails the donor the link.
 * 3. Logs the contact and moves the transaction to CONTACTED.
 */
export async function POST(req: NextRequest) {
  const { transactionId } = await req.json();

  const tx = await prisma.failedTransaction.findUnique({
    where: { id: transactionId },
    include: { donor: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (!tx.donor.email) {
    return NextResponse.json({ error: "Donor has no email on file" }, { status: 400 });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const orgName = process.env.ORG_NAME ?? "Our Charity";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: tx.donor.stripeCustomerId ?? undefined,
    customer_email: tx.donor.stripeCustomerId ? undefined : tx.donor.email,
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
    expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h link
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const amountStr = money(tx.amount, tx.currency);
  const firstName = tx.donor.name?.split(" ")[0] ?? "there";

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "donations@example.org",
    to: tx.donor.email,
    subject: `Your ${amountStr} donation to ${orgName} didn't go through`,
    html: `
      <p>Hi ${firstName},</p>
      <p>Thank you for trying to support ${orgName}. It looks like your
      ${amountStr} donation didn't complete at checkout, this happens sometimes
      with card issues or timeouts.</p>
      <p>If you'd still like to give, you can finish your donation securely here:</p>
      <p><a href="${session.url}">Complete my ${amountStr} donation</a></p>
      <p>This link is valid for 24 hours. If you've already donated or changed
      your mind, you can safely ignore this email.</p>
      <p>With gratitude,<br/>${orgName}</p>
    `,
  });

  await prisma.$transaction([
    prisma.contactLog.create({
      data: {
        transactionId: tx.id,
        method: "EMAIL",
        notes: `Sent recovery link (session ${session.id})`,
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

  return NextResponse.json({ ok: true, checkoutUrl: session.url });
}
