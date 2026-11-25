import { requireGate } from "@/lib/session";
import { signOut } from "@/app/actions/auth";
import { formatUsPhone } from "@/lib/phone";

export default async function HomePage() {
  const { profile } = await requireGate("ok");
  const roles = profile?.roles ?? [];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Hi, {profile?.full_name?.split(" ")[0]}</h1>
      <div className="space-y-3">
        {roles.includes("poster") && (
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="font-medium">Get help</h2>
            <p className="text-sm text-stone-600">Browsing helpers and posting jobs is coming next.</p>
          </section>
        )}
        {roles.includes("worker") && (
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="font-medium">Earn money</h2>
            <p className="text-sm text-stone-600">Your helper profile and availability are coming next.</p>
          </section>
        )}
      </div>
      <p className="text-sm text-stone-500">
        Signed in as {profile?.phone ? formatUsPhone(profile.phone) : "unknown"}
        {profile?.is_admin ? " · admin" : ""}
      </p>
      <form action={signOut}>
        <button className="text-sm text-stone-600 underline">Sign out</button>
      </form>
    </div>
  );
}
