"use client";

import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";

/**
 * Clerk UserButton must render only on the client to avoid hydration mismatches.
 */
export function ClerkUserButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="h-8 w-8 rounded-full bg-secondary/80 animate-pulse"
        aria-hidden
      />
    );
  }

  return <UserButton afterSignOutUrl="/" />;
}
