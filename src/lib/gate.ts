export type ProfileGateFields = {
  onboarded_at: string | null;
  suspended_at: string | null;
};

export type Gate = "signed_out" | "suspended" | "needs_onboarding" | "ok";

/** Where a request may go. The database enforces the same rules; this decides what to show. */
export function resolveGate(userId: string | null, profile: ProfileGateFields | null): Gate {
  if (!userId) return "signed_out";
  if (profile?.suspended_at) return "suspended";
  if (!profile?.onboarded_at) return "needs_onboarding";
  return "ok";
}

export function pathForGate(gate: Gate): string | null {
  switch (gate) {
    case "signed_out":
      return "/login";
    case "suspended":
      return "/suspended";
    case "needs_onboarding":
      return "/onboarding";
    case "ok":
      return null;
  }
}
