import type Stripe from "stripe";
import { ageOn, MIN_AGE, todayInServiceArea } from "./age";

export type PayoutStatus = "not_started" | "in_progress" | "action_needed" | "enabled";

export type PayoutSync = {
  stripe_details_submitted: boolean;
  payouts_enabled: boolean;
  stripe_individual_is_adult: boolean | null;
};

/** What we store about a connected account. Pure, so it's unit-tested. */
export function payoutSyncFromAccount(account: Stripe.Account, today: string = todayInServiceArea()): PayoutSync {
  const dob = account.individual?.dob;
  let isAdult: boolean | null = null;
  if (dob?.year && dob.month && dob.day) {
    const iso = `${dob.year}-${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`;
    const age = ageOn(iso, today);
    isAdult = age === null ? null : age >= MIN_AGE;
  }
  return {
    stripe_details_submitted: Boolean(account.details_submitted),
    payouts_enabled: Boolean(account.payouts_enabled),
    stripe_individual_is_adult: isAdult,
  };
}

export function payoutStatus(row: {
  stripe_account_id: string | null;
  stripe_details_submitted: boolean;
  payouts_enabled: boolean;
}): PayoutStatus {
  if (!row.stripe_account_id) return "not_started";
  if (row.payouts_enabled) return "enabled";
  if (row.stripe_details_submitted) return "action_needed";
  return "in_progress";
}

export const PAYOUT_STATUS_COPY: Record<PayoutStatus, string> = {
  not_started: "Not set up. You can accept jobs now, but you can't be paid until this is done.",
  in_progress: "Started but not finished. Pick up where you left off.",
  action_needed: "Stripe needs more information before you can be paid.",
  enabled: "Ready. Payments for completed jobs go to your bank account.",
};
