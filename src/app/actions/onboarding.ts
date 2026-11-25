"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingErrorMessage } from "@/lib/onboarding-errors";
import type { FormState } from "./auth";

export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const roles = formData.getAll("roles").map(String);
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_full_name: String(formData.get("full_name") ?? ""),
    p_dob: String(formData.get("dob") ?? "") || null,
    p_zip: String(formData.get("zip") ?? "").trim(),
    p_roles: roles,
    p_confirm_adult: formData.get("confirm_adult") === "on",
  });
  if (error) return { error: onboardingErrorMessage(error.message) };
  redirect("/home");
}
