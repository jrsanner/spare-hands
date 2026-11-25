import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { handleStripeEvent } from "@/lib/stripe/events";
import { syncConnectedAccount } from "@/lib/stripe/connect";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const body = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event, { syncAccount: syncConnectedAccount });
  } catch (err) {
    console.error("stripe webhook handling failed", event.type, event.id, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 }); // Stripe retries
  }
  return NextResponse.json({ received: true });
}
