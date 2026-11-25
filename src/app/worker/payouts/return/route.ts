import { NextResponse, type NextRequest } from "next/server";
import { requireWorker } from "@/lib/session";
import { refreshConnectedAccount } from "@/lib/stripe/connect";

// Stripe sends the worker here after onboarding. Sync now rather than wait for the webhook.
export async function GET(req: NextRequest) {
  const { worker } = await requireWorker();
  if (worker?.stripe_account_id) {
    try {
      await refreshConnectedAccount(worker.stripe_account_id);
    } catch (err) {
      console.error("stripe account refresh failed", err);
    }
  }
  return NextResponse.redirect(new URL("/worker/payouts", req.url));
}
