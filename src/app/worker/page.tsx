import Link from "next/link";
import { requireWorker } from "@/lib/session";
import { isAvailableNow, formatLocalClock } from "@/lib/availability";
import { payoutStatus } from "@/lib/payouts";
import { AvailableNowToggle } from "./available-now-toggle";

function Step({ done, href, title, detail }: { done: boolean; href: string; title: string; detail: string }) {
  return (
    <li>
      <Link href={href} className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-4 hover:border-emerald-700">
        <span
          aria-hidden
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-sm ${done ? "bg-emerald-700 text-white" : "border border-stone-300 text-stone-400"}`}
        >
          {done ? "✓" : ""}
        </span>
        <span>
          <span className="block font-medium">{title}</span>
          <span className="block text-sm text-stone-600">{detail}</span>
        </span>
      </Link>
    </li>
  );
}

export default async function WorkerHome() {
  const { worker, slots } = await requireWorker();
  const hasDetails = Boolean(worker && worker.categories.length && worker.service_zips.length);
  const hasPhoto = Boolean(worker?.photo_path);
  const hasHours = slots.length > 0;
  const complete = hasDetails && hasPhoto && hasHours;
  const payout = payoutStatus(
    worker ?? { stripe_account_id: null, stripe_details_submitted: false, payouts_enabled: false },
  );
  const until = worker?.available_now_until ?? null;
  const availableNow = isAvailableNow(until);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Earn money helping</h1>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium">Available now</h2>
        <p className="mb-3 text-sm text-stone-600">
          {availableNow
            ? `You're showing as available until ${formatLocalClock(until!)}. It turns off by itself.`
            : complete
              ? "Turn this on when you're free in the next few hours. It turns off by itself after 3 hours."
              : "Finish the steps below to go available."}
        </p>
        <AvailableNowToggle on={availableNow} disabled={!complete && !availableNow} />
      </section>

      <ol className="space-y-2">
        <Step done={hasDetails} href="/worker/profile" title="Profile" detail="Job types, area, rate and a short intro" />
        <Step done={hasPhoto} href="/worker/profile#photo" title="Photo" detail="A clear photo of your face" />
        <Step done={hasHours} href="/worker/availability" title="Weekly hours" detail="When you're usually free" />
        <Step
          done={payout === "enabled"}
          href="/worker/payouts"
          title="Get paid"
          detail={payout === "enabled" ? "Payouts ready" : "Set up payouts with Stripe (needed before your first payment)"}
        />
      </ol>
    </div>
  );
}
