"use client";

import { useActionState } from "react";
import { sendCode, type FormState } from "@/app/actions/auth";
import { FormError, SubmitButton, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(sendCode, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Mobile number</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(724) 555-0123"
          required
          className={inputClass}
        />
      </label>
      <FormError message={state.error} />
      <SubmitButton pendingText="Sending code…">Text me a code</SubmitButton>
      <p className="text-xs text-stone-500">We&apos;ll text you a 6-digit code. Message and data rates may apply.</p>
    </form>
  );
}
