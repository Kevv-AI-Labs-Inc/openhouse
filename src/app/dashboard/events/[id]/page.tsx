"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  Flame,
  Loader2,
  Printer,
  QrCode,
  Save,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventImportAssistant } from "@/components/event-import-assistant";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applyImportedDraft,
  buildEventPayload,
  createEmptyEventFormState,
  type EventFormState,
} from "@/lib/event-form";
import {
  openHousePropertyTypes,
  type EventAiQaContext,
  type EventImportDraft,
} from "@/lib/listing-import-shared";
import Image from "next/image";
import { formatPublicModeLabel, inferCaptureMode } from "@/lib/public-mode";
import { getPropertyQaInsights } from "@/lib/property-qa-insights";

interface SignIn {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  captureMode: string | null;
  hasAgent: boolean;
  isPreApproved: string | null;
  interestLevel: string | null;
  buyingTimeline: string | null;
  leadTier: string | null;
  signedInAt: string;
}

interface EventDetail {
  id: number;
  uuid: string;
  propertyAddress: string;
  mlsNumber: string | null;
  listPrice: string | null;
  propertyDescription: string | null;
  startTime: string;
  endTime: string;
  publicMode: string;
  status: string;
  totalSignIns: number;
  hotLeadsCount: number;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  sqft: number | null;
  yearBuilt: number | null;
  complianceText: string | null;
  propertyPhotos: string[] | null;
  aiQaContext: EventAiQaContext | null;
  signIns: SignIn[];
}

interface ShareKit {
  qrDataUrl: string;
  signInUrl: string;
  eventUuid: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  completed: { label: "Completed", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  cancelled: { label: "Cancelled", className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const INTEREST_BADGE: Record<string, { label: string; className: string }> = {
  very: { label: "Hot", className: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  somewhat: { label: "Warm", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  just_looking: { label: "Looking", className: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
};

function formatPropertyTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildFormFromEvent(event: EventDetail): EventFormState {
  const mlsData = event.aiQaContext?.mlsData;
  const importedSource = typeof mlsData?.importedSource === "string" ? mlsData.importedSource : null;
  const importedHeadline = typeof mlsData?.address === "string" ? mlsData.address : event.propertyAddress;
  const importedSubheadline = [
    typeof mlsData?.city === "string" ? mlsData.city : null,
    typeof mlsData?.state === "string" ? mlsData.state : null,
    typeof mlsData?.schoolDistrict === "string" ? mlsData.schoolDistrict : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    ...createEmptyEventFormState(),
    propertyAddress: event.propertyAddress || "",
    mlsNumber: event.mlsNumber || "",
    listPrice: event.listPrice || "",
    propertyDescription: event.propertyDescription || "",
    complianceText: event.complianceText || "",
    startTime: event.startTime ? format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm") : "",
    endTime: event.endTime ? format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm") : "",
    publicMode: event.publicMode === "listing_inquiry" ? "listing_inquiry" : "open_house",
    status: event.status,
    propertyType: (event.propertyType as EventFormState["propertyType"]) || "",
    bedrooms: event.bedrooms !== null && event.bedrooms !== undefined ? String(event.bedrooms) : "",
    bathrooms: event.bathrooms || "",
    sqft: event.sqft !== null && event.sqft !== undefined ? String(event.sqft) : "",
    yearBuilt: event.yearBuilt !== null && event.yearBuilt !== undefined ? String(event.yearBuilt) : "",
    propertyPhotos: event.propertyPhotos || [],
    aiQaContext: event.aiQaContext,
    importSummary: importedSource
      ? {
          source: importedSource === "address" || importedSource === "flyer" ? importedSource : "mls",
          headline: importedHeadline,
          subheadline: importedSubheadline,
          badges: [
            event.mlsNumber ? `MLS ${event.mlsNumber}` : null,
            event.listPrice ? `$${Number(event.listPrice).toLocaleString()}` : null,
            event.propertyPhotos?.length ? `${event.propertyPhotos.length} photos` : null,
          ].filter((item): item is string => Boolean(item)),
        }
      : null,
  };
}

function parseOptionalNumber(value: string, fallback: number | null) {
  if (value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [form, setForm] = useState<EventFormState>(() => createEmptyEventFormState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [shareKit, setShareKit] = useState<ShareKit | null>(null);
  const [shareKitLoading, setShareKitLoading] = useState(true);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (res.ok) {
        const data = (await res.json()) as EventDetail;
        setEvent(data);
        setForm(buildFormFromEvent(data));
      }
    } catch {
      toast.error("Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  useEffect(() => {
    let cancelled = false;

    async function fetchShareKit() {
      try {
        const res = await fetch(`/api/events/${id}/qr`);
        if (!res.ok) {
          throw new Error("Failed to load share kit");
        }

        const data = (await res.json()) as ShareKit;
        if (!cancelled) {
          setShareKit(data);
        }
      } catch {
        if (!cancelled) {
          setShareKit(null);
        }
      } finally {
        if (!cancelled) {
          setShareKitLoading(false);
        }
      }
    }

    fetchShareKit();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const updateForm = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleApplyDraft = (draft: EventImportDraft) => {
    setForm((current) => applyImportedDraft(current, draft));
  };

  const handleCancel = () => {
    if (event) {
      setForm(buildFormFromEvent(event));
    }
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildEventPayload(form)),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save event");
      }

      toast.success("Event updated");
      setEditing(false);
      fetchEvent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    const url = shareKit?.signInUrl || (event ? `${window.location.origin}/oh/${event.uuid}` : null);
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success("Sign-in link copied");
  };

  const handleDownloadQr = () => {
    if (!shareKit || !event) return;
    const link = document.createElement("a");
    link.href = shareKit.qrDataUrl;
    link.download = `${event.propertyAddress.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-qr.png`;
    link.click();
  };

  const handlePrintQr = () => {
    if (!shareKit || !event) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=840,height=1100");
    if (!printWindow) {
      toast.error("Unable to open print preview");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${event.propertyAddress} QR</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            .sheet { max-width: 720px; margin: 0 auto; text-align: center; }
            .kicker { font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; }
            h1 { margin: 12px 0; font-size: 28px; line-height: 1.2; }
            .sub { margin-bottom: 24px; color: #4b5563; }
            img { width: 320px; height: 320px; object-fit: contain; }
            .url { margin-top: 18px; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 16px; font-size: 14px; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="kicker">${event.publicMode === "listing_inquiry" ? "Listing Inquiry" : "Open House Sign-In"}</div>
            <h1>${event.propertyAddress}</h1>
            <div class="sub">${event.publicMode === "listing_inquiry" ? "Scan to open the property inquiry page on your phone." : "Scan to open the sign-in page on your phone."}</div>
            <img src="${shareKit.qrDataUrl}" alt="QR code" />
            <div class="url">${shareKit.signInUrl}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  const signIns = event.signIns || [];
  const importedSource = form.importSummary?.source || "manual";
  const importedPhotoCount = form.propertyPhotos.length;
  const importedFaqCount = form.aiQaContext?.customFaq?.length ?? 0;
  const qaInsights = getPropertyQaInsights({
    propertyAddress: form.propertyAddress || event.propertyAddress,
    listPrice: form.listPrice || event.listPrice,
    propertyDescription: form.propertyDescription || event.propertyDescription,
    bedrooms: parseOptionalNumber(form.bedrooms, event.bedrooms),
    bathrooms: form.bathrooms || event.bathrooms,
    sqft: parseOptionalNumber(form.sqft, event.sqft),
    yearBuilt: parseOptionalNumber(form.yearBuilt, event.yearBuilt),
    aiQaContext: form.aiQaContext,
  });
  const qaCoverageBadgeClass =
    qaInsights.level === "strong"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : qaInsights.level === "partial"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
        : "border-slate-500/30 bg-slate-500/10 text-slate-700";

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/events">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{event.propertyAddress}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge className={STATUS_BADGE[event.status]?.className || ""}>
                {STATUS_BADGE[event.status]?.label || event.status}
              </Badge>
              <Badge variant="secondary">{formatPublicModeLabel(event.publicMode)}</Badge>
              <span className="text-sm text-muted-foreground">Reusable sign-in link</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <Copy className="mr-2 h-4 w-4" />Copy Link
          </Button>
          <Link href={`/oh/${event.uuid}`} target="_blank">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />Sign-in Page
            </Button>
          </Link>
          <Link href={`/oh/${event.uuid}/kiosk`} target="_blank">
            <Button variant="outline" size="sm">
              <QrCode className="mr-2 h-4 w-4" />Kiosk
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{signIns.length}</div>
              <div className="text-xs text-muted-foreground">Sign-ins</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <Flame className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {signIns.filter((signIn) => signIn.interestLevel === "very").length}
              </div>
              <div className="text-xs text-muted-foreground">Hot leads</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Sparkles className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{qaInsights.score}%</div>
              <div className="text-xs text-muted-foreground">AI Q&A coverage</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">AI Q&A Coverage</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Internal QA readiness for the public property chat. This is not shown to visitors.
            </p>
          </div>
          <Badge className={qaCoverageBadgeClass}>
            {qaInsights.level === "strong"
              ? "Strong coverage"
              : qaInsights.level === "partial"
                ? "Partial coverage"
                : "Thin coverage"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl border border-border/60 bg-background/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Coverage summary
              </p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-4xl font-semibold">{qaInsights.score}%</span>
                <span className="pb-1 text-sm text-muted-foreground">
                  {qaInsights.readyCount} of {qaInsights.totalCount} areas ready
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {importedFaqCount} prepared FAQ pair{importedFaqCount === 1 ? "" : "s"} and{" "}
                {importedPhotoCount} imported photo{importedPhotoCount === 1 ? "" : "s"} currently attached.
              </p>
              {qaInsights.missingLabels.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Still thin
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {qaInsights.missingLabels.map((label) => (
                      <Badge
                        key={label}
                        variant="outline"
                        className="border-amber-500/25 bg-amber-500/5 text-amber-700"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-border/60 bg-background/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Suggested starter questions
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {qaInsights.suggestedQuestions.map((question) => (
                  <span
                    key={question}
                    className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {question}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                If coverage is thin, re-import from MLS or flyer, or add agent notes before relying on the public chat.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {qaInsights.categories.map((category) => (
              <div
                key={category.key}
                className={`rounded-2xl border px-4 py-3 ${
                  category.ready
                    ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                    : "border-border/60 bg-background/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{category.label}</p>
                  <Badge
                    variant="outline"
                    className={
                      category.ready
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                        : "border-border/70 bg-background text-muted-foreground"
                    }
                  >
                    {category.ready ? "Ready" : "Missing"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{category.summary}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Share Kit</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {event.publicMode === "listing_inquiry"
                ? "Share the direct link or QR in follow-ups, brochures, and buyer-agent outreach."
                : "Use the direct sign-in link or print the QR for flyers, table tents, and door signage."}
            </p>
          </div>
          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
            {event.publicMode === "listing_inquiry" ? "Buyer-facing" : "Guest-facing"}
          </Badge>
        </CardHeader>
        <CardContent>
          {shareKitLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building QR share kit...
            </div>
          ) : !shareKit ? (
            <p className="text-sm text-muted-foreground">Unable to load the QR share kit right now.</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="rounded-3xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Share link</p>
                  <p className="mt-2 break-all text-sm text-foreground/90">{shareKit.signInUrl}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleCopyLink}>
                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                  </Button>
                  <Link href={shareKit.signInUrl} target="_blank">
                    <Button variant="outline">
                      <ExternalLink className="mr-2 h-4 w-4" /> Open Page
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={handleDownloadQr}>
                    <Download className="mr-2 h-4 w-4" /> Download QR
                  </Button>
                  <Button variant="outline" onClick={handlePrintQr}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                  </Button>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end">
                <div className="rounded-[2rem] border border-border/60 bg-white p-5 shadow-xl shadow-emerald-950/5">
                  <Image
                    src={shareKit.qrDataUrl}
                    alt="Open House QR code"
                    width={280}
                    height={280}
                    unoptimized
                    className="h-64 w-64 rounded-2xl"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Event Details</CardTitle>
          {editing ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-500 text-white hover:bg-emerald-600"
              >
                {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                Save
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {editing ? (
            <>
              <EventImportAssistant onApplyDraft={handleApplyDraft} />

              <div className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
                <div className="space-y-5 rounded-3xl border border-border/60 bg-background/80 p-5">
                  <div className="space-y-2">
                    <Label htmlFor="edit-address">Address</Label>
                    <Input
                      id="edit-address"
                      value={form.propertyAddress}
                      onChange={(event) => updateForm("propertyAddress", event.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-mls">MLS #</Label>
                      <Input
                        id="edit-mls"
                        value={form.mlsNumber}
                        onChange={(event) => updateForm("mlsNumber", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-price">List Price</Label>
                      <Input
                        id="edit-price"
                        value={form.listPrice}
                        onChange={(event) => updateForm("listPrice", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.8fr)]">
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="edit-property-type">Property type</Label>
                      <Select
                        value={form.propertyType || "none"}
                        onValueChange={(value) =>
                          updateForm(
                            "propertyType",
                            value === "none" ? "" : (value as EventFormState["propertyType"])
                          )
                        }
                      >
                        <SelectTrigger id="edit-property-type" className="w-full min-w-0">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not set</SelectItem>
                          {openHousePropertyTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {formatPropertyTypeLabel(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="edit-beds">Beds</Label>
                      <Input
                        id="edit-beds"
                        value={form.bedrooms}
                        onChange={(event) => updateForm("bedrooms", event.target.value)}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="edit-baths">Baths</Label>
                      <Input
                        id="edit-baths"
                        value={form.bathrooms}
                        onChange={(event) => updateForm("bathrooms", event.target.value)}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="edit-sqft">Sqft</Label>
                      <Input
                        id="edit-sqft"
                        value={form.sqft}
                        onChange={(event) => updateForm("sqft", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-year-built">Year built</Label>
                      <Input
                        id="edit-year-built"
                        value={form.yearBuilt}
                        onChange={(event) => updateForm("yearBuilt", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-public-mode">Public experience</Label>
                      <Select
                        value={form.publicMode}
                        onValueChange={(value) =>
                          updateForm("publicMode", value as EventFormState["publicMode"])
                        }
                      >
                        <SelectTrigger id="edit-public-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open_house">Open House</SelectItem>
                          <SelectItem value="listing_inquiry">Listing Inquiry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Status</Label>
                      <Select value={form.status} onValueChange={(value) => updateForm("status", value)}>
                        <SelectTrigger id="edit-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border/60 bg-muted/[0.18] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Internal scheduling
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      OpenHouse manages the internal event window automatically. The public link stays reusable after the live open house, so agents no longer need to manage start and end times here.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={form.propertyDescription}
                      onChange={(event) => updateForm("propertyDescription", event.target.value)}
                      rows={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-compliance">Compliance Text</Label>
                    <Textarea
                      id="edit-compliance"
                      value={form.complianceText}
                      onChange={(event) => updateForm("complianceText", event.target.value)}
                      rows={4}
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-border/60 bg-muted/[0.18] p-5">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Import snapshot</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Imported data is stored on the event record so future Q&A and reports use the same listing facts.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-border/60 bg-background/85 p-4 text-sm text-muted-foreground">
                    <p>
                      Source: <span className="font-medium text-foreground">{importedSource}</span>
                    </p>
                    <p className="mt-2">
                      Photos: <span className="font-medium text-foreground">{importedPhotoCount}</span>
                    </p>
                    <p className="mt-2">
                      AI FAQ pairs: <span className="font-medium text-foreground">{importedFaqCount}</span>
                    </p>
                    {form.importSummary?.headline ? (
                      <p className="mt-3 text-xs leading-relaxed">{form.importSummary.headline}</p>
                    ) : (
                      <p className="mt-3 text-xs leading-relaxed">
                        No import snapshot yet. You can still backfill the record from MLS, address search, or a PDF flyer.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">MLS #:</span> {event.mlsNumber || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Price:</span>{" "}
                  {event.listPrice ? `$${Number(event.listPrice).toLocaleString()}` : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Public experience:</span>{" "}
                  {formatPublicModeLabel(event.publicMode)}
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span> {event.propertyType ? formatPropertyTypeLabel(event.propertyType) : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Beds/Baths:</span> {event.bedrooms || "—"}/{event.bathrooms || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Sqft:</span> {event.sqft?.toLocaleString() || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Year built:</span> {event.yearBuilt || "—"}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Description:</span> {event.propertyDescription || "—"}
                </div>
                {event.complianceText ? (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Compliance:</span> {event.complianceText}
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-border/60 bg-muted/[0.18] p-4 text-sm text-muted-foreground">
                <p>
                  Import source: <span className="font-medium text-foreground">{importedSource}</span>
                </p>
                <p className="mt-2">
                  Stored photos: <span className="font-medium text-foreground">{importedPhotoCount}</span>
                </p>
                <p className="mt-2">
                  AI FAQ pairs: <span className="font-medium text-foreground">{importedFaqCount}</span>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Sign-ins ({signIns.length})</CardTitle>
          <div className="flex gap-2">
            <Link href={`/dashboard/events/${id}/report`}>
              <Button variant="outline" size="sm">Seller Report</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => window.open(`/api/events/${id}/export/csv`)}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {signIns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sign-ins yet. Share the sign-in link or start kiosk mode.
            </p>
          ) : (
            <div className="space-y-2">
              {signIns.map((signIn) => (
                <div
                  key={signIn.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 p-3 transition-colors hover:border-emerald-500/20"
                >
                  <div>
                    <p className="text-sm font-medium">{signIn.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[signIn.phone, signIn.email].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {signIn.interestLevel && INTEREST_BADGE[signIn.interestLevel] ? (
                      <Badge className={`${INTEREST_BADGE[signIn.interestLevel].className} text-xs`}>
                        {INTEREST_BADGE[signIn.interestLevel].label}
                      </Badge>
                    ) : null}
                    {signIn.isPreApproved === "yes" ? (
                      <Badge className="border-blue-500/30 bg-blue-500/10 text-xs text-blue-400">
                        Pre-Approved
                      </Badge>
                    ) : null}
                    <Badge variant="secondary" className="text-xs">
                      {formatPublicModeLabel(
                        inferCaptureMode({
                          captureMode: signIn.captureMode,
                          eventPublicMode: event.publicMode,
                          signedInAt: signIn.signedInAt,
                          eventEndTime: event.endTime,
                        })
                      )}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(signIn.signedInAt), "h:mm a")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
