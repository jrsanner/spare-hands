import Link from "next/link";
import { requireWorker } from "@/lib/session";
import { PAYOUT_STATUS_COPY, payoutStatus } from "@/lib/payouts";
import { startPayoutSetup } from "@/app/actions/worker";

export default async function PayoutsPage() {
  const { worker } = await requireWorker();
  const status = payoutStatus(
    worker ?? { stripe_account_id: null, stripe_details_submitted: false, payouts_enabled: false },
  );
  return (
    <div className="space-y-6">
      <div>
        <Link href="/worker" className="text-sm text-stone-600 underline">← Back</Link>
        <h1 className="mt-2 text-2xl font-semibold">Get paid</h1>
      </div>
      <p className="rounded-lg border border-stone-200 bg-white p-4">{PAYOUT_STATUS_COPY[status]}</p>
      <p className="text-sm text-stone-600">
        Spare Hands uses Stripe to send your earnings to your bank. Stripe will ask for your legal name, date of birth, the
        last 4 digits of your SSN and your bank details, and may ask for a photo ID. Spare Hands never sees your full SSN or
        bank number. Once Stripe confirms you, your profile shows &ldquo;Identity confirmed by Stripe&rdquo;.
      </p>
      {!worker ? (
        <p className="text-sm text-stone-600">
          <Link href="/worker/profile" className="underline">Save your profile</Link> first.
        </p>
      ) : status !== "enabled" ? (
        <form action={startPayoutSetup}>
          <button className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white hover:bg-emerald-800">
            {status === "not_started" ? "Set up payouts with Stripe" : "Continue with Stripe"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
