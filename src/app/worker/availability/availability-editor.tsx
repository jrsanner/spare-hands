"use client";

import { useActionState, useState } from "react";
import { saveAvailability, type SavedState } from "@/app/actions/worker";
import { DAYS, TIME_OPTIONS, formatTime, validateSlots, type Slot } from "@/lib/availability";
import { FormError, SubmitButton } from "@/components/ui";

const selectClass = "rounded-lg border border-stone-300 bg-white px-2 py-2 text-base";

export function AvailabilityEditor({ initial }: { initial: Slot[] }) {
  const [slots, setSlots] = useState<Slot[]>(initial);
  const [state, action] = useActionState<SavedState, FormData>(saveAvailability, {});
  const problem = validateSlots(slots);

  const update = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remove = (i: number) => setSlots((s) => s.filter((_, j) => j !== i));
  const add = (dow: number) => setSlots((s) => [...s, { dow, start: "08:00", end: "12:00" }]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slots" value={JSON.stringify(slots)} />
      {DAYS.map((day, dow) => {
        const rows = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.dow === dow);
        return (
          <section key={day} className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{day}</h2>
              <button type="button" onClick={() => add(dow)} className="text-sm text-emerald-800 underline">
                + Add time
              </button>
            </div>
            {rows.length === 0 && <p className="text-sm text-stone-500">Not available</p>}
            {rows.map(({ s, i }) => (
              <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                <select aria-label={`${day} start`} value={s.start} onChange={(e) => update(i, { start: e.target.value })} className={selectClass}>
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                </select>
                <span className="text-stone-500">to</span>
                <select aria-label={`${day} end`} value={s.end} onChange={(e) => update(i, { end: e.target.value })} className={selectClass}>
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                </select>
                <button type="button" onClick={() => remove(i)} className="text-sm text-stone-600 underline">
                  Remove
                </button>
              </div>
            ))}
          </section>
        );
      })}
      <FormError message={problem ?? state.error} />
      {state.saved && !state.error && !problem && <p className="text-sm text-emerald-800">Saved.</p>}
      <SubmitButton pendingText="Saving…">Save weekly hours</SubmitButton>
    </form>
  );
}
