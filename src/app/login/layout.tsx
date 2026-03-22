import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your OpenHouse workspace with Google, Microsoft, or a one-time email link.",
  alternates: {
    canonical: absoluteUrl("/login"),
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
