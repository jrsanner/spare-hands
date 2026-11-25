"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsPhone } from "@/lib/phone";

const PENDING_PHONE = "sh_pending_phone";

export type FormState = { error?: string };

export async function sendCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Enter a 10-digit US mobile number." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) {
    console.error("signInWithOtp failed", error.status, error.code);
    return {
      error:
        error.status === 429
          ? "Too many codes requested. Wait a minute and try again."
          : "We couldn't send a code to that number. Check it and try again.",
    };
  }

  (await cookies()).set(PENDING_PHONE, phone, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/login",
  });
  redirect("/login/verify");
}

export async function verifyCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const jar = await cookies();
  const phone = jar.get(PENDING_PHONE)?.value;
  if (!phone) redirect("/login");

  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (token.length !== 6) return { error: "Enter the 6-digit code we texted you." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return { error: "That code didn't work or has expired. Try again or get a new code." };

  jar.delete({ name: PENDING_PHONE, path: "/login" });
  redirect("/home");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
