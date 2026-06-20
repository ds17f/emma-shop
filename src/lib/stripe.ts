import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

// Instantiated lazily so the app can build/run without keys until checkout is used.
export const stripe = key ? new Stripe(key) : null;

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.",
    );
  }
  return stripe;
}
