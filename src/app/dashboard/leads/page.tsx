"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Users,
    Flame,
    Zap,
    Eye,
    Search,
    Loader2,
    Sparkles,
    Mail,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { parseStoredFollowUpDraft } from "@/lib/follow-up-draft";

interface LeadData {
    id: number;
    fullName: string;
    phone: string | null;
    email: string | null;
    hasAgent: boolean;
    isPreApproved: string | null;
    interestLevel: string | null;
    buyingTimeline: string | null;
    leadTier: string | null;
    leadScore: {
        overallScore: number;
        buyReadiness: number;
        financialStrength: number;
        engagementLevel: number;
        urgency: number;
        tier: string;
        recommendation: string;
        signals?: Record<string, unknown>;
    } | null;
    aiRecommendation: string | null;
    followUpSent: boolean;
    followUpContent: string | null;
    signedInAt: string;
    eventId: number;
}

interface EventData {
    id: number;
    propertyAddress: string;
    signIns: LeadData[];
}

type ProviderError = {
    provider: "google" | "microsoft" | "custom_domain";
    message: string;
};

type FollowUpResult = {
    signInId: number;
    visitorName: string;
    email?: string;
    subject?: string;
    body?: string;
    deliveryMode?: "google" | "microsoft" | "custom_domain" | "draft" | "mixed";
    deliveryStatus?: "sent" | "draft" | "skipped";
    providerErrors?: ProviderError[];
    error?: string;
};

type EditableFollowUpResult = FollowUpResult & {
    subject: string;
    body: string;
};

type BehaviorSummary = {
    userMessageCount?: number;
    sessionCount?: number;
    questionCategories?: string[];
    actionIntents?: string[];
};

const TIER_STYLE: Record<string, { label: string; icon: typeof Flame; className: string }> = {
    hot: { label: "Hot", icon: Flame, className: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
    warm: { label: "Warm", icon: Zap, className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
    cold: { label: "Cold", icon: Eye, className: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
};

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = Math.min(100, (value / max) * 100);
    return (
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
            />
        </div>
    );
}

export default function LeadsPage() {
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [tierFilter, setTierFilter] = useState("all");
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [followUpTarget, setFollowUpTarget] = useState<string | null>(null);
    const [followUpPreview, setFollowUpPreview] = useState<{
        eventId: number;
        title: string;
        description: string;
        results: FollowUpResult[];
    } | null>(null);
    const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
    const [editableFollowUps, setEditableFollowUps] = useState<EditableFollowUpResult[]>([]);
    const [sendingApproved, setSendingApproved] = useState(false);

    const fetchLeads = useCallback(async () => {
        try {
            const res = await fetch("/api/events");
            if (res.ok) {
                const eventsList = await res.json();
                // Fetch sign-ins for each event
                const enriched = await Promise.all(
                    eventsList.map(async (evt: { id: number; propertyAddress: string }) => {
                        const r = await fetch(`/api/events/${evt.id}`);
                        if (r.ok) return r.json();
                        return { ...evt, signIns: [] };
                    })
                );
                setEvents(enriched);
            }
        } catch {
            toast.error("Failed to load leads");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    const allLeads = events.flatMap((evt) =>
        (evt.signIns || []).map((s: LeadData) => ({ ...s, eventId: evt.id, propertyAddress: evt.propertyAddress }))
    );

    const pendingFollowUpEvents = useMemo(
        () =>
            events
                .map((event) => ({
                    id: event.id,
                    propertyAddress: event.propertyAddress,
                    pendingLeads: (event.signIns || [])
                        .filter((lead) => lead.email && !lead.followUpSent)
                        .sort((a, b) => {
                            const tierWeight = (tier: string | null) =>
                                tier === "hot" ? 3 : tier === "warm" ? 2 : tier === "cold" ? 1 : 0;
                            return (
                                tierWeight(b.leadTier) - tierWeight(a.leadTier) ||
                                (b.leadScore?.overallScore || 0) - (a.leadScore?.overallScore || 0)
                            );
                        }),
                }))
                .filter((event) => event.pendingLeads.length > 0)
                .sort((a, b) => {
                    const aHot = a.pendingLeads.filter((lead) => lead.leadTier === "hot").length;
                    const bHot = b.pendingLeads.filter((lead) => lead.leadTier === "hot").length;
                    const aDrafts = a.pendingLeads.filter((lead) =>
                        Boolean(parseStoredFollowUpDraft(lead.followUpContent))
                    ).length;
                    const bDrafts = b.pendingLeads.filter((lead) =>
                        Boolean(parseStoredFollowUpDraft(lead.followUpContent))
                    ).length;
                    return bHot - aHot || bDrafts - aDrafts || b.pendingLeads.length - a.pendingLeads.length;
                }),
        [events]
    );

    const filteredLeads = allLeads
        .filter((l) => {
            if (tierFilter !== "all" && l.leadTier !== tierFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                return l.fullName.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.phone?.includes(q);
            }
            return true;
        })
        .sort((a, b) => (b.leadScore?.overallScore || 0) - (a.leadScore?.overallScore || 0));
    filteredLeads.sort((a, b) => {
        const tierWeight = (tier: string | null) =>
            tier === "hot" ? 3 : tier === "warm" ? 2 : tier === "cold" ? 1 : 0;
        return (
            tierWeight(b.leadTier) - tierWeight(a.leadTier) ||
            (b.leadScore?.overallScore || 0) - (a.leadScore?.overallScore || 0)
        );
    });

    const hotCount = allLeads.filter((l) => l.leadTier === "hot").length;
    const warmCount = allLeads.filter((l) => l.leadTier === "warm").length;
    const coldCount = allLeads.filter((l) => l.leadTier === "cold" || !l.leadTier).length;

    const handleProcessLead = async (eventId: number, signInId: number) => {
        setProcessingId(signInId);
        try {
            const res = await fetch(`/api/events/${eventId}/process-signin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signInId }),
            });
            if (res.ok) {
                toast.success("Lead scored successfully!");
                fetchLeads();
            } else {
                const err = await res.json();
                toast.error(err.error || "Scoring failed");
            }
        } catch {
            toast.error("Failed to process lead");
        } finally {
            setProcessingId(null);
        }
    };

    const handleFollowUp = async (
        eventId: number,
        options?: {
            signInId?: number;
            title?: string;
            description?: string;
            send?: boolean;
        }
    ) => {
        const target = options?.signInId ? `lead-${options.signInId}` : `event-${eventId}`;
        setFollowUpTarget(target);
        try {
            const res = await fetch(`/api/events/${eventId}/follow-up`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...(options?.signInId ? { signInId: options.signInId } : {}),
                    send: options?.send ?? true,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                const results = Array.isArray(data.results) ? (data.results as FollowUpResult[]) : [];
                const sentCount = results.filter((item) => item.deliveryStatus === "sent").length;
                const draftCount = results.filter((item) => item.deliveryStatus === "draft").length;
                const failedCount = results.filter((item) => item.error).length;

                if (results.length > 1) {
                    toast.success(
                        sentCount > 0
                            ? `Follow-up completed: ${sentCount} sent${draftCount ? `, ${draftCount} draft` : ""}${failedCount ? `, ${failedCount} failed` : ""}`
                            : `Follow-up drafts updated: ${draftCount}${failedCount ? `, ${failedCount} failed` : ""}`
                    );
                } else if (data.deliveryMode === "google") {
                    toast.success("Follow-up email sent from Google mailbox");
                } else if (data.deliveryMode === "microsoft") {
                    toast.success("Follow-up email sent from Microsoft mailbox");
                } else if (data.deliveryMode === "custom_domain") {
                    toast.success("Follow-up email sent through the verified team domain");
                } else {
                    toast.success(
                        options?.send === false ? "Follow-up draft updated" : "Follow-up draft generated"
                    );
                }

                setFollowUpPreview({
                    eventId,
                    title:
                        options?.title ||
                        (results.length > 1 ? "Follow-up preview" : `Follow-up preview for ${results[0]?.visitorName || "lead"}`),
                    description:
                        options?.description ||
                        (results.length > 1
                            ? "Review each generated email before you move to the next batch."
                            : "Review the generated subject and body for this lead."),
                    results,
                });
                setEditableFollowUps(
                    results.map((result) => ({
                        ...result,
                        subject: result.subject || "",
                        body: result.body || "",
                    }))
                );
                setFollowUpDialogOpen(true);
                fetchLeads();
            } else {
                const err = await res.json();
                toast.error(err.error || "Follow-up failed");
            }
        } catch {
            toast.error("Failed to send follow-up");
        } finally {
            setFollowUpTarget(null);
        }
    };

    const handleApproveSend = async () => {
        if (!followUpPreview || editableFollowUps.length === 0) return;

        setSendingApproved(true);
        try {
            const res = await fetch(`/api/events/${followUpPreview.eventId}/follow-up`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    signInIds: editableFollowUps.map((item) => item.signInId),
                    drafts: editableFollowUps.map((item) => ({
                        signInId: item.signInId,
                        subject: item.subject.trim(),
                        body: item.body.trim(),
                    })),
                    send: true,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || "Batch follow-up failed");
                return;
            }

            const data = await res.json();
            const results = Array.isArray(data.results) ? (data.results as FollowUpResult[]) : [];
            const sentCount = results.filter((item) => item.deliveryStatus === "sent").length;
            const draftCount = results.filter((item) => item.deliveryStatus === "draft").length;
            const failedCount = results.filter((item) => item.error).length;

            toast.success(
                sentCount > 0
                    ? `Follow-up completed: ${sentCount} sent${draftCount ? `, ${draftCount} draft` : ""}${failedCount ? `, ${failedCount} failed` : ""}`
                    : `Follow-up drafts updated: ${draftCount}${failedCount ? `, ${failedCount} failed` : ""}`
            );

            setFollowUpPreview((current) =>
                current
                    ? {
                        ...current,
                        results,
                    }
                    : null
            );
            setEditableFollowUps(
                results.map((result) => ({
                    ...result,
                    subject: result.subject || "",
                    body: result.body || "",
                }))
            );
            fetchLeads();
        } catch {
            toast.error("Failed to approve and send follow-ups");
        } finally {
            setSendingApproved(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
                <p className="mt-1 text-muted-foreground">All visitors across your Open Houses</p>
            </div>

            {/* Stats Strip — asymmetric 2-col: total count gets prominence, tiers stack right */}
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Card className="border-border/55 bg-card/60">
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="font-mono text-3xl font-semibold tracking-tight">{allLeads.length}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">Total leads captured</div>
                        </div>
                    </CardContent>
                </Card>
                <div className="grid grid-cols-3 gap-3">
                    <Card className="border-border/55 bg-card/60">
                        <CardContent className="p-4">
                            <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                                <Flame className="h-3.5 w-3.5" />
                            </div>
                            <div className="font-mono text-2xl font-semibold">{hotCount}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">Hot</div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/55 bg-card/60">
                        <CardContent className="p-4">
                            <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-600">
                                <Zap className="h-3.5 w-3.5" />
                            </div>
                            <div className="font-mono text-2xl font-semibold">{warmCount}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">Warm</div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/55 bg-card/60">
                        <CardContent className="p-4">
                            <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-xl bg-muted/60">
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="font-mono text-2xl font-semibold">{coldCount}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">Cold</div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Search by name, email, phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger className="w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Tiers</SelectItem>
                        <SelectItem value="hot">🔥 Hot</SelectItem>
                        <SelectItem value="warm">⚡ Warm</SelectItem>
                        <SelectItem value="cold">👀 Cold</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {pendingFollowUpEvents.length > 0 && (
                <Card className="border-border/50">
                    <CardContent className="p-4 space-y-3">
                        <div>
                            <h2 className="text-sm font-semibold">One-click follow-up by open house</h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                Send or draft personalized follow-ups for every unsent lead from a single event.
                            </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            {pendingFollowUpEvents.map((event) => {
                                const isProcessing = followUpTarget === `event-${event.id}`;
                                const draftReadyCount = event.pendingLeads.filter((lead) =>
                                    Boolean(parseStoredFollowUpDraft(lead.followUpContent))
                                ).length;
                                const hotLeadCount = event.pendingLeads.filter((lead) => lead.leadTier === "hot").length;
                                return (
                                    <div
                                        key={event.id}
                                        className="rounded-xl border border-border/50 p-3 flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{event.propertyAddress}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {event.pendingLeads.length} unsent {event.pendingLeads.length === 1 ? "lead" : "leads"}
                                                {hotLeadCount > 0 ? ` · ${hotLeadCount} hot` : ""}
                                                {draftReadyCount > 0 ? ` · ${draftReadyCount} drafts ready` : ""}
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="shrink-0"
                                            disabled={isProcessing}
                                            onClick={() =>
                                                handleFollowUp(event.id, {
                                                    title: `Follow-up preview for ${event.propertyAddress}`,
                                                    description: `Review and tune the draft for ${event.pendingLeads.length} unsent lead${event.pendingLeads.length === 1 ? "" : "s"} from this event before approving the batch send.`,
                                                    send: false,
                                                })
                                            }
                                        >
                                            {isProcessing ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                            ) : (
                                                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                                            )}
                                            {draftReadyCount > 0 ? "Review & send all" : "Prepare batch"}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Leads List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                </div>
            ) : filteredLeads.length === 0 ? (
                <Card className="border-dashed border-border/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-semibold mb-1">No leads yet</h3>
                        <p className="text-sm text-muted-foreground">
                            Leads will appear here once visitors sign in at your Open Houses
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredLeads.map((lead) => {
                        const tierInfo = TIER_STYLE[lead.leadTier || "cold"] || TIER_STYLE.cold;
                        const TierIcon = tierInfo.icon;
                        const score = lead.leadScore;
                        const draftReady = Boolean(parseStoredFollowUpDraft(lead.followUpContent));
                        const behavior =
                            score?.signals &&
                            typeof score.signals === "object" &&
                            "behavior" in score.signals &&
                            score.signals.behavior &&
                            typeof score.signals.behavior === "object"
                                ? (score.signals.behavior as BehaviorSummary)
                                : null;
                        const behaviorSummary = behavior
                            ? [
                                behavior.userMessageCount
                                    ? `${behavior.userMessageCount} Q&A messages`
                                    : null,
                                behavior.sessionCount && behavior.sessionCount > 1
                                    ? `${behavior.sessionCount} visits`
                                    : null,
                                behavior.questionCategories && behavior.questionCategories.length > 0
                                    ? `Asked about ${behavior.questionCategories
                                        .slice(0, 2)
                                        .map((item) => item.replaceAll("_", " "))
                                        .join(", ")}`
                                    : null,
                            ]
                                .filter(Boolean)
                                .join(" · ")
                            : "";

                        return (
                            <Card key={lead.id} className="border-border/50 hover:border-emerald-500/20 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        {/* Score Circle */}
                                        <div className="flex flex-col items-center gap-1 w-14">
                                            <div
                                                className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
                                                style={{
                                                    background: `conic-gradient(${lead.leadTier === "hot" ? "#f97316" : lead.leadTier === "warm" ? "#eab308" : "#6b7280"
                                                        } ${(score?.overallScore || 0) * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                                                }}
                                            >
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-sm">
                                                    {score?.overallScore || "—"}
                                                </span>
                                            </div>
                                            <Badge className={tierInfo.className + " text-xs px-1.5"}>
                                                <TierIcon className="h-3 w-3 mr-0.5" />
                                                {tierInfo.label}
                                            </Badge>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-sm">{lead.fullName}</h3>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {[lead.phone, lead.email].filter(Boolean).join(" · ") || "No contact info"}
                                            </p>

                                            {/* Score Breakdown */}
                                            {score && (
                                                <div className="grid grid-cols-4 gap-2 mt-2">
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground">Buy Ready</span>
                                                        <ScoreBar value={score.buyReadiness} max={25} color="#10b981" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground">Financial</span>
                                                        <ScoreBar value={score.financialStrength} max={25} color="#3b82f6" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground">Engaged</span>
                                                        <ScoreBar value={score.engagementLevel} max={25} color="#8b5cf6" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground">Urgency</span>
                                                        <ScoreBar value={score.urgency} max={25} color="#f97316" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* AI Recommendation */}
                                            {lead.aiRecommendation && (
                                                <p className="text-xs text-emerald-400/80 mt-2 italic">
                                                    💡 {lead.aiRecommendation}
                                                </p>
                                            )}
                                            {behaviorSummary && (
                                                <p className="text-[11px] text-muted-foreground mt-2">
                                                    {behaviorSummary}
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-1.5">
                                            {!score && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs"
                                                    onClick={() => handleProcessLead(lead.eventId, lead.id)}
                                                    disabled={processingId === lead.id}
                                                >
                                                    {processingId === lead.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                    ) : (
                                                        <Sparkles className="h-3 w-3 mr-1" />
                                                    )}
                                                    Score
                                                </Button>
                                            )}
                                            {lead.email && !lead.followUpSent && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs"
                                                    disabled={followUpTarget === `lead-${lead.id}`}
                                                    onClick={() =>
                                                        handleFollowUp(lead.eventId, {
                                                            signInId: lead.id,
                                                            title: `Follow-up preview for ${lead.fullName}`,
                                                            description: `Review and tune the generated follow-up before approving the send for ${lead.fullName}.`,
                                                            send: false,
                                                        })
                                                    }
                                                >
                                                    {followUpTarget === `lead-${lead.id}` ? (
                                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                    ) : (
                                                        <Mail className="h-3 w-3 mr-1" />
                                                    )}
                                                    {draftReady ? "Review & Send" : "Prepare Draft"}
                                                </Button>
                                            )}
                                            {draftReady && !lead.followUpSent && (
                                                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">
                                                    Draft ready
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>{followUpPreview?.title || "Follow-up preview"}</DialogTitle>
                        <DialogDescription>
                            {followUpPreview?.description || "Review the generated follow-up email content."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 overflow-y-auto pr-1">
                        {editableFollowUps.map((result) => (
                            <div key={result.signInId} className="rounded-xl border border-border/50 p-4 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate">{result.visitorName}</p>
                                        {result.email && (
                                            <p className="text-xs text-muted-foreground truncate">{result.email}</p>
                                        )}
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={
                                            result.deliveryStatus === "sent"
                                                ? "border-emerald-500/30 text-emerald-400"
                                                : result.deliveryStatus === "draft"
                                                    ? "border-amber-500/30 text-amber-400"
                                                    : "border-border/60 text-muted-foreground"
                                        }
                                    >
                                        {result.deliveryStatus === "sent"
                                            ? `Sent via ${result.deliveryMode?.replace("_", " ")}`
                                            : result.deliveryStatus === "draft"
                                                ? "Draft"
                                                : "Skipped"}
                                    </Badge>
                                </div>
                                {result.subject && (
                                    <div className="rounded-lg bg-muted/20 p-3">
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                                            Subject
                                        </p>
                                        <Input
                                            value={result.subject}
                                            onChange={(event) =>
                                                setEditableFollowUps((current) =>
                                                    current.map((item) =>
                                                        item.signInId === result.signInId
                                                            ? { ...item, subject: event.target.value }
                                                            : item
                                                    )
                                                )
                                            }
                                        />
                                    </div>
                                )}
                                {result.body && (
                                    <div className="rounded-lg bg-muted/20 p-3">
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                                            Body
                                        </p>
                                        <Textarea
                                            value={result.body}
                                            className="min-h-40 text-sm leading-6"
                                            onChange={(event) =>
                                                setEditableFollowUps((current) =>
                                                    current.map((item) =>
                                                        item.signInId === result.signInId
                                                            ? { ...item, body: event.target.value }
                                                            : item
                                                    )
                                                )
                                            }
                                        />
                                    </div>
                                )}
                                {result.providerErrors && result.providerErrors.length > 0 && (
                                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                                        <p className="text-xs font-medium text-amber-500">Delivery notes</p>
                                        {result.providerErrors.map((providerError) => (
                                            <p key={`${result.signInId}-${providerError.provider}`} className="text-xs text-muted-foreground">
                                                {providerError.provider}: {providerError.message}
                                            </p>
                                        ))}
                                    </div>
                                )}
                                {result.error && (
                                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                                        {result.error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <DialogFooter showCloseButton>
                        <Button
                            onClick={handleApproveSend}
                            disabled={
                                sendingApproved ||
                                editableFollowUps.length === 0 ||
                                editableFollowUps.some((item) => !item.subject.trim() || !item.body.trim())
                            }
                        >
                            {sendingApproved ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Mail className="h-4 w-4 mr-2" />
                            )}
                            Approve & Send {editableFollowUps.length > 1 ? `(${editableFollowUps.length})` : ""}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
