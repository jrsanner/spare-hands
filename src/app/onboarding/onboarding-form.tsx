"use client";

import { useActionState } from "react";
import { completeOnboarding } from "@/app/actions/onboarding";
import type { FormState } from "@/app/actions/auth";
import { FormError, SubmitButton, inputClass } from "@/components/ui";

export function OnboardingForm({ maxDob }: { maxDob: string }) {
  const [state, action] = useActionState<FormState, FormData>(completeOnboarding, {});
  return (
    <form action={action} className="space-y-5">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Your name</span>
        <input name="full_name" autoComplete="name" required maxLength={80} className={inputClass} />
        <span className="text-xs text-stone-500">Others see your first name and last initial.</span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Date of birth</span>
        <input name="dob" type="date" max={maxDob} required className={inputClass} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Home zip code</span>
        <input
          name="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="[0-9]{5}"
          maxLength={5}
          required
          className={inputClass}
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What do you want to do? (pick one or both)</legend>
        <label className="flex items-center gap-3 rounded-lg border border-stone-300 bg-white px-3 py-3">
          <input type="checkbox" name="roles" value="poster" className="size-5" />
          <span>Get help with jobs</span>
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-stone-300 bg-white px-3 py-3">
          <input type="checkbox" name="roles" value="worker" className="size-5" />
          <span>Earn money helping</span>
        </label>
      </fieldset>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="confirm_adult" required className="mt-1 size-5" />
        <span className="text-sm">
          I confirm I am 18 or older and agree to the <a href="/terms" className="underline">terms</a>.
        </span>
      </label>

      <FormError message={state.error} />
      <SubmitButton pendingText="Saving…">Continue</SubmitButton>
    </form>
  );
}
