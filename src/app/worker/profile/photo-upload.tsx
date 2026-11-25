"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { recordWorkerPhoto } from "@/app/actions/worker";
import { FormError } from "@/components/ui";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function PhotoUpload({ userId, currentUrl }: { userId: string; currentUrl: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(undefined);
    const ext = TYPES[file.type];
    if (!ext) return setError("Use a JPEG, PNG or WebP photo.");
    if (file.size > MAX_BYTES) return setError("That photo is over 5 MB. Try a smaller one.");

    setBusy(true);
    try {
      const path = `${userId}/photo-${Date.now()}.${ext}`;
      const { error: upErr } = await createBrowserSupabase()
        .storage.from("worker-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) return setError("Upload failed. Check your connection and try again.");
      const res = await recordWorkerPhoto(path);
      if (res.error) return setError(res.error);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={currentUrl} alt="Your profile photo" className="size-20 rounded-full object-cover" />
      ) : (
        <div className="flex size-20 items-center justify-center rounded-full bg-stone-200 text-xs text-stone-500">No photo</div>
      )}
      <div className="space-y-2">
        <label className="inline-block cursor-pointer rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">
          {busy ? "Uploading…" : currentUrl ? "Change photo" : "Add photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onChange} disabled={busy} />
        </label>
        <FormError message={error} />
      </div>
    </div>
  );
}
