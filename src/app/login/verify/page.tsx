import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { formatUsPhone } from "@/lib/phone";
import { VerifyForm } from "./verify-form";

export default async function VerifyPage() {
  const phone = (await cookies()).get("sh_pending_phone")?.value;
  if (!phone) redirect("/login");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Enter your code</h1>
      <p className="text-stone-700">We texted a code to {formatUsPhone(phone)}.</p>
      <VerifyForm />
    </div>
  );
}
