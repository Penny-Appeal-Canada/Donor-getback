import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { recordFailedPayment, handleSuccessfulPayment } from "@/lib/recovery";

export const runtime = "nodejs";

/**
 * Stripe webhook endpoint.
 *
 * Events to enable in the Stripe dashboard (or `stripe listen`):
 *   - payment_intent.payment_failed
 *   - payment_intent.succeeded
 *   - checkout.session.completed   (links sessions to PaymentIntents)
 *   - checkout.session.expired     (optional: abandoned checkouts)
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  // Idempotency: Stripe retries deliveries, so skip events we've already
  // processed. This is what keeps recovered totals from double-counting.
  const already = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (already) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await recordFailedPayment(pi);
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handleSuccessfulPayment(pi);
        break;
      }

      case "checkout.session.completed": {
        // Attach the session id to the transaction record when possible,
        // useful for tracing a recovery back to the link we sent.
        const session = event.data.object as Stripe.Checkout.Session;
        const piId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        const recoveryOf = session.metadata?.recovery_of;
        if (piId && recoveryOf) {
          await prisma.failedTransaction.updateMany({
            where: { stripePaymentIntentId: recoveryOf },
            data: { stripeCheckoutSessionId: session.id },
          });
        }
        break;
      }

      case "checkout.session.expired": {
        // A donor who opened checkout and walked away is also a lost donor.
        // If the session had a PaymentIntent that never succeeded, record it.
        const session = event.data.object as Stripe.Checkout.Session;
        const piId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        if (piId) {
          const pi = await stripe.paymentIntents.retrieve(piId);
          if (pi.status !== "succeeded") {
            await recordFailedPayment(pi);
          }
        }
        break;
      }

      default:
        break;
    }

    await prisma.webhookEvent.create({
      data: { id: event.id, type: event.type },
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err);
    // Non-200 makes Stripe retry, and the idempotency table protects us.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
