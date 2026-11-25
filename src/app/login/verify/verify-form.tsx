"use client";

import { useActionState } from "react";
import Link from "next/link";
import { verifyCode, type FormState } from "@/app/actions/auth";
import { FormError, SubmitButton, inputClass } from "@/components/ui";

export function VerifyForm() {
  const [state, action] = useActionState<FormState, FormData>(verifyCode, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">6-digit code</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          className={`${inputClass} tracking-[0.4em]`}
        />
      </label>
      <FormError message={state.error} />
      <SubmitButton pendingText="Checking…">Verify</SubmitButton>
      <Link href="/login" className="block text-center text-sm text-stone-600 underline">
        Use a different number or resend
      </Link>
    </form>
  );
}
