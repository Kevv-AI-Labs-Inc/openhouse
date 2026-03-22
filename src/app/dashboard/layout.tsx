import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard-shell";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Private OpenHouse control center for events, leads, analytics, and account settings.",
  alternates: {
    canonical: absoluteUrl("/dashboard"),
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nosnippet: true,
      noarchive: true,
    },
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
