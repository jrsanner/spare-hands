import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { gate } = await getViewer();
  if (gate !== "signed_out") redirect("/home");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sign in or create an account</h1>
      <LoginForm />
    </div>
  );
}
