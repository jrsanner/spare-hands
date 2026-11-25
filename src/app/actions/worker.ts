"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { workerErrorMessage } from "@/lib/worker-errors";
import { validateSlots, type Slot } from "@/lib/availability";
import { requireWorker } from "@/lib/session";
import { createOnboardingLink, getOrCreateConnectedAccount } from "@/lib/stripe/connect";
import type { FormState } from "./auth";

export type SavedState = FormState & { saved?: boolean };

export async function saveWorkerProfile(_prev: SavedState, formData: FormData): Promise<SavedState> {
  const rateText = String(formData.get("typical_rate") ?? "").trim();
  const rate = rateText === "" ? null : Math.round(Number(rateText) * 100);
  if (rate !== null && !Number.isFinite(rate)) return { error: workerErrorMessage("invalid_rate") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_worker_profile", {
    p_bio: String(formData.get("bio") ?? ""),
    p_categories: formData.getAll("categories").map(String),
    p_service_zips: formData.getAll("service_zips").map(String),
    p_typical_rate_cents: rate,
    p_social_url: String(formData.get("social_url") ?? ""),
  });
  if (error) return { error: workerErrorMessage(error.message) };
  revalidatePath("/worker", "layout");
  return { saved: true };
}

export async function recordWorkerPhoto(path: string): Promise<FormState> {
  const { supabase, worker } = await requireWorker();
  const previous = worker?.photo_path ?? null;
  const { error } = await supabase.rpc("set_worker_photo", { p_path: path });
  if (error) return { error: workerErrorMessage(error.message) };
  if (previous && previous !== path) {
    await supabase.storage.from("worker-photos").remove([previous]);
  }
  revalidatePath("/worker", "layout");
  return {};
}

export async function saveAvailability(_prev: SavedState, formData: FormData): Promise<SavedState> {
  let slots: Slot[];
  try {
    slots = JSON.parse(String(formData.get("slots") ?? "[]"));
  } catch {
    return { error: workerErrorMessage("invalid_slots") };
  }
  const problem = validateSlots(slots);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_weekly_availability", { p_slots: slots });
  if (error) return { error: workerErrorMessage(error.message) };
  revalidatePath("/worker", "layout");
  return { saved: true };
}

export async function toggleAvailableNow(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_available_now", { p_on: formData.get("on") === "true" });
  if (error) return { error: workerErrorMessage(error.message) };
  revalidatePath("/worker", "layout");
  return {};
}

async function origin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function startPayoutSetup(): Promise<void> {
  const { userId, worker } = await requireWorker();
  if (!worker) redirect("/worker/profile");
  const accountId = await getOrCreateConnectedAccount(userId, worker.stripe_account_id);
  redirect(await createOnboardingLink(accountId, await origin()));
}
