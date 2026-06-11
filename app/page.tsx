import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import {
  Sparkles,
  Brain,
  Target,
  Zap,
  ArrowRight,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { userId } = await auth();
    if (userId) redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(262_83%_58%_/_0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(217_91%_60%_/_0.1),transparent_50%)]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text">SmartLearn AI</span>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button variant="gradient" asChild>
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-8">
            <Zap className="h-4 w-4" />
            AI-Powered Adaptive Learning
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-tight">
            Learn smarter with{" "}
            <span className="gradient-text">SmartLearn AI</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your syllabus, extract topics automatically, get personalized
            study plans, and master every subject with your AI tutor.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="gradient" asChild className="text-base">
              <Link href="/sign-up">
                Start Learning Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/sign-in">Sign in to continue</Link>
            </Button>
          </div>
        </div>

        <div className="mt-32 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: BookOpen,
              title: "Syllabus Extraction",
              desc: "Upload PDFs and auto-extract topics with AI",
            },
            {
              icon: Brain,
              title: "AI Tutor",
              desc: "Interactive explanations during study sessions",
            },
            {
              icon: Target,
              title: "Adaptive Plans",
              desc: "Personalized schedules based on your goals",
            },
            {
              icon: BarChart3,
              title: "Progress Analytics",
              desc: "Track streaks, weak areas, and performance",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-6 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="rounded-lg bg-primary/10 p-3 w-fit mb-4">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
