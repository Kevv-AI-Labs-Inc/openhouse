"use client";

import { useEffect, useMemo, useState } from "react";
import {
    BarChart3,
    CalendarDays,
    FileText,
    Flame,
    PieChart,
    QrCode,
    TrendingUp,
    Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsEvent {
    id: number;
    propertyAddress: string;
    status: "draft" | "active" | "completed" | "cancelled";
    publicMode: "open_house" | "listing_inquiry";
    totalSignIns: number;
    hotLeadsCount: number;
    aiQaContext?: {
        mlsData?: Record<string, unknown>;
    } | null;
}

function getImportedSource(event: AnalyticsEvent) {
    const source = event.aiQaContext?.mlsData?.importedSource;
    if (source === "mls" || source === "address" || source === "flyer") {
        return source;
    }
    return "manual";
}

function formatSourceLabel(source: ReturnType<typeof getImportedSource>) {
    switch (source) {
        case "mls":
            return "MLS";
        case "address":
            return "Address";
        case "flyer":
            return "Flyer";
        default:
            return "Manual";
    }
}

export default function AnalyticsPage() {
    const [events, setEvents] = useState<AnalyticsEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function loadAnalytics() {
            try {
                const response = await fetch("/api/events");
                if (!response.ok) {
                    throw new Error("Failed to load analytics");
                }

                const data = (await response.json()) as AnalyticsEvent[];
                if (!cancelled) {
                    setEvents(data);
                }
            } catch {
                if (!cancelled) {
                    setEvents([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadAnalytics();

        return () => {
            cancelled = true;
        };
    }, []);

    const summary = useMemo(() => {
        const statusBreakdown = [
            { label: "Draft", value: events.filter((event) => event.status === "draft").length },
            { label: "Active", value: events.filter((event) => event.status === "active").length },
            { label: "Completed", value: events.filter((event) => event.status === "completed").length },
            { label: "Cancelled", value: events.filter((event) => event.status === "cancelled").length },
        ];

        const sourceCounts = events.reduce<Record<string, number>>((accumulator, event) => {
            const key = getImportedSource(event);
            accumulator[key] = (accumulator[key] || 0) + 1;
            return accumulator;
        }, {});

        const sourceBreakdown = ["mls", "address", "flyer", "manual"].map((source) => ({
            label: formatSourceLabel(source as ReturnType<typeof getImportedSource>),
            value: sourceCounts[source] || 0,
        }));

        return {
            totalEvents: events.length,
            activeLinks: events.filter((event) => event.status === "active" || event.status === "completed").length,
            totalSignIns: events.reduce((sum, event) => sum + event.totalSignIns, 0),
            hotLeads: events.reduce((sum, event) => sum + event.hotLeadsCount, 0),
            sellerReportsReady: events.filter((event) => event.totalSignIns > 0).length,
            listingInquiryLinks: events.filter((event) => event.publicMode === "listing_inquiry").length,
            statusBreakdown,
            sourceBreakdown,
        };
    }, [events]);

    const headlineMetrics = [
        {
            label: "Events tracked",
            value: summary.totalEvents,
            note: "Listings under management right now",
            icon: CalendarDays,
            tone: "bg-cyan-500/10 text-cyan-700",
        },
        {
            label: "Reusable links live",
            value: summary.activeLinks,
            note: "Open house + later demand on the same link",
            icon: QrCode,
            tone: "bg-emerald-500/10 text-emerald-700",
        },
        {
            label: "Captured contacts",
            value: summary.totalSignIns,
            note: "Total demand already collected",
            icon: Users,
            tone: "bg-teal-500/10 text-teal-700",
        },
        {
            label: "Hot leads",
            value: summary.hotLeads,
            note: "Highest-priority buyers to move first",
            icon: Flame,
            tone: "bg-orange-500/10 text-orange-600",
        },
    ];

    return (
        <div className="space-y-6">
            <Card className="overflow-hidden border-border/60 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(255,255,255,0.94)_56%,rgba(56,189,248,0.06))] shadow-xl shadow-emerald-900/5">
                <CardContent className="relative p-6 md:p-7">
                    <div className="pointer-events-none absolute right-[-4rem] top-[-5rem] h-52 w-52 rounded-full bg-emerald-500/12 blur-3xl" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Workspace analytics
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-[2.15rem]">
                        Seller reporting starts with a clean operating picture.
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/72">
                        This page now shows real workspace totals instead of a placeholder. Use it to see how
                        much capture volume you have, what is live, and which imports are actually driving the pipeline.
                    </p>
                </CardContent>
            </Card>

            {loading ? (
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {[...Array(4)].map((_, i) => (
                            <Card key={i} className="border-border/55 bg-card/62">
                                <CardHeader className="pb-2">
                                    <Skeleton className="h-3.5 w-28 rounded" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-8 w-16 rounded-lg" />
                                    <Skeleton className="mt-2 h-3 w-32 rounded" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.92fr)]">
                        {[0, 1].map((i) => (
                            <Card key={i} className="border-border/55 bg-card/62">
                                <CardHeader className="pb-2">
                                    <Skeleton className="h-5 w-32 rounded" />
                                </CardHeader>
                                <CardContent className="grid gap-3 sm:grid-cols-2">
                                    {[...Array(4)].map((_, j) => (
                                        <Skeleton key={j} className="h-16 w-full rounded-[1.2rem]" />
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {headlineMetrics.map((metric) => (
                            <Card key={metric.label} className="border-border/55 bg-card/62">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        {metric.label}
                                    </CardTitle>
                                    <div className={`rounded-lg p-2 ${metric.tone}`}>
                                        <metric.icon className="h-4 w-4" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
                                        {metric.value}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.92fr)]">
                        <Card className="border-border/60 bg-card/60">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <PieChart className="h-5 w-5 text-emerald-700" />
                                    Status mix
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    See where the workspace is accumulating operational debt.
                                </p>
                            </CardHeader>
                            <CardContent className="grid gap-3 sm:grid-cols-2">
                                {summary.statusBreakdown.map((item) => (
                                    <div
                                        key={item.label}
                                        className="rounded-[1.2rem] border border-border/65 bg-background/70 px-4 py-4"
                                    >
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                            {item.label}
                                        </p>
                                        <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-foreground">
                                            {item.value}
                                        </p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 bg-card/60">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <BarChart3 className="h-5 w-5 text-emerald-700" />
                                    Import source mix
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Useful for spotting how listings are really entering the workflow.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {summary.sourceBreakdown.map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex items-center justify-between rounded-[1.2rem] border border-border/65 bg-background/70 px-4 py-3"
                                    >
                                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                                        <p className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="border-border/60 bg-card/60">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <TrendingUp className="h-5 w-5 text-emerald-700" />
                                    Operating takeaways
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="rounded-[1.2rem] border border-border/65 bg-background/70 px-4 py-3">
                                    <p className="text-sm font-semibold text-foreground">
                                        {summary.sellerReportsReady} listing{summary.sellerReportsReady === 1 ? "" : "s"} can already support a seller recap.
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        That count is driven by captured traffic, not just published events.
                                    </p>
                                </div>
                                <div className="rounded-[1.2rem] border border-border/65 bg-background/70 px-4 py-3">
                                    <p className="text-sm font-semibold text-foreground">
                                        {summary.listingInquiryLinks} reusable link{summary.listingInquiryLinks === 1 ? "" : "s"} are still collecting off-site demand.
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Those are the listings most likely to show a longer-tail story after the open house weekend.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 bg-card/60">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <FileText className="h-5 w-5 text-emerald-700" />
                                    What is still missing
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                <div className="rounded-[1.2rem] border border-border/65 bg-background/70 px-4 py-3">
                                    Time-series charts, per-event conversion trends, and deeper seller report comparisons are not built yet.
                                </div>
                                <div className="rounded-[1.2rem] border border-border/65 bg-background/70 px-4 py-3">
                                    This version removes the placeholder and gives you a real workspace summary while the deeper charting layer is still pending.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
