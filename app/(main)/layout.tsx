import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { getOrCreateUser } from "@/lib/auth";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  if (!user.onboardingCompleted) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 max-w-[1600px] mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
