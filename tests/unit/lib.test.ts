import { describe, expect, it } from "vitest";
import { formatUsPhone, normalizeUsPhone } from "@/lib/phone";
import { ageOn, todayInServiceArea } from "@/lib/age";
import { pathForGate, resolveGate } from "@/lib/gate";
import { onboardingErrorMessage } from "@/lib/onboarding-errors";

describe("normalizeUsPhone", () => {
  it.each([
    ["(724) 555-0123", "+17245550123"],
    ["724.555.0123", "+17245550123"],
    ["1 724 555 0123", "+17245550123"],
    ["+1 (724) 555-0123", "+17245550123"],
  ])("%s -> %s", (input, out) => expect(normalizeUsPhone(input)).toBe(out));

  it.each(["555-0123", "024 555 0123", "724 055 0123", "2 724 555 0123", "", "abc"])("rejects %s", (input) =>
    expect(normalizeUsPhone(input)).toBeNull(),
  );

  it("formats for display", () => expect(formatUsPhone("+17245550123")).toBe("(724) 555-0123"));
});

describe("ageOn", () => {
  it("counts birthdays exactly", () => {
    expect(ageOn("2008-11-25", "2026-11-25")).toBe(18);
    expect(ageOn("2008-11-26", "2026-11-25")).toBe(17);
    expect(ageOn("2008-12-01", "2026-11-25")).toBe(17);
  });
  it("rejects impossible dates", () => {
    expect(ageOn("2008-02-30", "2026-11-25")).toBeNull();
    expect(ageOn("not-a-date", "2026-11-25")).toBeNull();
  });
  it("uses Eastern time for today", () => {
    // 03:00 UTC on Nov 25 is still Nov 24 in Greensburg.
    expect(todayInServiceArea(new Date("2026-11-25T03:00:00Z"))).toBe("2026-11-24");
    expect(todayInServiceArea(new Date("2026-11-25T06:00:00Z"))).toBe("2026-11-25");
  });
});

describe("gate", () => {
  const done = { onboarded_at: "2026-11-25T00:00:00Z", suspended_at: null };
  it("signed out goes to login", () => expect(pathForGate(resolveGate(null, null))).toBe("/login"));
  it("new user goes to onboarding", () =>
    expect(resolveGate("u1", { onboarded_at: null, suspended_at: null })).toBe("needs_onboarding"));
  it("missing profile goes to onboarding", () => expect(resolveGate("u1", null)).toBe("needs_onboarding"));
  it("suspended wins over onboarded", () =>
    expect(resolveGate("u1", { ...done, suspended_at: "2026-11-25T00:00:00Z" })).toBe("suspended"));
  it("onboarded user is ok", () => expect(pathForGate(resolveGate("u1", done))).toBeNull());
});

describe("onboarding error copy", () => {
  it("maps DB codes", () => expect(onboardingErrorMessage("under_18")).toMatch(/18 and older/));
  it("falls back for unknown errors", () => expect(onboardingErrorMessage("boom")).toMatch(/try again/i));
});
