"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicTrustFooter } from "@/components/public-trust-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-lockup";
import { requestNewEventDialog } from "@/lib/new-event-trigger";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Brain,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";

/* ───────────────────── Data ───────────────────── */

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#workflow", label: "Workflow" },
  { href: "#audience", label: "Who it's for" },
  { href: "#pricing", label: "Pricing" },
];

const HERO_STATS = [
  { value: "1 link", label: "for the open house, buyer agents, and long-tail inquiries" },
  { value: "MLS-first", label: "imports become a polished share page in minutes" },
  { value: "Seller-ready", label: "reporting separates live traffic from later demand" },
];

const PRODUCT_PILLARS = [
  {
    id: "01",
    title: "Launch from listing data",
    description:
      "Import by MLS, address, or flyer and turn one listing record into the source for the public page, kiosk flow, and AI context.",
    icon: Building2,
  },
  {
    id: "02",
    title: "One reusable public link",
    description:
      "Use the same branded share page for the live open house, QR handouts, buyer agents, and post-event listing inquiries without spinning up new forms.",
    icon: CalendarDays,
  },
  {
    id: "03",
    title: "AI after sign-in, not before",
    description:
      "Property Q&A, lead scoring, and follow-up generation sit on top of the capture flow so agents collect real contact details first, then open a richer conversation automatically.",
    icon: Brain,
  },
  {
    id: "04",
    title: "Seller-ready attribution",
    description:
      "Show sellers how many people came through, which leads ran hottest, and how much demand came from the event versus later listing inquiries.",
    icon: BarChart3,
  },
];

const WORKFLOW_STEPS = [
  {
    step: "Step 1",
    title: "Import and clean the listing",
    description:
      "Pull in MLS, address, or flyer details, then make fast edits so the share page and report start from the same listing record.",
    icon: Building2,
  },
  {
    step: "Step 2",
    title: "Publish one link everywhere",
    description:
      "Turn the listing into a branded mobile page, QR sign-in, and kiosk experience that still works after the weekend.",
    icon: CalendarDays,
  },
  {
    step: "Step 3",
    title: "Capture, qualify, and report",
    description:
      "Pro scores the lead from behavior, opens property Q&A right after sign-in, drafts follow-up so agents do not miss the next touch, and packages everything into seller-facing attribution.",
    icon: FileCheck2,
  },
];

const DIFFERENTIATORS = [
  {
    title: "This is not just a sign-in form.",
    description:
      "Typical tools stop at name, phone, email. OpenHouse starts there, then keeps the same listing link alive for post-event traffic and buyer-agent sharing.",
    icon: UserCheck,
    bullets: [
      "One public URL for live visitors and off-site inquiry",
      "QR, kiosk, and share-page experience from the same event record",
    ],
  },
  {
    title: "The $29 layer is automation and attribution.",
    description:
      "Free lets agents launch listings and prove the workflow. Pro is where seller reporting, AI qualification, and reliable follow-up compound into a real business case.",
    icon: Sparkles,
    bullets: [
      "Seller report proves how many leads came in and who ran hottest",
      "AI Q&A opens immediately after sign-in to increase engagement and qualification",
    ],
  },
  {
    title: "MLS import becomes a better public experience.",
    description:
      "Imported data is cleaned into a listing-first share page instead of dumping raw remarks. That makes the public page more credible and more printable for real-world use.",
    icon: MessageSquareText,
    bullets: [
      "Polished headline, summary, highlights, and images",
      "Better context for follow-up, Q&A, and seller updates",
    ],
  },
];

const SCRIPT_PREVIEWS = [
  {
    key: "hot",
    label: "Hot lead workflow",
    note: "For immediate callback windows",
    title: "Priority queue with urgency-first actions",
    body: "OpenHouse marks buyer readiness + urgency signals, then recommends a same-hour outreach path with talking points tailored to intent and profile confidence.",
    tags: ["Score 82", "Tier: HOT", "Follow-up: 1 hour"],
  },
  {
    key: "warm",
    label: "Warm lead workflow",
    note: "For 24-hour nurture cadence",
    title: "Structured next-day conversion flow",
    body: "Warm leads receive a suggested email draft with property context, timeline hints, and a low-friction CTA for scheduling the next conversation.",
    tags: ["Score 56", "Tier: WARM", "Follow-up: 24 hours"],
  },
  {
    key: "cold",
    label: "Cold lead workflow",
    note: "For long-cycle relationship building",
    title: "Low-pressure, list-building automation",
    body: "Lower-intent visitors are tagged for long-cycle nurture with AI-assisted copy focused on education, market trust, and opt-in engagement.",
    tags: ["Score 28", "Tier: COLD", "Follow-up: Drip"],
  },
];

const AUDIENCE = [
  {
    role: "Solo agent",
    title: "Needs consistency more than complexity",
    description:
      "For agents who need a dependable event-to-follow-up system without adding an operations headcount.",
  },
  {
    role: "Team lead",
    title: "Needs repeatable lead standards",
    description:
      "For teams that want every open house to follow the same capture, scoring, and reporting playbook.",
  },
  {
    role: "Brokerage ops",
    title: "Needs visibility and control",
    description:
      "For operators who need QA-friendly workflows, export controls, and performance transparency across events.",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    summary: "Best for agents proving the workflow first. Your first 3 published launches include Pro features.",
    features: [
      "Unlimited listing launches",
      "150 sign-ins / month",
      "First 3 published launches include Pro features",
      "MLS, address, or flyer import",
      "Branded share page, QR, and kiosk mode",
      "Seller report preview + CSV export",
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    summary: "Built for teams that want automation, seller attribution, and long-tail listing demand in one loop.",
    features: [
      "Unlimited sign-ins and AI workflows",
      "Behavior-based lead scoring + next-step recommendations",
      "Unlimited sign-in-gated property Q&A with auto handoff after sign-in",
      "Automatic follow-up drafts and agent-owned mailbox send",
      "Verified brokerage domain relay for Pro teams",
      "Reusable listing inquiry links with on-site vs later-demand attribution",
      "Detailed seller reporting that shows total traffic and hottest buyers",
    ],
    cta: "Start Pro",
    highlighted: true,
  },
];

const PRICING_MATRIX = [
  { capability: "Listing launches", free: "Unlimited", pro: "Unlimited" },
  { capability: "Monthly captures", free: "150 / month", pro: "Unlimited" },
  { capability: "Included Pro launch trial", free: "First 3 published launches", pro: "Built in on every launch" },
  { capability: "MLS, address, or flyer import", free: "Included", pro: "Included" },
  { capability: "Branded share page, QR, and kiosk", free: "Included", pro: "Included" },
  { capability: "Reusable long-tail inquiry link", free: "Included", pro: "Included + attribution" },
  { capability: "Seller report", free: "Preview + CSV, plus trial access on first 3 launches", pro: "Traffic totals, hot-lead proof, and share kit" },
  { capability: "AI lead scoring", free: "First 3 published launches", pro: "Included" },
  { capability: "Property Q&A after sign-in", free: "First 3 published launches", pro: "Unlimited + auto-open after sign-in" },
  { capability: "AI follow-up", free: "First 3 published launches", pro: "Included so agents do not miss the next touch" },
  { capability: "Google or Microsoft mailbox send", free: "First 3 published launches", pro: "Included" },
  { capability: "Verified brokerage sending domain", free: "—", pro: "Included" },
];

const FAQ = [
  {
    q: "Can I run this at an in-person open house without a separate app?",
    a: "Yes. Visitors can sign in through mobile web or kiosk mode using a QR link.",
  },
  {
    q: "Do I need Pro to score leads?",
    a: "Free covers listing launches, branded pages, QR capture, and seller-report basics. Your first 3 published launches also include Pro features so you can trial AI scoring, sign-in-gated property Q&A, and AI follow-up before upgrading.",
  },
  {
    q: "Can the same link keep working after the open house ends?",
    a: "Yes. OpenHouse links stay reusable so agents can keep sharing them with buyer agents and off-site prospects, then separate those captures in the seller report.",
  },
  {
    q: "Does the platform replace legal or compliance review?",
    a: "No. OpenHouse accelerates drafts and prioritization. Agents should review outbound content before publishing.",
  },
];

/* ───────────────────── Component ───────────────────── */

type LandingPageProps = {
  isAuthenticated?: boolean;
};

export default function LandingPage({ isAuthenticated = false }: LandingPageProps) {
  const [activePreview, setActivePreview] = useState("hot");
  const router = useRouter();

  const authCtaHref = isAuthenticated ? "/dashboard" : "/login";
  const primaryCtaLabel = isAuthenticated ? "Launch your next listing" : "Launch your first listing link";
  const navPrimaryLabel = isAuthenticated ? "New Open House" : "Start Free";
  const navSecondaryLabel = isAuthenticated ? "Dashboard" : "Sign In";

  const handleAuthenticatedLaunchClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    requestNewEventDialog();
    router.push("/dashboard/events");
  };

  const selectedPreview = useMemo(
    () => SCRIPT_PREVIEWS.find((item) => item.key === activePreview) ?? SCRIPT_PREVIEWS[0],
    [activePreview]
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ── Ambient glow ── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-18rem] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-emerald-300/12 blur-[140px]" />
        <div className="absolute right-[-8rem] top-[22rem] h-[26rem] w-[26rem] rounded-full bg-teal-300/10 blur-[120px]" />
        <div className="absolute left-[-6rem] top-[42rem] h-[22rem] w-[22rem] rounded-full bg-emerald-200/8 blur-[100px]" />
      </div>

      {/* ═══════════════════════════════════════════════
          Floating pill navbar
         ═══════════════════════════════════════════════ */}
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
        <div className="floating-nav flex h-14 w-full max-w-4xl items-center justify-between rounded-full border border-border/50 px-2 shadow-lg shadow-black/[0.03]">
          <Link href="/" className="inline-flex items-center gap-2.5 pl-2">
            <BrandLockup compact />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 pr-1">
            <Link href={authCtaHref}>
              <Button variant="ghost" size="sm" className="rounded-full text-[13px] font-medium">
                {navSecondaryLabel}
              </Button>
            </Link>
            {isAuthenticated ? (
              <Button
                size="sm"
                className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 text-[13px] font-medium text-white shadow-sm hover:from-emerald-600 hover:to-teal-700"
                onClick={handleAuthenticatedLaunchClick}
              >
                {navPrimaryLabel}
              </Button>
            ) : (
              <Link href="/login?mode=new">
                <Button
                  size="sm"
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 text-[13px] font-medium text-white shadow-sm hover:from-emerald-600 hover:to-teal-700"
                >
                  {navPrimaryLabel}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="pt-24">
        {/* ═══════════════════════════════════════════════
            Hero
           ═══════════════════════════════════════════════ */}
        <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-12 md:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-14 lg:pb-32 lg:pt-20">
          <div>
            <Badge
              className="mb-6 rounded-full border-emerald-500/25 bg-emerald-500/8 px-3.5 py-1 text-emerald-700 hero-enter"
              style={{ animationDelay: "0ms" }}
            >
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              For North American real estate teams
            </Badge>
            <h1
              className="font-display max-w-3xl text-[2.75rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem] hero-enter"
              style={{ animationDelay: "90ms" }}
            >
              Import the listing once. Use one branded link for the open house, the buyer agent, and the seller report.
            </h1>
            <p
              className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg hero-enter"
              style={{ animationDelay: "190ms" }}
            >
              OpenHouse starts with MLS, address, or flyer import, turns it into a polished share page,
              captures sign-ins and long-tail inquiries, then packages the demand story back into seller-ready reporting.
            </p>

            <div
              className="mt-8 flex flex-wrap items-center gap-3 hero-enter"
              style={{ animationDelay: "280ms" }}
            >
              {isAuthenticated ? (
                <Button
                  size="lg"
                  className="h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-7 text-white shadow-md shadow-emerald-900/10 transition-all hover:from-emerald-600 hover:to-teal-700 hover:shadow-lg"
                  onClick={handleAuthenticatedLaunchClick}
                >
                  {primaryCtaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Link href="/login?mode=new">
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-7 text-white shadow-md shadow-emerald-900/10 transition-all hover:from-emerald-600 hover:to-teal-700 hover:shadow-lg"
                  >
                    {primaryCtaLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
              <a href="#workflow">
                <Button size="lg" variant="outline" className="h-12 rounded-full px-7">
                  See the workflow
                </Button>
              </a>
            </div>

            <div
              className="mt-10 grid gap-3 sm:grid-cols-3 hero-enter"
              style={{ animationDelay: "370ms" }}
            >
              {HERO_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-border/50 bg-card/70 px-4 py-3.5 backdrop-blur"
                >
                  <p className="font-display text-2xl font-semibold text-emerald-700">{stat.value}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            <p
              className="mt-7 inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/50 px-3.5 py-2 text-sm text-muted-foreground hero-enter"
              style={{ animationDelay: "450ms" }}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              Free stays generous, and the first 3 published launches include Pro so teams feel the full workflow before paying.
            </p>
          </div>

          {/* Hero preview card */}
          <aside
            className="rounded-[28px] border border-border/50 bg-card/80 p-5 shadow-2xl shadow-emerald-900/[0.04] backdrop-blur-xl md:p-6 hero-enter"
            style={{ animationDelay: "150ms" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-700/90">
                Listing launch snapshot
              </p>
              <Badge className="rounded-full border-emerald-500/25 bg-emerald-500/8 text-emerald-700">
                Reusable Link
              </Badge>
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-border/40 bg-background/60 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Imported listing</span>
                <span className="font-medium">123 Main St, New York, NY 10001</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-muted/50 p-2.5 text-center">
                  <p className="font-display text-lg font-semibold">1</p>
                  <p className="text-[11px] text-muted-foreground">share page</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-2.5 text-center">
                  <p className="font-display text-lg font-semibold text-orange-600">32</p>
                  <p className="text-[11px] text-muted-foreground">captures</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-2.5 text-center">
                  <p className="font-display text-lg font-semibold text-cyan-700">9</p>
                  <p className="text-[11px] text-muted-foreground">later inquiries</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                {
                  title: "MLS import cleaned into share-page content",
                  meta: "10:12 AM",
                  icon: Building2,
                },
                {
                  title: "QR, kiosk, and public link published",
                  meta: "10:15 AM",
                  icon: CalendarDays,
                },
                {
                  title: "AI Q&A becomes available after sign-in",
                  meta: "11:27 AM",
                  icon: MessageSquareText,
                },
                {
                  title: "Seller report split by on-site vs later demand",
                  meta: "6:40 PM",
                  icon: FileCheck2,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start justify-between rounded-2xl border border-border/40 bg-background/55 px-4 py-3"
                >
                  <div className="inline-flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-emerald-500/10 p-1.5 text-emerald-700">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                  </div>
                  <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-700" />
                </div>
              ))}
            </div>
          </aside>
        </section>

        {/* ═══════════════════════════════════════════════
            Product pillars
           ═══════════════════════════════════════════════ */}
        <section
          id="product"
          className="scroll-mt-24 mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-28"
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/90">
                Product
              </p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Listing workflow first, automation second.
              </h2>
            </div>
            <p className="text-base text-muted-foreground lg:text-right">
              The product is built around how agents actually launch a listing, share it, capture demand, and report back to the seller.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            {/* Featured wide pillar */}
            <article className="group rounded-[28px] border border-border/50 bg-card/60 p-7 transition-all duration-200 hover:border-emerald-500/25 hover:bg-card/80 hover:shadow-xl hover:shadow-emerald-900/[0.04]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-sm font-semibold text-emerald-700 transition-colors group-hover:bg-emerald-500/15">
                {PRODUCT_PILLARS[0].id}
              </div>
              <h3 className="mt-5 text-xl font-semibold leading-snug">{PRODUCT_PILLARS[0].title}</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                {PRODUCT_PILLARS[0].description}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
                {["MLS import", "Address lookup", "Flyer PDF", "Clean listing record"].map((tag) => (
                  <div key={tag} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                    {tag}
                  </div>
                ))}
              </div>
            </article>

            {/* Stacked secondary pillars */}
            <div className="flex flex-col gap-4">
              {PRODUCT_PILLARS.slice(1).map((pillar) => (
                <article
                  key={pillar.title}
                  className="group flex flex-1 flex-col rounded-[24px] border border-border/50 bg-card/60 p-5 transition-all duration-200 hover:border-emerald-500/25 hover:bg-card/80 hover:shadow-lg hover:shadow-emerald-900/[0.03]"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-xs font-semibold text-emerald-700">
                      {pillar.id}
                    </div>
                    <h3 className="text-sm font-semibold leading-snug">{pillar.title}</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{pillar.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            Workflow
           ═══════════════════════════════════════════════ */}
        <section id="workflow" className="scroll-mt-24 border-y border-border/40 bg-muted/30">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/90">
                Workflow
              </p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Import. Share. Capture. Report.
              </h2>
              <p className="mt-4 text-base text-muted-foreground">
                A single operating loop, from listing import to long-tail inquiry capture.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {WORKFLOW_STEPS.map((item) => (
                <article
                  key={item.step}
                  className="rounded-[24px] border border-border/50 bg-card/65 p-5 md:p-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {item.step}
                  </p>
                  <div className="mt-3 inline-flex rounded-xl bg-emerald-500/10 p-2 text-emerald-700">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-28">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/90">
                Why teams upgrade
              </p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                $29 pays for the automation layer, not the form.
              </h2>
              <p className="mt-4 text-base text-muted-foreground">
                Free is intentionally usable, and the first 3 published launches include Pro. The paid layer starts once your team wants that automation on every launch without the trial limit.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {DIFFERENTIATORS.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[24px] border border-border/50 bg-card/65 p-5 md:p-6"
                >
                  <div className="inline-flex rounded-xl bg-emerald-500/10 p-2 text-emerald-700">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            AI Playbooks
           ═══════════════════════════════════════════════ */}
        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-20 md:px-8 md:py-24 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/90">
              AI playbooks
            </p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Qualification and follow-up stay attached to the listing context.
              </h2>
              <p className="mt-4 text-base text-muted-foreground">
              OpenHouse does not flatten every visitor into one sequence. It scores, routes, and drafts follow-up based on the same event and listing record the lead came through.
              </p>

            <div className="mt-6 space-y-2">
              {SCRIPT_PREVIEWS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActivePreview(item.key)}
                  className={`w-full rounded-2xl border p-3.5 text-left transition-all duration-200 ${activePreview === item.key
                    ? "border-emerald-500/35 bg-emerald-500/8 shadow-sm"
                    : "border-border/50 bg-card/50 hover:border-emerald-500/20 hover:bg-card/70"
                    }`}
                >
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                </button>
              ))}
            </div>
          </div>

          <article className="rounded-[24px] border border-border/50 bg-card/65 p-6 md:p-7">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Inside the recommendation engine
              </p>
              <Clock3 className="h-4 w-4 text-emerald-700" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{selectedPreview.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{selectedPreview.body}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {selectedPreview.tags.map((tag) => (
                <Badge
                  key={tag}
                  className="rounded-full border-emerald-500/25 bg-emerald-500/8 text-emerald-700"
                >
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-border/40 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Why teams keep this
              </p>
              <ul className="mt-3 space-y-2.5">
                {[
                  "Prioritization is standardized across every event.",
                  "Outreach copy is generated inside the listing workflow, not in a disconnected email tool.",
                  "Seller reporting stays aligned with on-site and long-tail lead actions.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </section>

        {/* ═══════════════════════════════════════════════
            Audience
           ═══════════════════════════════════════════════ */}
        <section id="audience" className="scroll-mt-24 border-y border-border/40 bg-muted/30">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/90">
                Who it&apos;s for
              </p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Built for teams that treat open houses as pipeline operations.
              </h2>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {AUDIENCE.map((profile) => (
                <article
                  key={profile.role}
                  className="rounded-[24px] border border-border/50 bg-card/65 p-5 md:p-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    {profile.role}
                  </p>
                  <h3 className="mt-3 text-base font-semibold">{profile.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{profile.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="rounded-[24px] border border-border/50 bg-card/65 p-5 md:p-6">
                <p className="text-sm font-semibold">Operational guardrail</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  OpenHouse is a lead operations platform. It is not legal, tax, MLS, fair housing,
                  or RESPA compliance advice.
                </p>
              </article>
              <article className="rounded-[24px] border border-border/50 bg-card/65 p-5 md:p-6">
                <p className="text-sm font-semibold">Publishing expectation</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  AI-generated recommendations and follow-up drafts should be reviewed by your team
                  before outbound use.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            Pricing
           ═══════════════════════════════════════════════ */}
        <section
          id="pricing"
          className="scroll-mt-24 mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32"
        >
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/90">
              Pricing
            </p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Start free. Your first 3 published launches already feel like Pro.
              </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {PRICING.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-[28px] border p-6 md:p-7 ${plan.highlighted
                  ? "border-emerald-500/35 bg-gradient-to-b from-emerald-500/8 to-card/90 shadow-xl shadow-emerald-900/[0.04]"
                  : "border-border/50 bg-card/65"
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {plan.name}
                    </p>
                    <p className="font-display mt-2 text-4xl font-semibold tracking-tight">
                      {plan.price}
                      <span className="ml-1 text-base font-normal text-muted-foreground">{plan.period}</span>
                    </p>
                  </div>
                  {plan.highlighted && (
                    <Badge className="rounded-full border-emerald-500/25 bg-emerald-500/10 text-emerald-700">
                      Recommended
                    </Badge>
                  )}
                </div>

                <p className="mt-3 text-sm text-muted-foreground">{plan.summary}</p>

                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isAuthenticated ? (
                  <Button
                    className={`mt-6 w-full rounded-full ${plan.highlighted
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/10 hover:from-emerald-600 hover:to-teal-700"
                      : ""
                      }`}
                    variant={plan.highlighted ? "default" : "outline"}
                    onClick={handleAuthenticatedLaunchClick}
                  >
                    {plan.cta}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Link href="/login?mode=new" className="mt-6 block">
                    <Button
                      className={`w-full rounded-full ${plan.highlighted
                        ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/10 hover:from-emerald-600 hover:to-teal-700"
                        : ""
                        }`}
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </article>
            ))}
          </div>

          <div className="mt-8 overflow-x-auto rounded-[32px] border border-border/50 bg-card/70 shadow-lg shadow-emerald-950/[0.04]">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[1.05fr_0.7fr_0.85fr] gap-4 border-b border-border/40 bg-gradient-to-r from-muted/30 via-background/70 to-emerald-500/[0.06] px-5 py-5 md:px-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Capability
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Most sign-in tools stop at capture. This is where Free and Pro actually diverge.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Free
                  </p>
                  <p className="mt-2 text-xl font-semibold">Launch and prove the workflow</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Best for agents who want a real listing page, QR sign-in, and 3 published launches with Pro features before buying automation.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.14] via-background/95 to-teal-500/[0.08] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        Pro
                      </p>
                      <p className="mt-2 text-xl font-semibold">$29/mo automation layer</p>
                    </div>
                    <Badge className="rounded-full border-emerald-500/30 bg-emerald-500/12 text-emerald-700">
                      Best fit
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    For teams that want AI qualification, automated follow-up, and seller attribution to compound after the event.
                  </p>
                </div>
              </div>
              <div className="divide-y divide-border/40">
                {PRICING_MATRIX.map((row) => (
                  <div
                    key={row.capability}
                    className="grid grid-cols-[1.05fr_0.7fr_0.85fr] gap-4 px-5 py-4 text-sm md:px-7"
                  >
                    <div className="flex items-center">
                      <p className="font-medium text-foreground">{row.capability}</p>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-background/80 px-4 py-3 text-muted-foreground">
                      {row.free}
                    </div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 font-medium text-emerald-700">
                      {row.pro}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Free keeps launches generous and includes 3 published Pro trial launches. Pro keeps the $29 price point focused on AI qualification, reusable-link attribution, and automated follow-up after the trial window is gone.
          </p>
        </section>

        {/* ═══════════════════════════════════════════════
            FAQ
           ═══════════════════════════════════════════════ */}
        <section className="mx-auto max-w-7xl px-5 pb-24 md:px-8">
          <div className="rounded-[28px] border border-border/50 bg-card/65 p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/90">
                  FAQ
                </p>
                <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Questions teams ask before rollout.
                </h2>
              </div>

              <div className="space-y-3">
                {FAQ.map((item) => (
                  <article
                    key={item.q}
                    className="rounded-2xl border border-border/40 bg-background/65 p-4"
                  >
                    <h3 className="text-sm font-semibold">{item.q}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════════════════════════════════════════
          Footer
         ═══════════════════════════════════════════════ */}
      <PublicTrustFooter />
    </div>
  );
}
