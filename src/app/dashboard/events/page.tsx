"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plus,
  QrCode,
  Users,
  MoreHorizontal,
  Copy,
  Download,
  ExternalLink,
  Trash2,
  Flame,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { openHousePropertyTypes, type EventImportDraft } from "@/lib/listing-import-shared";
import {
  clearNewEventDialogRequest,
  consumeNewEventDialogRequest,
  subscribeToNewEventDialogRequest,
} from "@/lib/new-event-trigger";
import { formatPublicModeLabel } from "@/lib/public-mode";

interface OHEvent {
  id: number;
  uuid: string;
  propertyAddress: string;
  mlsNumber: string | null;
  listPrice: string | null;
  startTime: string;
  endTime: string;
  publicMode: string;
  status: string;
  featureAccessTier: "free" | "trial_pro" | "pro";
  proTrialExpiresAt?: string | null;
  totalSignIns: number;
  hotLeadsCount: number;
  branding: Record<string, string> | null;
  customFields: Array<{ label: string; type: string; options?: string[] }> | null;
}

interface WorkspaceTrialStatus {
  tier: "free" | "pro";
  proTrialLaunchesUsed: number;
  proTrialLaunchesRemaining: number;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  completed: { label: "Completed", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  cancelled: { label: "Cancelled", className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const STATUS_FILTER = ["all", "draft", "active", "completed", "cancelled"];

function createInitialFormState(): EventFormState {
  return {
    ...createEmptyEventFormState(),
    status: "active",
  };
}

function formatPropertyTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hasActiveTrialFeature(event: OHEvent) {
  return (
    event.featureAccessTier === "trial_pro" &&
    Boolean(event.proTrialExpiresAt) &&
    new Date(event.proTrialExpiresAt as string) > new Date()
  );
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<OHEvent[]>([]);
  const [workspaceTrialStatus, setWorkspaceTrialStatus] = useState<WorkspaceTrialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<EventFormState>(() => createInitialFormState());

  const fetchEvents = useCallback(async () => {
    try {
      const [eventsRes, billingRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/billing/status"),
      ]);

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data);
      }

      if (billingRes.ok) {
        const billingData = await billingRes.json();
        setWorkspaceTrialStatus({
          tier: billingData.tier,
          proTrialLaunchesUsed: billingData.proTrialLaunchesUsed,
          proTrialLaunchesRemaining: billingData.proTrialLaunchesRemaining,
        });
      }
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (consumeNewEventDialogRequest()) {
      setDialogOpen(true);
      const query = new URLSearchParams(window.location.search);
      if (query.get("new") === "1") {
        router.replace("/dashboard/events", { scroll: false });
      }
    }

    return subscribeToNewEventDialogRequest(() => {
      clearNewEventDialogRequest();
      setDialogOpen(true);
      const query = new URLSearchParams(window.location.search);
      if (query.get("new") === "1") {
        router.replace("/dashboard/events", { scroll: false });
      }
    });
  }, [router]);

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open && !creating) {
      setForm(createInitialFormState());
      clearNewEventDialogRequest();
      const query = new URLSearchParams(window.location.search);
      if (query.get("new") === "1") {
        router.replace("/dashboard/events", { scroll: false });
      }
    }
  };

  const updateForm = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleApplyDraft = (draft: EventImportDraft) => {
    setForm((current) => applyImportedDraft(current, draft));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildEventPayload(form)),
      });

      if (res.ok) {
        toast.success("Open house created");
        setDialogOpen(false);
        setForm(createInitialFormState());
        clearNewEventDialogRequest();
        const query = new URLSearchParams(window.location.search);
        if (query.get("new") === "1") {
          router.replace("/dashboard/events", { scroll: false });
        }
        fetchEvents();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create event");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this event and all its sign-in data?")) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Event deleted");
        fetchEvents();
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleCopyLink = (uuid: string) => {
    const url = `${window.location.origin}/oh/${uuid}`;
    navigator.clipboard.writeText(url);
    toast.success("Sign-in link copied");
  };

  const handleDownloadQr = async (event: OHEvent) => {
    try {
      const res = await fetch(`/api/events/${event.id}/qr`);
      if (!res.ok) {
        throw new Error("Unable to generate QR code");
      }
      const shareKit = (await res.json()) as { qrDataUrl: string };
      const link = document.createElement("a");
      link.href = shareKit.qrDataUrl;
      link.download = `${event.propertyAddress
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()}-qr.png`;
      link.click();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download QR code");
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast.success(`Status updated to ${status}`);
      fetchEvents();
    } catch {
      toast.error("Failed to update");
    }
  };

  const filteredEvents = filter === "all" ? events : events.filter((event) => event.status === filter);
  const importedPhotoCount = form.propertyPhotos.length;
  const importedFaqCount = form.aiQaContext?.customFaq?.length ?? 0;
  const totalCaptures = events.reduce((sum, event) => sum + event.totalSignIns, 0);
  const activeLinks = events.filter((event) => event.status === "active" || event.status === "completed").length;
  const listingInquiryLinks = events.filter((event) => event.publicMode === "listing_inquiry").length;
  const sellerReportsReady = events.filter((event) => event.totalSignIns > 0).length;
  const launchPlaybook = [
    {
      title: "Import the listing",
      description: "Start from MLS, address, or flyer so the public page and seller report share the same facts.",
      icon: CalendarDays,
    },
    {
      title: "Publish one reusable link",
      description: "Use the same branded URL for QR, kiosk, buyer agents, and long-tail inquiry traffic.",
      icon: QrCode,
    },
    {
      title: "Bring the seller story back",
      description: "Report on on-site traffic, later inquiries, and hot leads without rebuilding the recap manually.",
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Open Houses</h1>
          <p className="mt-1 text-muted-foreground">
            Import the listing once, publish one reusable link, and keep seller reporting tight.
            Free workspaces get Pro features on their first 3 published launches.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="border-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700">
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create Event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="mt-2 space-y-6">
              <EventImportAssistant onApplyDraft={handleApplyDraft} />

              <div className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
                <div className="space-y-6 rounded-3xl border border-border/60 bg-background/80 p-5 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Property details</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Imported values stay editable so agents can clean up the final event record.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-address">Property address *</Label>
                    <Input
                      id="create-address"
                      placeholder="123 Main St, New York, NY 10001"
                      value={form.propertyAddress}
                      onChange={(event) => updateForm("propertyAddress", event.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="create-mls">MLS #</Label>
                      <Input
                        id="create-mls"
                        placeholder="Optional"
                        value={form.mlsNumber}
                        onChange={(event) => updateForm("mlsNumber", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-price">List price</Label>
                      <Input
                        id="create-price"
                        placeholder="650000"
                        value={form.listPrice}
                        onChange={(event) => updateForm("listPrice", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.8fr)]">
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="create-property-type">Property type</Label>
                      <Select
                        value={form.propertyType || "none"}
                        onValueChange={(value) =>
                          updateForm(
                            "propertyType",
                            value === "none" ? "" : (value as EventFormState["propertyType"])
                          )
                        }
                      >
                        <SelectTrigger id="create-property-type" className="w-full min-w-0">
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
                      <Label htmlFor="create-beds">Beds</Label>
                      <Input
                        id="create-beds"
                        inputMode="numeric"
                        placeholder="3"
                        value={form.bedrooms}
                        onChange={(event) => updateForm("bedrooms", event.target.value)}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="create-baths">Baths</Label>
                      <Input
                        id="create-baths"
                        inputMode="decimal"
                        placeholder="2.5"
                        value={form.bathrooms}
                        onChange={(event) => updateForm("bathrooms", event.target.value)}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="create-sqft">Sqft</Label>
                      <Input
                        id="create-sqft"
                        inputMode="numeric"
                        placeholder="1840"
                        value={form.sqft}
                        onChange={(event) => updateForm("sqft", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="create-year-built">Year built</Label>
                      <Input
                        id="create-year-built"
                        inputMode="numeric"
                        placeholder="2008"
                        value={form.yearBuilt}
                        onChange={(event) => updateForm("yearBuilt", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-public-mode">Public experience</Label>
                      <Select
                        value={form.publicMode}
                        onValueChange={(value) =>
                          updateForm("publicMode", value as EventFormState["publicMode"])
                        }
                      >
                        <SelectTrigger id="create-public-mode">
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
                      <Label htmlFor="create-status">Initial status</Label>
                      <Select value={form.status} onValueChange={(value) => updateForm("status", value)}>
                        <SelectTrigger id="create-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-description">Property description</Label>
                    <Textarea
                      id="create-description"
                      placeholder="Tell visitors about the listing, key upgrades, layout, or lifestyle story."
                      value={form.propertyDescription}
                      onChange={(event) => updateForm("propertyDescription", event.target.value)}
                      rows={5}
                    />
                  </div>
                </div>

                <div className="space-y-6 rounded-3xl border border-border/60 bg-muted/[0.18] p-5 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Publishing defaults</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      OpenHouse now manages the internal event window automatically. You only choose the public experience and any compliance copy you want shown.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-border/60 bg-background/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Public mode
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      {formatPublicModeLabel(form.publicMode)}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {form.publicMode === "listing_inquiry"
                        ? "Use the same link long-term for buyer agents and off-site prospects. The sign-in page behaves more like a property inquiry flow."
                        : "Keep the classic open house sign-in flow for on-site traffic, then continue collecting leads from the same link afterward."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-compliance">Compliance text</Label>
                    <Textarea
                      id="create-compliance"
                      placeholder="Optional fair housing, consent, or brokerage disclosures to show on sign-in."
                      value={form.complianceText}
                      onChange={(event) => updateForm("complianceText", event.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="rounded-3xl border border-border/60 bg-background/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Imported context snapshot
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p>
                        Source: <span className="font-medium text-foreground">{form.importSummary?.source || "manual"}</span>
                      </p>
                      <p>
                        Photos: <span className="font-medium text-foreground">{importedPhotoCount}</span>
                      </p>
                      <p>
                        AI FAQ pairs: <span className="font-medium text-foreground">{importedFaqCount}</span>
                      </p>
                      {form.importSummary?.headline ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">{form.importSummary.headline}</p>
                      ) : (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Use MLS, address, or flyer import to prefill the event and seed AI Q&A context.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full border-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                disabled={creating}
              >
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Event
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/60 bg-card/70">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Active listing links
              </p>
              <div className="mt-3 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-500" />
                <span className="font-mono text-2xl font-semibold">{activeLinks}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Live or reusable public links currently available to share.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Listing inquiry links
              </p>
              <div className="mt-3 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-sky-500" />
                <span className="font-mono text-2xl font-semibold">{listingInquiryLinks}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Events already positioned for long-tail buyer and buyer-agent traffic.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Captured leads
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-teal-500" />
                <span className="font-mono text-2xl font-semibold">{totalCaptures}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Total sign-ins and listing inquiries currently stored across this workspace.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Seller reports ready
              </p>
              <div className="mt-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500" />
                <span className="font-mono text-2xl font-semibold">{sellerReportsReady}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Listings with captured demand already ready for a seller-facing recap.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!loading ? (
        workspaceTrialStatus?.tier === "free" ? (
          <Card className="border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.08] via-background to-teal-500/[0.05]">
            <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  3 Pro launch trial
                </p>
                <h2 className="text-lg font-semibold">
                  {workspaceTrialStatus.proTrialLaunchesUsed} / 3 published launches used
                </h2>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {workspaceTrialStatus.proTrialLaunchesRemaining > 0
                    ? `Your next ${workspaceTrialStatus.proTrialLaunchesRemaining} published launch${workspaceTrialStatus.proTrialLaunchesRemaining === 1 ? "" : "es"} still include AI scoring, sign-in-gated property Q&A, AI follow-up, and mailbox sending.`
                    : "You have used the 3 included Pro launches. Upgrade to keep AI qualification, follow-up, and seller attribution on every new listing."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="rounded-2xl border border-border/50 bg-background/80 px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Remaining
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {workspaceTrialStatus.proTrialLaunchesRemaining}
                  </p>
                </div>
                <Link href="/dashboard/settings">
                  <Button variant="outline">Review plan</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null
      ) : null}

      {!loading ? (
        <Card className="border-border/60 bg-gradient-to-br from-background via-card/70 to-muted/30">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Launch playbook
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">
                OpenHouse should feel like one listing workflow, not three disconnected tools.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The strongest setups follow the same path every time: import the listing, publish one reusable share page, then turn the captured demand into a seller-ready story.
              </p>
            </div>
            {/* Vertical stacked list — avoids banned 3-col equal layout */}
            <div className="flex flex-col gap-3">
              {launchPlaybook.map((item, index) => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-2xl border border-border/50 bg-background/80 p-4 shadow-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">0{index + 1}</span>
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-2">
        {STATUS_FILTER.map((status) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(status)}
            className={
              filter === status
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                : ""
            }
          >
            {status === "all" ? "All" : STATUS_BADGE[status]?.label || status}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="grid gap-6 py-16 text-center lg:grid-cols-[0.9fr_1.1fr] lg:text-left">
            <div className="flex flex-col items-center justify-center lg:items-start">
              <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-semibold">No events yet</h3>
              <p className="mb-5 max-w-md text-sm text-muted-foreground">
                Start with MLS, address, or flyer import. The goal is one reusable listing link you can share at the open house, after the event, and in the seller recap.
              </p>
              <Button
                onClick={() => setDialogOpen(true)}
                className="border-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Open House
              </Button>
            </div>
            {/* Stacked — avoids banned 3-col equal layout in empty state */}
            <div className="flex flex-col gap-3">
              {launchPlaybook.map((item) => (
                <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-border/50 bg-background/80 p-4 text-left">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold">{item.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredEvents.map((event) => (
            <Card
              key={event.id}
              className="cursor-pointer border-border/50 transition-all hover:border-emerald-500/20 hover:shadow-md hover:shadow-emerald-950/5"
              onClick={() => router.push(`/dashboard/events/${event.id}`)}
            >
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="truncate text-base font-semibold">{event.propertyAddress}</h3>
                      <Badge className={STATUS_BADGE[event.status]?.className || ""}>
                        {STATUS_BADGE[event.status]?.label || event.status}
                      </Badge>
                      <Badge variant="secondary">{formatPublicModeLabel(event.publicMode)}</Badge>
                      {hasActiveTrialFeature(event) ? (
                        <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700">
                          Trial Pro
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Reusable sign-in link</span>
                      {event.mlsNumber ? <span>MLS# {event.mlsNumber}</span> : null}
                      {event.listPrice ? <span>${Number(event.listPrice).toLocaleString()}</span> : null}
                    </div>
                  </div>

                  <div className="mr-2 flex items-center gap-6">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-lg font-bold">
                        <Users className="h-4 w-4 text-emerald-400" />
                        {event.totalSignIns}
                      </div>
                      <span className="text-xs text-muted-foreground">Sign-ins</span>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-lg font-bold">
                        <Flame className="h-4 w-4 text-orange-400" />
                        {event.hotLeadsCount}
                      </div>
                      <span className="text-xs text-muted-foreground">Hot Leads</span>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => window.open(`/api/events/${event.id}/export/csv`)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {event.status === "draft" ? (
                        <DropdownMenuItem onClick={() => handleStatusChange(event.id, "active")}>
                          Set Active
                        </DropdownMenuItem>
                      ) : null}
                      {event.status === "active" ? (
                        <DropdownMenuItem onClick={() => handleStatusChange(event.id, "completed")}>
                          Mark Completed
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => handleDelete(event.id)} className="text-red-400">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div
                  className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button variant="outline" size="sm" onClick={() => handleCopyLink(event.uuid)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Link
                  </Button>
                  <Link href={`/oh/${event.uuid}`} target="_blank">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Link
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadQr(event)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download QR
                  </Button>
                  <Link href={`/oh/${event.uuid}/kiosk`} target="_blank">
                    <Button variant="outline" size="sm">
                      <QrCode className="mr-2 h-4 w-4" />
                      Kiosk
                    </Button>
                  </Link>
                  <Link href={`/dashboard/events/${event.id}/report`}>
                    <Button variant="outline" size="sm">
                      <FileText className="mr-2 h-4 w-4" />
                      Seller Report
                    </Button>
                  </Link>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Click anywhere else on the card for details
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
