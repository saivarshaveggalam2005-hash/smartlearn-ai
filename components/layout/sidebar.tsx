"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  BarChart3,
  Focus,
  FileText,
  Sparkles,
  Menu,
  X,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ClerkUserButton } from "@/components/layout/clerk-user-button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/upload", label: "Upload Syllabus", icon: Upload },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/exam-survival", label: "Exam Survival", icon: Flame },
  { href: "/focus", label: "Focus Mode", icon: Focus },
  { href: "/notes", label: "AI Notes", icon: FileText },
];

function SidebarNav({
  pathname,
  onNavigate,
  showUserButton,
}: {
  pathname: string;
  onNavigate?: () => void;
  showUserButton: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-2 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-bold gradient-text">SmartLearn AI</p>
          <p className="text-xs text-muted-foreground">Adaptive Learning</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-secondary border border-border/50"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <item.icon className="relative h-4 w-4" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {showUserButton ? (
        <div className="border-t border-border p-4">
          <ClerkUserButton />
        </div>
      ) : (
        <div className="border-t border-border p-4 h-[52px]" aria-hidden />
      )}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X /> : <Menu />}
      </Button>

      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card/30 glass h-screen sticky top-0">
        <SidebarNav pathname={pathname} showUserButton={isDesktop === true} />
      </aside>

      {mobileOpen && isDesktop === false && (
        <motion.aside
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          exit={{ x: -280 }}
          className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card glass lg:hidden"
        >
          <SidebarNav
            pathname={pathname}
            showUserButton
            onNavigate={() => setMobileOpen(false)}
          />
        </motion.aside>
      )}
    </>
  );
}
