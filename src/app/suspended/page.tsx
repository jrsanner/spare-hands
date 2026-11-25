import { requireGate } from "@/lib/session";
import { signOut } from "@/app/actions/auth";

export default async function SuspendedPage() {
  await requireGate("suspended");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Account suspended</h1>
      <p className="text-stone-700">This account can&apos;t be used right now. If you think this is a mistake, contact support.</p>
      <form action={signOut}>
        <button className="text-sm text-stone-600 underline">Sign out</button>
      </form>
    </div>
  );
}
