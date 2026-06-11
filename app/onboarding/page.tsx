import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default async function OnboardingPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  if (user.onboardingCompleted) redirect("/dashboard");

  return <OnboardingForm userName={user.name} />;
}
