import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { formatLocalClock, formatTime, isAvailableNow, TIME_OPTIONS, validateSlots } from "@/lib/availability";
import { payoutStatus, payoutSyncFromAccount } from "@/lib/payouts";
import { handleStripeEvent } from "@/lib/stripe/events";
import { workerErrorMessage } from "@/lib/worker-errors";

describe("validateSlots", () => {
  it("accepts empty and back-to-back blocks", () => {
    expect(validateSlots([])).toBeNull();
    expect(validateSlots([{ dow: 1, start: "07:00", end: "09:00" }, { dow: 1, start: "09:00", end: "10:00" }])).toBeNull();
  });
  it("rejects overlap on the same day only", () => {
    expect(validateSlots([{ dow: 1, start: "07:00", end: "10:00" }, { dow: 1, start: "09:00", end: "12:00" }])).toMatch(/overlap/);
    expect(validateSlots([{ dow: 1, start: "07:00", end: "10:00" }, { dow: 2, start: "09:00", end: "12:00" }])).toBeNull();
  });
  it("rejects end before start, bad day, bad time", () => {
    expect(validateSlots([{ dow: 3, start: "10:00", end: "10:00" }])).toMatch(/end after/);
    expect(validateSlots([{ dow: 7, start: "07:00", end: "09:00" }])).toMatch(/day/);
    expect(validateSlots([{ dow: 1, start: "7am", end: "09:00" }])).toMatch(/start and end/);
  });
  it("caps the number of blocks", () => {
    expect(validateSlots(Array.from({ length: 29 }, (_, i) => ({ dow: i % 7, start: "05:00", end: "05:30" })))).toMatch(/too many/);
  });
});

describe("time formatting", () => {
  it("formats 12-hour times", () => {
    expect(formatTime("07:00")).toBe("7:00 AM");
    expect(formatTime("12:30")).toBe("12:30 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("23:00")).toBe("11:00 PM");
  });
  it("offers half-hour options 5 AM to 11 PM", () => {
    expect(TIME_OPTIONS[0]).toBe("05:00");
    expect(TIME_OPTIONS.at(-1)).toBe("23:00");
    expect(TIME_OPTIONS).toHaveLength(37);
  });
  it("shows Greensburg clock time", () => expect(formatLocalClock("2026-11-25T20:42:00Z")).toBe("3:42 PM"));
  it("available now expires", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    expect(isAvailableNow("2026-11-25T12:00:01Z", now)).toBe(true);
    expect(isAvailableNow("2026-11-25T12:00:00Z", now)).toBe(false);
    expect(isAvailableNow(null, now)).toBe(false);
  });
});

const account = (over: Partial<Stripe.Account>): Stripe.Account =>
  ({ id: "acct_1", object: "account", details_submitted: false, payouts_enabled: false, ...over }) as Stripe.Account;

describe("payouts", () => {
  it("maps Stripe account to stored fields, including the 18+ check", () => {
    const adult = account({
      details_submitted: true,
      payouts_enabled: true,
      individual: { dob: { year: 2008, month: 11, day: 25 } } as Stripe.Person,
    });
    expect(payoutSyncFromAccount(adult, "2026-11-25")).toEqual({
      stripe_details_submitted: true,
      payouts_enabled: true,
      stripe_individual_is_adult: true,
    });
    const minor = account({ individual: { dob: { year: 2008, month: 11, day: 26 } } as Stripe.Person });
    expect(payoutSyncFromAccount(minor, "2026-11-25").stripe_individual_is_adult).toBe(false);
    expect(payoutSyncFromAccount(account({}), "2026-11-25").stripe_individual_is_adult).toBeNull();
  });
  it("derives status", () => {
    const base = { stripe_account_id: "acct_1", stripe_details_submitted: false, payouts_enabled: false };
    expect(payoutStatus({ ...base, stripe_account_id: null })).toBe("not_started");
    expect(payoutStatus(base)).toBe("in_progress");
    expect(payoutStatus({ ...base, stripe_details_submitted: true })).toBe("action_needed");
    expect(payoutStatus({ ...base, stripe_details_submitted: true, payouts_enabled: true })).toBe("enabled");
  });
});

describe("handleStripeEvent", () => {
  it("syncs on account.updated and ignores others", async () => {
    const syncAccount = vi.fn().mockResolvedValue(undefined);
    const acct = account({ payouts_enabled: true });
    expect(await handleStripeEvent({ type: "account.updated", data: { object: acct } } as Stripe.Event, { syncAccount })).toBe(true);
    expect(syncAccount).toHaveBeenCalledWith(acct);
    expect(await handleStripeEvent({ type: "charge.succeeded", data: { object: {} } } as Stripe.Event, { syncAccount })).toBe(false);
    expect(syncAccount).toHaveBeenCalledTimes(1);
  });
});

describe("worker error copy", () => {
  it("maps codes", () => expect(workerErrorMessage("profile_incomplete")).toMatch(/Finish your profile/));
});
