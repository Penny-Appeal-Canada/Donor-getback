import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

// No apiVersion override: the SDK pins its own matching API version.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
