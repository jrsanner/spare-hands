import Link from "next/link";
import { requireWorker } from "@/lib/session";
import { AvailabilityEditor } from "./availability-editor";

export default async function AvailabilityPage() {
  const { worker, slots } = await requireWorker();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/worker" className="text-sm text-stone-600 underline">← Back</Link>
        <h1 className="mt-2 text-2xl font-semibold">Weekly hours</h1>
        <p className="text-sm text-stone-600">
          When you&apos;re usually free, in Greensburg time. Posters with a card on file can see these. For right-now jobs, use
          &ldquo;I&apos;m available now&rdquo;.
        </p>
      </div>
      {worker ? (
        <AvailabilityEditor initial={slots} />
      ) : (
        <p className="text-sm text-stone-600">
          <Link href="/worker/profile" className="underline">Save your profile</Link> first.
        </p>
      )}
    </div>
  );
}
