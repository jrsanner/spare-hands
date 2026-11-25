import { NextResponse, type NextRequest } from "next/server";
import { requireWorker } from "@/lib/session";
import { createOnboardingLink } from "@/lib/stripe/connect";

// Stripe sends the worker here when an onboarding link expired. Make a fresh one.
export async function GET(req: NextRequest) {
  const { worker } = await requireWorker();
  if (!worker?.stripe_account_id) return NextResponse.redirect(new URL("/worker/payouts", req.url));
  const url = await createOnboardingLink(worker.stripe_account_id, new URL(req.url).origin);
  return NextResponse.redirect(url);
}
