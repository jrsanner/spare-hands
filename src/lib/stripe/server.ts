import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY. See .env.example.");
    client = new Stripe(key, { appInfo: { name: "Spare Hands" } });
  }
  return client;
}
