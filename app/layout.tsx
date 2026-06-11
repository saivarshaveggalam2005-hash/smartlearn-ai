import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartLearn AI — Adaptive Learning Platform",
  description:
    "AI-powered adaptive learning with syllabus extraction, personalized study plans, and interactive tutoring.",
};

export const dynamic = "force-dynamic";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const body = (
    <body
      className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
    >
      {children}
      <Toaster theme="dark" position="top-right" richColors />
    </body>
  );

  return (
    <html lang="en" className="dark">
      {clerkPublishableKey ? (
        <ClerkProvider publishableKey={clerkPublishableKey} appearance={clerkAppearance}>
          {body}
        </ClerkProvider>
      ) : (
        body
      )}
    </html>
  );
}
