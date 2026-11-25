import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Server-only client with the secret key. Bypasses RLS: use only for trusted writes (Stripe sync). */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. See .env.example.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
