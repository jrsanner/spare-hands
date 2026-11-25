import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./server";
import { createAdminClient } from "@/lib/supabase/admin";
import { payoutSyncFromAccount } from "@/lib/payouts";

/** Express account for a worker, paid by separate charges + transfers (spec F4). */
export async function getOrCreateConnectedAccount(userId: string, existingId: string | null): Promise<string> {
  if (existingId) return existingId;
  const stripe = getStripe();
  const account = await stripe.accounts.create(
    {
      country: "US",
      business_type: "individual",
      controller: {
        fees: { payer: "application" },
        losses: { payments: "application" },
        requirement_collection: "stripe",
        stripe_dashboard: { type: "express" },
      },
      capabilities: { transfers: { requested: true } },
      business_profile: { product_description: "Small local jobs (snow removal, furniture moving) via Spare Hands" },
      metadata: { spare_hands_user_id: userId },
    },
    { idempotencyKey: `connect-account-${userId}` },
  );

  // Only claim the slot if no other request beat us to it.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("worker_profiles")
    .update({ stripe_account_id: account.id, stripe_synced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("stripe_account_id", null)
    .select("stripe_account_id")
    .maybeSingle();
  if (error) throw error;
  if (data?.stripe_account_id) return data.stripe_account_id;

  const { data: current } = await admin
    .from("worker_profiles")
    .select("stripe_account_id")
    .eq("user_id", userId)
    .single();
  return current!.stripe_account_id as string;
}

export async function createOnboardingLink(accountId: string, origin: string): Promise<string> {
  const link = await getStripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/worker/payouts/refresh`,
    return_url: `${origin}/worker/payouts/return`,
  });
  return link.url;
}

/** Writes Stripe's view of the account to our database. Safe to call repeatedly. */
export async function syncConnectedAccount(account: Stripe.Account): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("worker_profiles")
    .update({ ...payoutSyncFromAccount(account), stripe_synced_at: new Date().toISOString() })
    .eq("stripe_account_id", account.id);
  if (error) throw error;
}

export async function refreshConnectedAccount(accountId: string): Promise<void> {
  await syncConnectedAccount(await getStripe().accounts.retrieve(accountId));
}
