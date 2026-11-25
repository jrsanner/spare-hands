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

export type WorkerProfileRow = {
  user_id: string;
  bio: string | null;
  photo_path: string | null;
  categories: string[];
  service_zips: string[];
  typical_rate_cents: number | null;
  social_url: string | null;
  available_now_until: string | null;
  stripe_account_id: string | null;
  stripe_details_submitted: boolean;
  payouts_enabled: boolean;
};

/** Signed-in, onboarded worker plus their worker profile (null until first save). */
export async function requireWorker() {
  const viewer = await requireGate("ok");
  if (!viewer.profile?.roles.includes("worker")) redirect("/home");
  const { data } = await viewer.supabase
    .from("worker_profiles")
    .select(
      "user_id, bio, photo_path, categories, service_zips, typical_rate_cents, social_url, available_now_until, stripe_account_id, stripe_details_submitted, payouts_enabled",
    )
    .eq("user_id", viewer.userId!)
    .maybeSingle();
  const { data: slots } = await viewer.supabase
    .from("availability_slots")
    .select("dow, start_time, end_time")
    .eq("worker_id", viewer.userId!)
    .order("dow")
    .order("start_time");
  return {
    ...viewer,
    userId: viewer.userId!,
    worker: (data as WorkerProfileRow | null) ?? null,
    slots: (slots ?? []).map((s) => ({
      dow: s.dow as number,
      start: String(s.start_time).slice(0, 5),
      end: String(s.end_time).slice(0, 5),
    })),
  };
}
