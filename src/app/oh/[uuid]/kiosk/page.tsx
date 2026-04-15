"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import {
  Loader2,
  CheckCircle2,
  Home,
  MapPin,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Maximize,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { OptionButtonGroup } from "@/components/ui/option-button-group";
import { BrandLockup } from "@/components/brand-lockup";
import Image, { type ImageLoaderProps } from "next/image";
import { publicSignInSchema } from "@/lib/public-signin";
import {
  getKioskQueueSummary,
  listQueuedKioskSignIns,
  markKioskSignInFailed,
  markKioskSignInPending,
  queueKioskSignIn,
  readCachedKioskEvent,
  readLastKioskSyncAt,
  removeQueuedKioskSignIn,
  requestPersistentKioskStorage,
  writeCachedKioskEvent,
  writeLastKioskSyncAt,
} from "@/lib/kiosk-offline";

interface EventInfo {
  uuid: string;
  propertyAddress: string;
  listPrice: string | null;
  publicMode: string;
  branding: { logoUrl?: string; primaryColor?: string; tagline?: string; flyerImageUrl?: string } | null;
  customFields: Array<{ label: string; type: "text" | "select"; options?: string[] }> | null;
  complianceText: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  sqft: number | null;
  propertyPhotos: string[] | null;
  propertyDescription: string | null;
  marketing: {
    headline: string | null;
    summary: string | null;
    highlights: string[];
  };
}

type Phase = "loading" | "welcome" | "form" | "thanks" | "error";

const passthroughLoader = ({ src }: ImageLoaderProps) => src;
const THANK_YOU_RESET_MS = 3000;
const SYNC_POLL_INTERVAL_MS = 30000;

function buildSubmissionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatLastSync(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function KioskStatusBanner(props: {
  online: boolean;
  pendingCount: number;
  failedCount: number;
  syncing: boolean;
  usingCachedEvent: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
}) {
  const { online, pendingCount, failedCount, syncing, usingCachedEvent, lastSyncAt, syncError } = props;
  const lastSyncedLabel = formatLastSync(lastSyncAt);
  const toneClasses = !online
    ? "border-amber-300/60 bg-amber-50 text-amber-950"
    : failedCount > 0
      ? "border-rose-300/60 bg-rose-50 text-rose-950"
      : pendingCount > 0 || syncing || usingCachedEvent
        ? "border-sky-300/60 bg-sky-50 text-sky-950"
        : "border-emerald-300/60 bg-emerald-50 text-emerald-950";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-20 flex justify-center px-4">
      <div className={`pointer-events-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg shadow-emerald-900/5 backdrop-blur ${toneClasses}`}>
        {!online ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="font-medium">Offline mode</span>
          </>
        ) : syncing ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="font-medium">Syncing sign-ins</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4" />
            <span className="font-medium">Connected</span>
          </>
        )}

        {usingCachedEvent ? <span className="opacity-80">Using cached event details</span> : null}
        {pendingCount > 0 ? <span className="opacity-80">{pendingCount} pending</span> : null}
        {failedCount > 0 ? <span className="opacity-80">{failedCount} need review</span> : null}
        {lastSyncedLabel ? <span className="opacity-70">Last sync {lastSyncedLabel}</span> : null}
        {syncError ? (
          <>
            <AlertTriangle className="h-4 w-4" />
            <span className="opacity-80">{syncError}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function KioskPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = use(params);
  const [phase, setPhase] = useState<Phase>("loading");
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [usingCachedEvent, setUsingCachedEvent] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hasAgent, setHasAgent] = useState("");
  const [isPreApproved, setIsPreApproved] = useState("");
  const [interestLevel, setInterestLevel] = useState("");
  const [buyingTimeline, setBuyingTimeline] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [didAutoExpandOptionalDetails, setDidAutoExpandOptionalDetails] = useState(false);

  const syncInFlightRef = useRef(false);

  const refreshQueueState = useCallback(async () => {
    const summary = await getKioskQueueSummary(uuid);
    setPendingCount(summary.pendingCount);
    setFailedCount(summary.failedCount);
    setLastSyncAt(await readLastKioskSyncAt(uuid));
    setSyncError(summary.lastError);
  }, [uuid]);

  const resetForm = useCallback(() => {
    setFullName("");
    setPhone("");
    setEmail("");
    setHasAgent("");
    setIsPreApproved("");
    setInterestLevel("");
    setBuyingTimeline("");
    setPriceRange("");
    setCustomAnswers({});
    setShowOptionalDetails(false);
    setDidAutoExpandOptionalDetails(false);
  }, []);

  const flushQueuedSignIns = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.onLine || syncInFlightRef.current) {
      return;
    }

    const queue = (await listQueuedKioskSignIns(uuid)).filter(
      (item) => item.status === "pending"
    );

    if (queue.length === 0) {
      await refreshQueueState();
      return;
    }

    syncInFlightRef.current = true;
    setSyncing(true);

    try {
      for (const item of queue) {
        try {
          const response = await fetch(`/api/public/event/${uuid}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-openhouse-kiosk": "1",
            },
            body: JSON.stringify(item.payload),
          });

          if (response.ok) {
            await removeQueuedKioskSignIn(uuid, item.clientSubmissionId);
            await writeLastKioskSyncAt(uuid, new Date().toISOString());
            continue;
          }

          const errorBody = await response.json().catch(() => null);
          const message =
            typeof errorBody?.error === "string"
              ? errorBody.error
              : `Sync failed (${response.status})`;

          if ([400, 403, 404].includes(response.status)) {
            await markKioskSignInFailed(uuid, item.clientSubmissionId, message);
            continue;
          }

          await markKioskSignInPending(uuid, item.clientSubmissionId, message);
          break;
        } catch {
          await markKioskSignInPending(
            uuid,
            item.clientSubmissionId,
            "Waiting for connection"
          );
          break;
        }
      }
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
      await refreshQueueState();
    }
  }, [refreshQueueState, uuid]);

  useEffect(() => {
    let active = true;
    void requestPersistentKioskStorage();

    void (async () => {
      const cachedEvent = await readCachedKioskEvent<EventInfo>(uuid);

      if (!active) {
        return;
      }

      if (cachedEvent) {
        setEvent(cachedEvent);
        setUsingCachedEvent(true);
        setPhase("welcome");
      }

      await refreshQueueState();

      try {
        const response = await fetch(`/api/public/event/${uuid}`);

        if (!response.ok) {
          throw new Error("Not found");
        }

        const data = (await response.json()) as EventInfo;

        if (!active) {
          return;
        }

        setEvent(data);
        await writeCachedKioskEvent(uuid, data);
        setUsingCachedEvent(false);
        setPhase("welcome");

        if (navigator.onLine) {
          void flushQueuedSignIns();
        }
      } catch {
        if (!active) {
          return;
        }

        if (cachedEvent) {
          setEvent(cachedEvent);
          setUsingCachedEvent(true);
          setPhase("welcome");
          setSyncError(
            (current) =>
              current ?? "Offline. New sign-ins will sync when the iPad reconnects."
          );
          return;
        }

        setPhase("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [flushQueuedSignIns, refreshQueueState, uuid]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setSyncError(null);
      void flushQueuedSignIns();
    };

    const handleOffline = () => {
      setOnline(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void flushQueuedSignIns();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [flushQueuedSignIns]);

  useEffect(() => {
    if (!online || pendingCount === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void flushQueuedSignIns();
    }, SYNC_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [flushQueuedSignIns, online, pendingCount]);

  const handleSubmit = async (eventSubmit: React.FormEvent) => {
    eventSubmit.preventDefault();
    setSubmitting(true);

    const payload = {
      clientSubmissionId: buildSubmissionId(),
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      hasAgent: hasAgent ? hasAgent === "yes" : undefined,
      isPreApproved: isPreApproved || undefined,
      interestLevel: interestLevel || undefined,
      buyingTimeline: buyingTimeline || undefined,
      priceRange: priceRange || undefined,
      customAnswers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
    };

    const validation = publicSignInSchema.safeParse(payload);

    if (!validation.success) {
      setSyncError(validation.error.issues[0]?.message ?? "Please finish the required fields.");
      setSubmitting(false);
      return;
    }

    const queued = await queueKioskSignIn(uuid, {
      clientSubmissionId: validation.data.clientSubmissionId!,
      payload: validation.data as typeof validation.data & { clientSubmissionId: string },
      queuedAt: new Date().toISOString(),
      syncAttempts: 0,
      status: "pending",
      lastError: null,
    });

    if (!queued) {
      setSyncError("This iPad could not save the sign-in offline.");
      setSubmitting(false);
      return;
    }

    await refreshQueueState();
    setSyncError(null);
    setPhase("thanks");
    resetForm();
    window.setTimeout(() => setPhase("welcome"), THANK_YOU_RESET_MS);
    setSubmitting(false);

    if (navigator.onLine) {
      void flushQueuedSignIns();
    }
  };

  const color = event?.branding?.primaryColor || "#10b981";
  const heroImage = event?.propertyPhotos?.[0] || event?.branding?.flyerImageUrl || null;

  // Only show the status banner for non-idle states — hide it when fully connected and up-to-date
  const showBanner = !online || syncing || pendingCount > 0 || failedCount > 0 || usingCachedEvent || !!syncError;
  const handleOptionalDetailsFocusCapture = useCallback(() => {
    if (didAutoExpandOptionalDetails) {
      return;
    }

    setShowOptionalDetails(true);
    setDidAutoExpandOptionalDetails(true);
  }, [didAutoExpandOptionalDetails]);

  const enterFullscreen = useCallback(() => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (el.requestFullscreen) {
      void el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      void el.webkitRequestFullscreen();
    }
  }, []);

  const statusBanner = showBanner ? (
    <KioskStatusBanner
      online={online}
      pendingCount={pendingCount}
      failedCount={failedCount}
      syncing={syncing}
      usingCachedEvent={usingCachedEvent}
      lastSyncAt={lastSyncAt}
      syncError={syncError}
    />
  ) : null;

  if (phase === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-cyan-50">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color }} />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-8 text-center">
        <div>
          <Home className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-bold">Event Not Found</h1>
          <p className="text-muted-foreground">
            This iPad has not cached the event yet. Open the kiosk once while online to enable offline sign-ins.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "welcome") {
    return (
      <>
        {statusBanner}
        <div
          className="fixed inset-0 cursor-pointer bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-8 pt-20 text-center"
          onClick={() => setPhase("form")}
        >
          <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center">
            <div className="w-full rounded-[2rem] border border-border/60 bg-white/92 px-10 py-12 shadow-2xl shadow-emerald-900/5 backdrop-blur">
              {heroImage && (
                <Image
                  loader={passthroughLoader}
                  unoptimized
                  src={heroImage}
                  alt={event?.propertyAddress || "Property photo"}
                  width={1440}
                  height={720}
                  className="mb-6 h-60 w-full rounded-[1.5rem] object-cover"
                />
              )}
              <div className="mb-4 inline-flex rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
                <BrandLockup compact />
              </div>
              <h1 className="mb-3 text-4xl font-bold">{event?.marketing?.headline || "Welcome"}</h1>
              <p className="mb-2 inline-flex items-center gap-2 text-xl">
                <MapPin className="h-5 w-5" style={{ color }} />
                {event?.propertyAddress}
              </p>
              {event?.listPrice && (
                <p className="mb-4 text-2xl font-bold" style={{ color }}>
                  ${Number(event.listPrice).toLocaleString()}
                </p>
              )}
              {event?.marketing?.summary && (
                <p className="mx-auto mb-6 max-w-3xl text-base leading-7 text-muted-foreground">
                  {event.marketing.summary}
                </p>
              )}
              <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
                {event?.bedrooms ? (
                  <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                    {event.bedrooms} beds
                  </span>
                ) : null}
                {event?.bathrooms ? (
                  <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                    {event.bathrooms} baths
                  </span>
                ) : null}
                {event?.sqft ? (
                  <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                    {event.sqft.toLocaleString()} sqft
                  </span>
                ) : null}
              </div>
              <div
                className="mx-auto inline-flex rounded-2xl px-10 py-4 text-xl font-semibold text-white animate-breathe"
                style={{ backgroundColor: color }}
              >
                Tap to Sign In
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              enterFullscreen();
            }}
            className="fixed bottom-6 right-6 z-30 rounded-full border border-border/60 bg-white/90 p-3 shadow-lg backdrop-blur"
            aria-label="Enter fullscreen"
          >
            <Maximize className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </>
    );
  }

  if (phase === "thanks") {
    return (
      <>
        {statusBanner}
        <div className="fixed inset-0 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-8 pt-20 text-center">
          <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center">
            <div className="w-full rounded-[2rem] border border-border/60 bg-white/92 px-10 py-12 shadow-2xl shadow-emerald-900/5 backdrop-blur">
              <div
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}18` }}
              >
                <CheckCircle2 className="h-10 w-10" style={{ color }} />
              </div>
              <h1 className="mb-3 text-4xl font-bold">Thank You!</h1>
              <p className="text-xl text-muted-foreground">
                {online ? "The agent has your details now." : "Saved on this iPad and waiting to sync."}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">Next visitor in a moment...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {statusBanner}
      <div className="fixed inset-0 overflow-auto bg-gradient-to-br from-emerald-50 via-white to-cyan-50 pt-20" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="mx-auto max-w-xl px-6 py-8">
          <div className="mb-6 text-center">
            {heroImage && (
              <Image
                loader={passthroughLoader}
                unoptimized
                src={heroImage}
                alt={event?.propertyAddress || "Property photo"}
                width={1200}
                height={640}
                className="mb-5 h-44 w-full rounded-[1.5rem] object-cover shadow-lg shadow-emerald-900/8"
              />
            )}
            <div className="mb-3 inline-flex rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
              <BrandLockup compact />
            </div>
            <h1 className="mb-1 text-2xl font-bold">{event?.marketing?.headline || "Sign In"}</h1>
            <p className="text-sm text-muted-foreground">{event?.propertyAddress}</p>
            {event?.marketing?.summary && (
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                {event.marketing.summary}
              </p>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            onFocusCapture={handleOptionalDetailsFocusCapture}
            className="space-y-4 rounded-[1.75rem] border border-border/60 bg-white/92 p-6 shadow-2xl shadow-emerald-900/5 backdrop-blur"
          >
            <div>
              <label className="mb-1.5 block text-sm text-foreground/90">Full Name *</label>
              <Input
                className="h-14 border-border/70 bg-white text-lg"
                placeholder="Your full name"
                value={fullName}
                onChange={(eventChange) => setFullName(eventChange.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-foreground/90">Phone *</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-14 border-border/70 bg-white pl-9 text-lg"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(eventChange) => setPhone(eventChange.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-foreground/90">Email *</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-14 border-border/70 bg-white pl-9 text-lg"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(eventChange) => setEmail(eventChange.target.value)}
                  required
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/15">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                onClick={() => setShowOptionalDetails((current) => !current)}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">Optional buying details</p>
                  <p className="text-xs text-muted-foreground">
                    These help the listing agent qualify follow-up and prioritize next steps.
                  </p>
                </div>
                {showOptionalDetails ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {showOptionalDetails ? (
                <div className="space-y-4 border-t border-border/50 px-4 pb-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm text-foreground/90">Working with an agent?</label>
                      <OptionButtonGroup
                        value={hasAgent}
                        onChange={setHasAgent}
                        accentColor={color}
                        equalWidth
                        options={[
                          { value: "yes", label: "Yes" },
                          { value: "no", label: "No" },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm text-foreground/90">Pre-approved?</label>
                      <OptionButtonGroup
                        value={isPreApproved}
                        onChange={setIsPreApproved}
                        accentColor={color}
                        equalWidth
                        options={[
                          { value: "yes", label: "Yes" },
                          { value: "no", label: "No" },
                        ]}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-foreground/90">Interest level</label>
                    <OptionButtonGroup
                      value={interestLevel}
                      onChange={setInterestLevel}
                      accentColor={color}
                      options={[
                        { value: "very", label: "Very Interested" },
                        { value: "somewhat", label: "Somewhat Interested" },
                        { value: "just_looking", label: "Just Looking" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-foreground/90">Buying timeline</label>
                    <OptionButtonGroup
                      value={buyingTimeline}
                      onChange={setBuyingTimeline}
                      accentColor={color}
                      options={[
                        { value: "0_3_months", label: "0–3 months" },
                        { value: "3_6_months", label: "3–6 months" },
                        { value: "6_12_months", label: "6–12 months" },
                        { value: "over_12_months", label: "12+ months" },
                        { value: "just_browsing", label: "Just browsing" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-foreground/90">Budget / price range</label>
                    <Input
                      className="border-border/70 bg-white"
                      value={priceRange}
                      placeholder="Example: $800k-$1.0M or under $1.2M"
                      onChange={(eventChange) => setPriceRange(eventChange.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {event?.customFields && event.customFields.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
                {event.customFields.map((field, index) => (
                  <div key={index} className="space-y-2">
                    <label className="block text-sm text-foreground/90">{field.label}</label>
                    {field.type === "select" && field.options ? (
                      <OptionButtonGroup
                        value={customAnswers[field.label] || ""}
                        onChange={(nextValue) =>
                          setCustomAnswers((current) => ({ ...current, [field.label]: nextValue }))
                        }
                        accentColor={color}
                        options={field.options.map((option) => ({ value: option, label: option }))}
                      />
                    ) : (
                      <Input
                        value={customAnswers[field.label] || ""}
                        onChange={(eventChange) =>
                          setCustomAnswers((current) => ({
                            ...current,
                            [field.label]: eventChange.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              className="h-14 w-full rounded-2xl text-lg font-semibold text-white shadow-lg shadow-emerald-900/10"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
              disabled={submitting}
            >
              {submitting ? "Saving..." : online ? "Continue" : "Save Offline"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
