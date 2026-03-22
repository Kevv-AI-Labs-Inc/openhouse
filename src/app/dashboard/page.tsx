"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    CheckCircle2,
    Flame,
    Sparkles,
    TrendingUp,
    Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestNewEventDialog } from "@/lib/new-event-trigger";

const METRICS = [
    {
        title: "Total events",
        value: "0",
        note: "Create your first open house to initialize the pipeline",
        icon: CalendarDays,
        iconWrap: "bg-cyan-500/10 text-cyan-700",
    },
    {
        title: "Total sign-ins",
        value: "0",
        note: "Visitors captured by QR and kiosk check-in",
        icon: Users,
        iconWrap: "bg-emerald-500/10 text-emerald-700",
    },
    {
        title: "Hot leads",
        value: "0",
        note: "High-intent buyers from AI scoring",
        icon: Flame,
        iconWrap: "bg-orange-500/10 text-orange-600",
    },
    {
        title: "Conversion rate",
        value: "—",
        note: "Lead-to-showing conversion benchmark",
        icon: TrendingUp,
        iconWrap: "bg-indigo-500/10 text-indigo-700",
    },
];

const OPERATING_STEPS = [
    "Create an event with property details and timing.",
    "Publish your branded QR sign-in at the open house.",
    "Prioritize hot and warm leads before end of day.",
    "Send AI-assisted follow-up drafts after review.",
];

const PIPELINE_BANDS = [
    {
        tier: "HOT",
        guidance: "Same-hour callback with appointment CTA",
        score: "Score 70+",
        className: "border-orange-500/30 bg-orange-500/10 text-orange-700",
    },
    {
        tier: "WARM",
        guidance: "24-hour follow-up with listing context",
        score: "Score 40-69",
        className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700",
    },
    {
        tier: "COLD",
        guidance: "Long-cycle nurture and market education",
        score: "Score < 40",
        className: "border-border/60 bg-card/40 text-muted-foreground",
    },
];

export default function DashboardPage() {
    const router = useRouter();

    const handleCreateEventClick = () => {
        requestNewEventDialog();
        router.push("/dashboard/events");
    };

    return (
        <div className="space-y-7">
            <Card className="overflow-hidden border-border/60 bg-card/80 shadow-xl shadow-emerald-900/5">
                <CardContent className="relative p-6 md:p-7">
                    <div className="pointer-events-none absolute right-[-4rem] top-[-5rem] h-52 w-52 rounded-full bg-emerald-500/14 blur-3xl" />
                    <div className="pointer-events-none absolute bottom-[-5rem] left-[36%] h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                        Daily operations
                    </Badge>
                    <h1
                        className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl"
                        style={{ fontFamily: '"Canela", "Fraunces", "Times New Roman", serif' }}
                    >
                        Run each open house like a repeatable revenue workflow.
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                        This command center tracks event execution, buyer intent, and follow-up readiness so
                        your team can move quickly with consistent standards.
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Button
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                            onClick={handleCreateEventClick}
                        >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            Create first event
                        </Button>
                        <Link href="/dashboard/settings">
                            <Button variant="outline">
                                <Sparkles className="mr-2 h-4 w-4" />
                                Compare Free vs Pro
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {METRICS.map((metric) => (
                    <Card key={metric.title} className="border-border/55 bg-card/60">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {metric.title}
                            </CardTitle>
                            <div className={`rounded-lg p-2 ${metric.iconWrap}`}>
                                <metric.icon className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">{metric.value}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <Card className="border-border/60 bg-card/60">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <BadgeCheck className="h-5 w-5 text-emerald-700" />
                            90-minute launch checklist
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Operational sequence for a new team account.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {OPERATING_STEPS.map((step) => (
                            <div
                                key={step}
                                className="flex items-start gap-3 rounded-2xl border border-border/55 bg-background/60 px-4 py-3"
                            >
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                                <p className="text-sm text-muted-foreground">{step}</p>
                            </div>
                        ))}

                        <Link href="/dashboard/events" className="inline-flex">
                            <Button variant="ghost" className="px-0 text-emerald-700 hover:text-emerald-800">
                                Open event manager
                                <ArrowRight className="ml-1.5 h-4 w-4" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Card className="border-border/60 bg-card/60">
                        <CardHeader>
                            <CardTitle className="text-lg">Lead band standards</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Shared language across agents and team leads.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-2.5">
                            {PIPELINE_BANDS.map((band) => (
                                <div
                                    key={band.tier}
                                    className={`rounded-2xl border px-3 py-3 ${band.className}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold tracking-[0.08em]">{band.tier}</p>
                                        <p className="text-xs">{band.score}</p>
                                    </div>
                                    <p className="mt-1 text-xs leading-relaxed">{band.guidance}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-card/80">
                        <CardContent className="p-5">
                            <p className="text-sm font-semibold">Seller reporting expectation</p>
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                After each event, deliver a short report with traffic volume, lead tiers,
                                and next-step recommendations. Keep AI drafts human-reviewed before sending.
                            </p>
                            <Link href="/dashboard/analytics" className="mt-3 inline-flex">
                                <Button variant="outline" size="sm" className="border-emerald-500/35 text-emerald-700">
                                    View analytics
                                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
