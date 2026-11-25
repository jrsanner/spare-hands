import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pathForGate, resolveGate, type Gate } from "@/lib/gate";

export type Profile = {
  id: string;
  phone: string | null;
  full_name: string | null;
  zip: string | null;
  roles: string[];
  is_admin: boolean;
  onboarded_at: string | null;
  suspended_at: string | null;
};

export async function getViewer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  let profile: Profile | null = null;
  if (userId) {
    const res = await supabase
      .from("profiles")
      .select("id, phone, full_name, zip, roles, is_admin, onboarded_at, suspended_at")
      .eq("id", userId)
      .maybeSingle();
    profile = (res.data as Profile | null) ?? null;
  }
  const gate: Gate = resolveGate(userId, profile);
  return { supabase, userId, profile, gate };
}

/** Use at the top of a page: sends the visitor wherever the gate says unless they are allowed here. */
export async function requireGate(allowed: Gate) {
  const viewer = await getViewer();
  if (viewer.gate !== allowed) {
    redirect(pathForGate(viewer.gate) ?? "/home");
  }
  return viewer;
}
