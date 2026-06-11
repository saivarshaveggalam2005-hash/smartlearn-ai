import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="relative w-full max-w-2xl">{children}</div>
      </div>
    );
  }

  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(262_83%_58%_/_0.1),transparent_50%)]" />
      <div className="relative w-full max-w-2xl">{children}</div>
    </div>
  );
}
