import Link from "next/link";
import { getViewer } from "@/lib/session";

export default async function Landing() {
  const { gate } = await getViewer();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Quick, verified help for small jobs in Greensburg.</h1>
      <p className="text-stone-700">
        Snow shoveled. Furniture loaded. Find a verified neighbor who&apos;s free now, or earn money helping out.
      </p>
      <ul className="space-y-2 text-sm text-stone-700">
        <li>• Every job has payment on hold before anyone is contacted, so you know it&apos;s real.</li>
        <li>• Every helper is phone-verified, and payouts go through Stripe identity checks.</li>
        <li>• Addresses and phone numbers stay private until a job is accepted.</li>
      </ul>
      <Link
        href={gate === "signed_out" ? "/login" : "/home"}
        className="block rounded-lg bg-emerald-700 px-4 py-3 text-center font-medium text-white hover:bg-emerald-800"
      >
        {gate === "signed_out" ? "Get started" : "Go to my account"}
      </Link>
      <p className="text-xs text-stone-500">
        18+ only. <Link href="/terms" className="underline">Terms</Link>
      </p>
    </div>
  );
}
