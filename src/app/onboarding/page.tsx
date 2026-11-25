import { requireGate } from "@/lib/session";
import { todayInServiceArea } from "@/lib/age";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  await requireGate("needs_onboarding");
  const today = todayInServiceArea();
  const maxDob = `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Set up your account</h1>
      <OnboardingForm maxDob={maxDob} />
    </div>
  );
}
