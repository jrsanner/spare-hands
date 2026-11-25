export type Slot = { dow: number; start: string; end: string };

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const AVAILABLE_NOW_HOURS = 3;

/** Half-hour options from 5:00 to 23:00 for the editor. */
export const TIME_OPTIONS: string[] = Array.from({ length: (23 - 5) * 2 + 1 }, (_, i) => {
  const mins = 5 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

const toMinutes = (t: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 24 && min < 60 ? h * 60 + min : NaN;
};

/** Mirrors the database rules so the editor can explain problems before saving. */
export function validateSlots(slots: Slot[]): string | null {
  if (slots.length > 28) return "That's too many time blocks. Combine some.";
  for (const s of slots) {
    if (!Number.isInteger(s.dow) || s.dow < 0 || s.dow > 6) return "Pick a day for every time block.";
    const a = toMinutes(s.start);
    const b = toMinutes(s.end);
    if (Number.isNaN(a) || Number.isNaN(b)) return "Pick a start and end time for every block.";
    if (a >= b) return `On ${DAYS[s.dow]}, each block must end after it starts.`;
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const x = slots[i];
      const y = slots[j];
      if (x.dow === y.dow && toMinutes(x.start) < toMinutes(y.end) && toMinutes(y.start) < toMinutes(x.end)) {
        return `On ${DAYS[x.dow]}, two time blocks overlap.`;
      }
    }
  }
  return null;
}

/** "07:00" -> "7:00 AM" */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Clock time in Greensburg, e.g. "3:42 PM". */
export function formatLocalClock(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function isAvailableNow(until: string | null, now: Date = new Date()): boolean {
  return until !== null && new Date(until).getTime() > now.getTime();
}
