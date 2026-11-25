"use client";

import { useActionState } from "react";
import { saveWorkerProfile, type SavedState } from "@/app/actions/worker";
import { FormError, SubmitButton, inputClass } from "@/components/ui";

type Props = {
  categories: { key: string; label: string }[];
  zips: { zip: string; town: string }[];
  initial: { bio: string; categories: string[]; service_zips: string[]; typical_rate: string; social_url: string };
};

export function ProfileForm({ categories, zips, initial }: Props) {
  const [state, action] = useActionState<SavedState, FormData>(saveWorkerProfile, {});
  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Jobs you&apos;ll do</legend>
        {categories.map((c) => (
          <label key={c.key} className="flex items-center gap-3 rounded-lg border border-stone-300 bg-white px-3 py-3">
            <input type="checkbox" name="categories" value={c.key} defaultChecked={initial.categories.includes(c.key)} className="size-5" />
            <span>{c.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Areas you&apos;ll work in</legend>
        {zips.map((z) => (
          <label key={z.zip} className="flex items-center gap-3 rounded-lg border border-stone-300 bg-white px-3 py-3">
            <input type="checkbox" name="service_zips" value={z.zip} defaultChecked={initial.service_zips.includes(z.zip)} className="size-5" />
            <span>{z.town} ({z.zip})</span>
          </label>
        ))}
      </fieldset>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Typical rate per job (optional)</span>
        <div className="flex items-center gap-2">
          <span className="text-stone-500">$</span>
          <input name="typical_rate" inputMode="decimal" defaultValue={initial.typical_rate} placeholder="40" className={inputClass} />
        </div>
        <span className="text-xs text-stone-500">A guide for posters. The poster sets the price on each job.</span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Short intro (optional)</span>
        <textarea name="bio" rows={3} maxLength={500} defaultValue={initial.bio} className={inputClass} placeholder="I have my own shovel and a pickup truck." />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Social profile link (optional)</span>
        <input name="social_url" type="url" defaultValue={initial.social_url} placeholder="https://facebook.com/you" className={inputClass} />
        <span className="text-xs text-stone-500">Adds a badge. Posters can see the link.</span>
      </label>

      <FormError message={state.error} />
      {state.saved && !state.error && <p className="text-sm text-emerald-800">Saved.</p>}
      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}
