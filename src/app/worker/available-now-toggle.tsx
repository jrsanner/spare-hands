"use client";

import { useActionState } from "react";
import { toggleAvailableNow } from "@/app/actions/worker";
import type { FormState } from "@/app/actions/auth";
import { FormError } from "@/components/ui";

export function AvailableNowToggle({ on, disabled }: { on: boolean; disabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(toggleAvailableNow, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="on" value={on ? "false" : "true"} />
      <button
        type="submit"
        disabled={disabled || pending}
        className={`w-full rounded-lg px-4 py-3 font-medium disabled:opacity-50 ${on ? "border border-stone-300 bg-white text-stone-800" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}
      >
        {pending ? "Saving…" : on ? "Turn off" : "I'm available now"}
      </button>
      <FormError message={state.error} />
    </form>
  );
}
