import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create an OpenHouse account for AI-native open house operations.",
  alternates: {
    canonical: absoluteUrl("/register"),
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
