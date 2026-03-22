"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EventAiQaContext, EventImportDraft, EventPropertyFacts } from "@/lib/listing-import-shared";
import { cn } from "@/lib/utils";
import {
  FileUp,
  Loader2,
  NotebookPen,
  ScanSearch,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

type AddressSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string | null;
  fullText: string;
  types: string[];
};

type ResolvedAddress = {
  placeId: string;
  formattedAddress: string;
  shortFormattedAddress: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  onApplyDraft: (draft: EventImportDraft) => void;
  className?: string;
};

type AddressImportRequest = {
  query: string;
  resolvedAddress?: ResolvedAddress | null;
};

type DraftResolution =
  | { kind: "single"; draft: EventImportDraft }
  | { kind: "multiple"; drafts: EventImportDraft[] }
  | { kind: "none"; message: string };

function DraftPreview({ draft }: { draft: EventImportDraft }) {
  return (
    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700">
          {draft.importSummary.source.toUpperCase()}
        </Badge>
        {draft.importSummary.badges.map((badge) => (
          <Badge key={badge} variant="outline" className="border-border/60 bg-background/70">
            {badge}
          </Badge>
        ))}
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">{draft.importSummary.headline}</p>
      {draft.importSummary.subheadline ? (
        <p className="mt-1 text-xs text-muted-foreground">{draft.importSummary.subheadline}</p>
      ) : null}
      {draft.propertyDescription ? (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {draft.propertyDescription}
        </p>
      ) : null}
    </div>
  );
}

function CandidateDraftCard({
  draft,
  onApply,
}: {
  draft: EventImportDraft;
  onApply: () => void;
}) {
  const score =
    typeof draft.importSummary.matchConfidence === "number"
      ? Math.round(draft.importSummary.matchConfidence * 100)
      : null;
  const statLine = [
    draft.bedrooms !== null ? `${draft.bedrooms} bd` : null,
    draft.bathrooms ? `${draft.bathrooms} ba` : null,
    draft.sqft !== null ? `${draft.sqft.toLocaleString()} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-3xl border border-border/60 bg-background/90 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700">
              {draft.importSummary.source.toUpperCase()}
            </Badge>
            {score !== null ? (
              <Badge variant="outline" className="border-sky-500/25 bg-sky-500/10 text-sky-700">
                {score}% match
              </Badge>
            ) : null}
            {draft.importSummary.provider ? (
              <Badge variant="outline" className="border-border/60 bg-background/70">
                {draft.importSummary.provider}
              </Badge>
            ) : null}
            {draft.importSummary.matchedBy ? (
              <Badge variant="outline" className="border-border/60 bg-background/70">
                {draft.importSummary.matchedBy}
              </Badge>
            ) : null}
          </div>

          <div>
            <p className="text-base font-semibold text-foreground">{draft.propertyAddress}</p>
            {draft.importSummary.subheadline ? (
              <p className="mt-1 text-sm text-muted-foreground">{draft.importSummary.subheadline}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {draft.listPrice ? (
              <span className="font-medium text-foreground">
                ${Number(draft.listPrice).toLocaleString()}
              </span>
            ) : null}
            {statLine ? <span>{statLine}</span> : null}
            {draft.mlsNumber ? <span>MLS {draft.mlsNumber}</span> : null}
          </div>

          {draft.propertyDescription ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {draft.propertyDescription}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {draft.importSummary.badges
              .filter(
                (badge) =>
                  !badge.toLowerCase().includes("match") &&
                  badge !== draft.importSummary.provider &&
                  badge !== draft.importSummary.matchedBy
              )
              .slice(0, 5)
              .map((badge) => (
                <Badge key={badge} variant="outline" className="border-border/60 bg-background/70">
                  {badge}
                </Badge>
              ))}
          </div>
        </div>

        <Button
          type="button"
          className="shrink-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
          onClick={onApply}
        >
          Apply this draft
        </Button>
      </div>
    </div>
  );
}

function detectQueryMode(query: string) {
  const value = query.trim();
  if (!value) {
    return "address" as const;
  }

  const looksLikeAddress =
    /\d/.test(value) &&
    (/[ ,]/.test(value) ||
      /\b(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|lane|ln|court|ct|terrace|ter|way|place|pl|parkway|pkwy)\b/i.test(
        value
      ));

  if (looksLikeAddress) {
    return "address" as const;
  }

  if (/^[A-Za-z0-9-]{5,}$/.test(value) && !/\s/.test(value)) {
    return "mls" as const;
  }

  return "address" as const;
}

function createPlacesSessionToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `places-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function buildProviderAddressQuery(address: ResolvedAddress) {
  return [
    address.addressLine1 || address.shortFormattedAddress || address.formattedAddress,
    [address.city, address.state, address.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function mergeText(primary?: string | null, secondary?: string | null, preferLonger = false) {
  const left = typeof primary === "string" && primary.trim() ? primary.trim() : null;
  const right = typeof secondary === "string" && secondary.trim() ? secondary.trim() : null;

  if (!left) return right;
  if (!right) return left;
  if (!preferLonger) return left;
  return right.length > left.length ? right : left;
}

function unionStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function mergeFaq(
  primary?: Array<{ question: string; answer: string }>,
  secondary?: Array<{ question: string; answer: string }>
) {
  const items = [...(primary ?? []), ...(secondary ?? [])];
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.question.trim().toLowerCase()}::${item.answer.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeRecordSections(
  primary?: Record<string, unknown> | null,
  secondary?: Record<string, unknown> | null
) {
  if (!primary && !secondary) {
    return undefined;
  }

  const merged: Record<string, unknown> = { ...(secondary ?? {}) };

  for (const [key, value] of Object.entries(primary ?? {})) {
    if (Array.isArray(value)) {
      merged[key] = unionStrings([
        ...value.map((item) => (typeof item === "string" ? item : null)),
        ...((Array.isArray(merged[key]) ? merged[key] : []) as unknown[]).map((item) =>
          typeof item === "string" ? item : null
        ),
      ]);
      continue;
    }

    merged[key] = value ?? merged[key];
  }

  return merged;
}

function mergePropertyFacts(
  primary?: EventPropertyFacts | Record<string, unknown> | null,
  secondary?: EventPropertyFacts | Record<string, unknown> | null
): EventPropertyFacts | undefined {
  if (!primary && !secondary) {
    return undefined;
  }

  const left = (primary ?? {}) as Record<string, unknown>;
  const right = (secondary ?? {}) as Record<string, unknown>;

  return {
    financial: mergeRecordSections(
      left.financial as Record<string, unknown> | undefined,
      right.financial as Record<string, unknown> | undefined
    ) as EventPropertyFacts["financial"],
    schools: mergeRecordSections(
      left.schools as Record<string, unknown> | undefined,
      right.schools as Record<string, unknown> | undefined
    ) as EventPropertyFacts["schools"],
    building: mergeRecordSections(
      left.building as Record<string, unknown> | undefined,
      right.building as Record<string, unknown> | undefined
    ) as EventPropertyFacts["building"],
    interior: mergeRecordSections(
      left.interior as Record<string, unknown> | undefined,
      right.interior as Record<string, unknown> | undefined
    ) as EventPropertyFacts["interior"],
    policies: mergeRecordSections(
      left.policies as Record<string, unknown> | undefined,
      right.policies as Record<string, unknown> | undefined
    ) as EventPropertyFacts["policies"],
    neighborhood: mergeRecordSections(
      left.neighborhood as Record<string, unknown> | undefined,
      right.neighborhood as Record<string, unknown> | undefined
    ) as EventPropertyFacts["neighborhood"],
    listing: mergeRecordSections(
      left.listing as Record<string, unknown> | undefined,
      right.listing as Record<string, unknown> | undefined
    ) as EventPropertyFacts["listing"],
  };
}

function mergeAiQaContexts(
  primary?: EventAiQaContext | null,
  secondary?: EventAiQaContext | null
): EventAiQaContext | null {
  if (!primary && !secondary) {
    return null;
  }

  const mergedFaq = mergeFaq(primary?.customFaq, secondary?.customFaq);
  const propertyFacts = mergePropertyFacts(primary?.propertyFacts, secondary?.propertyFacts);
  const mlsData = mergeRecordSections(primary?.mlsData, secondary?.mlsData);
  const nearbyPoi = mergeRecordSections(primary?.nearbyPoi, secondary?.nearbyPoi);
  const agentNotes = mergeText(primary?.agentNotes, secondary?.agentNotes, true);

  return {
    ...(mergedFaq.length > 0 ? { customFaq: mergedFaq } : {}),
    ...(mlsData ? { mlsData } : {}),
    ...(propertyFacts ? { propertyFacts } : {}),
    ...(nearbyPoi ? { nearbyPoi } : {}),
    ...(agentNotes ? { agentNotes } : {}),
  };
}

function mergeImportDrafts(primary: EventImportDraft, secondary: EventImportDraft) {
  return {
    propertyAddress: mergeText(primary.propertyAddress, secondary.propertyAddress) ?? "",
    mlsNumber: mergeText(primary.mlsNumber, secondary.mlsNumber),
    listPrice: mergeText(primary.listPrice, secondary.listPrice),
    propertyType: primary.propertyType ?? secondary.propertyType,
    bedrooms: primary.bedrooms ?? secondary.bedrooms,
    bathrooms: mergeText(primary.bathrooms, secondary.bathrooms),
    sqft: primary.sqft ?? secondary.sqft,
    yearBuilt: primary.yearBuilt ?? secondary.yearBuilt,
    propertyDescription:
      mergeText(primary.propertyDescription, secondary.propertyDescription, true) ?? null,
    propertyPhotos: unionStrings([...primary.propertyPhotos, ...secondary.propertyPhotos]),
    aiQaContext: mergeAiQaContexts(primary.aiQaContext, secondary.aiQaContext),
    importSummary: {
      source: primary.importSummary.source,
      headline: mergeText(primary.importSummary.headline, secondary.importSummary.headline) ?? "Imported listing draft",
      subheadline: mergeText(primary.importSummary.subheadline, secondary.importSummary.subheadline, true) ?? "",
      badges: unionStrings([
        ...primary.importSummary.badges,
        ...secondary.importSummary.badges,
        primary.importSummary.source !== secondary.importSummary.source
          ? `${secondary.importSummary.source.toUpperCase()} context`
          : null,
      ]),
    },
  } satisfies EventImportDraft;
}

function withAgentNotes(draft: EventImportDraft, notes: string) {
  const cleanNotes = notes.trim();
  if (!cleanNotes) {
    return draft;
  }

  return {
    ...draft,
    aiQaContext: mergeAiQaContexts(draft.aiQaContext, { agentNotes: cleanNotes }),
    importSummary: {
      ...draft.importSummary,
      badges: unionStrings([...draft.importSummary.badges, "Agent notes"]),
    },
  };
}

async function parseError(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export function EventImportAssistant({ onApplyDraft, className }: Props) {
  const [smartQuery, setSmartQuery] = useState("");
  const [agentNotes, setAgentNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isBuildingDraft, setIsBuildingDraft] = useState(false);
  const [candidateDrafts, setCandidateDrafts] = useState<EventImportDraft[]>([]);
  const [latestDraft, setLatestDraft] = useState<EventImportDraft | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSuggestingAddress, setIsSuggestingAddress] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<ResolvedAddress | null>(null);
  const [googlePlacesEnabled, setGooglePlacesEnabled] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const placesSessionTokenRef = useRef<string>(createPlacesSessionToken());
  const latestSuggestionRequestRef = useRef(0);

  async function applyDraft(draft: EventImportDraft, successMessage: string) {
    onApplyDraft(draft);
    setLatestDraft(draft);
    toast.success(successMessage);
  }

  async function importFlyer(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/import/flyer", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await parseError(response, "Flyer import failed"));
    }

    const payload = await response.json();
    return payload.draft as EventImportDraft;
  }

  async function importMls(mlsNumber: string) {
    const response = await fetch("/api/import/mls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mlsNumber }),
    });

    if (!response.ok) {
      throw new Error(await parseError(response, "MLS import failed"));
    }

    const payload = await response.json();
    return payload.draft as EventImportDraft;
  }

  async function importAddress(input: AddressImportRequest) {
    const response = await fetch("/api/import/address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: input.query,
        address:
          input.resolvedAddress?.addressLine1 ||
          input.resolvedAddress?.shortFormattedAddress ||
          input.resolvedAddress?.formattedAddress,
        city: input.resolvedAddress?.city,
        state: input.resolvedAddress?.state,
        postalCode: input.resolvedAddress?.postalCode,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseError(response, "Address search failed"));
    }

    const payload = await response.json();
    return ((payload.drafts as EventImportDraft[]) ?? []).filter(Boolean);
  }

  async function resolveAddressSuggestion(suggestion: AddressSuggestion) {
    const response = await fetch("/api/import/address/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: suggestion.placeId,
        sessionToken: placesSessionTokenRef.current,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseError(response, "Address resolution failed"));
    }

    const payload = await response.json();
    return payload.address as ResolvedAddress;
  }

  useEffect(() => {
    if (!googlePlacesEnabled || detectQueryMode(smartQuery) === "mls") {
      setAddressSuggestions([]);
      setIsSuggestingAddress(false);
      return;
    }

    const query = smartQuery.trim();

    if (selectedAddress && query === selectedAddress.formattedAddress) {
      setAddressSuggestions([]);
      setIsSuggestingAddress(false);
      return;
    }

    if (query.length < 3) {
      setAddressSuggestions([]);
      setIsSuggestingAddress(false);
      return;
    }

    const requestId = latestSuggestionRequestRef.current + 1;
    latestSuggestionRequestRef.current = requestId;

    const timer = window.setTimeout(async () => {
      try {
        setIsSuggestingAddress(true);

        const response = await fetch("/api/import/address/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            sessionToken: placesSessionTokenRef.current,
          }),
        });

        if (response.status === 503) {
          setGooglePlacesEnabled(false);
          setAddressSuggestions([]);
          return;
        }

        if (!response.ok) {
          throw new Error(await parseError(response, "Address suggestions failed"));
        }

        const payload = await response.json();

        if (latestSuggestionRequestRef.current !== requestId) {
          return;
        }

        setAddressSuggestions(((payload.suggestions as AddressSuggestion[]) ?? []).slice(0, 5));
      } catch {
        if (latestSuggestionRequestRef.current === requestId) {
          setAddressSuggestions([]);
        }
      } finally {
        if (latestSuggestionRequestRef.current === requestId) {
          setIsSuggestingAddress(false);
        }
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [googlePlacesEnabled, selectedAddress, smartQuery]);

  async function resolveQueryDrafts(args: {
    query: string;
    resolvedAddress?: ResolvedAddress | null;
  }): Promise<DraftResolution> {
    const query = args.query;
    const strategies =
      detectQueryMode(query) === "mls"
        ? (["mls", "address"] as const)
        : (["address"] as const);

    let lastFailure = "No listing data matched that input.";

    for (const strategy of strategies) {
      try {
        if (strategy === "mls") {
          const draft = await importMls(query);
          return { kind: "single", draft };
        }

        const drafts = await importAddress({
          query,
          resolvedAddress: args.resolvedAddress,
        });
        if (drafts.length === 1) {
          return { kind: "single", draft: drafts[0] };
        }
        if (drafts.length > 1) {
          return { kind: "multiple", drafts };
        }

        lastFailure = "No provider match was found for that address.";
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : "Import failed";
      }
    }

    return { kind: "none", message: lastFailure };
  }

  function finalizeDraft(baseDraft: EventImportDraft, flyerDraft: EventImportDraft | null, notes: string) {
    const merged = flyerDraft ? mergeImportDrafts(baseDraft, flyerDraft) : baseDraft;
    return withAgentNotes(merged, notes);
  }

  async function handleBuildDraft() {
    const query = smartQuery.trim();
    const notes = agentNotes.trim();

    if (!query && !selectedFile) {
      toast.error("Enter an address or MLS number, or upload a flyer asset first");
      return;
    }

    try {
      setIsBuildingDraft(true);
      setCandidateDrafts([]);

      const flyerDraft = selectedFile ? await importFlyer(selectedFile) : null;

      if (!query) {
        if (!flyerDraft) {
          throw new Error("No property input was provided");
        }

        const finalDraft = withAgentNotes(flyerDraft, notes);
        await applyDraft(finalDraft, "Flyer and notes applied to this event draft");
        return;
      }

      const providerQuery = selectedAddress ? buildProviderAddressQuery(selectedAddress) : query;
      const resolution = await resolveQueryDrafts({
        query: providerQuery,
        resolvedAddress: selectedAddress,
      });

      if (resolution.kind === "multiple") {
        const enrichedDrafts = resolution.drafts.map((draft) => finalizeDraft(draft, flyerDraft, notes));
        setCandidateDrafts(enrichedDrafts);
        toast.message("We found multiple likely matches. Choose the listing that looks right.");
        return;
      }

      if (resolution.kind === "none") {
        if (flyerDraft) {
          const fallbackDraft = withAgentNotes(flyerDraft, notes);
          await applyDraft(
            fallbackDraft,
            "No provider match found. Using the uploaded flyer asset as the draft."
          );
          return;
        }

        throw new Error(resolution.message);
      }

      const finalDraft = finalizeDraft(resolution.draft, flyerDraft, notes);
      await applyDraft(finalDraft, "Smart import applied to this event draft");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Smart import failed");
    } finally {
      setIsBuildingDraft(false);
    }
  }

  async function handleSelectSuggestion(suggestion: AddressSuggestion) {
    try {
      setIsSuggestingAddress(true);
      const address = await resolveAddressSuggestion(suggestion);
      setSelectedAddress(address);
      setSmartQuery(address.formattedAddress);
      setAddressSuggestions([]);
      placesSessionTokenRef.current = createPlacesSessionToken();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to select this address");
    } finally {
      setIsSuggestingAddress(false);
    }
  }

  return (
    <Card
      className={cn(
        "border-border/60 bg-gradient-to-br from-background via-background to-muted/20 shadow-sm",
        className
      )}
    >
      <CardHeader className="gap-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1 text-xs font-medium text-emerald-700">
          <Sparkles className="h-3.5 w-3.5" />
          Smart Import
        </div>
        <div>
          <CardTitle className="text-base sm:text-lg">Start with whatever listing context you already have</CardTitle>
          <CardDescription className="mt-1 max-w-3xl text-sm leading-relaxed">
            Paste an address or MLS number, attach a flyer asset if you have one, and add agent notes for context.
            OpenHouse will prefer structured provider data, layer in flyer extraction, and keep your notes available for AI Q&amp;A.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4 rounded-[28px] border border-border/60 bg-background/80 p-5 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="smart-import-query">Property address or MLS #</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="relative flex-1">
                  <Input
                    id="smart-import-query"
                    placeholder="123 Main St, New York, NY 10001 or KEY966861"
                    value={smartQuery}
                    autoComplete="off"
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSmartQuery(nextValue);

                      if (selectedAddress && nextValue.trim() !== selectedAddress.formattedAddress) {
                        setSelectedAddress(null);
                      }
                    }}
                  />
                  {isSuggestingAddress ? (
                    <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  ) : null}
                  {addressSuggestions.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-3xl border border-border/70 bg-background/95 p-2 shadow-2xl backdrop-blur">
                      <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Suggested addresses
                      </div>
                      <div className="space-y-1">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.placeId}
                            type="button"
                            className="flex w-full flex-col rounded-2xl px-3 py-2 text-left transition hover:bg-muted/70"
                            onClick={() => void handleSelectSuggestion(suggestion)}
                          >
                            <span className="text-sm font-medium text-foreground">{suggestion.primaryText}</span>
                            {suggestion.secondaryText ? (
                              <span className="mt-0.5 text-xs text-muted-foreground">{suggestion.secondaryText}</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                  onClick={handleBuildDraft}
                  disabled={isBuildingDraft}
                >
                  {isBuildingDraft ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : detectQueryMode(smartQuery) === "mls" ? (
                    <ScanSearch className="mr-2 h-4 w-4" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Build property draft
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Address is now the primary import path. If Google Places is configured, OpenHouse first standardizes the address, then checks for a unique provider match, and only falls back to MLS-style lookup when the input clearly looks like an identifier.
              </p>
              {selectedAddress ? (
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Standardized address selected
                  </div>
                  <p className="mt-2 font-medium text-foreground">{selectedAddress.formattedAddress}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Provider matching will use this structured address, then resolve the final listing by listing key.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2 rounded-3xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileUp className="h-4 w-4 text-emerald-600" />
                  Optional flyer / PDF / image
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Add a marketing flyer, PDF, PNG, JPG, or WEBP image. We use it to enrich copy, photos, and AI context when the provider payload is thin.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBuildingDraft}
                  >
                    <FileUp className="mr-2 h-4 w-4" />
                    {selectedFile ? "Replace asset" : "Attach asset"}
                  </Button>
                  {selectedFile ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-2xl text-muted-foreground"
                      onClick={() => setSelectedFile(null)}
                      disabled={isBuildingDraft}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  disabled={isBuildingDraft}
                />
                {selectedFile ? (
                  <p className="text-xs text-muted-foreground">Attached: {selectedFile.name}</p>
                ) : null}
              </div>

              <div className="space-y-2 rounded-3xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <NotebookPen className="h-4 w-4 text-emerald-600" />
                  Optional agent notes
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Add caveats, offer instructions, building details, school context, or the specific angle you want the share page and Q&amp;A to lean on.
                </p>
                <Textarea
                  value={agentNotes}
                  onChange={(event) => setAgentNotes(event.target.value)}
                  placeholder="Example: HOA includes water and trash. Seller expects pre-approval before private tours. Buyers usually ask about parking, pet rules, and nearby schools."
                  className="min-h-28 rounded-2xl bg-background/80"
                  disabled={isBuildingDraft}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-dashed border-border/70 bg-muted/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Import logic
            </p>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">1. Structured provider data first</p>
                <p className="mt-1 leading-relaxed">
                  We try the connected MLS/listing provider before anything else because those fields are the most deterministic.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">2. Public-web fallback only if the provider misses</p>
                <p className="mt-1 leading-relaxed">
                  If no provider match is found, OpenHouse can build web-based candidate drafts from trusted public sources instead of leaving you at a dead end.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">3. Flyer extraction fills the gaps</p>
                <p className="mt-1 leading-relaxed">
                  Flyer assets help improve photos, highlights, and marketing copy when the provider payload is incomplete.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">4. Agent notes stay available to AI</p>
                <p className="mt-1 leading-relaxed">
                  Notes are not treated as public facts. They are preserved as agent context so follow-up and property Q&amp;A can use them without overwriting hard listing fields.
                </p>
              </div>
            </div>
          </div>
        </div>

        {candidateDrafts.length > 0 ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Choose the best match
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                We found multiple property records for that address. Pick the one that should seed this event.
              </p>
            </div>
            <div className="grid gap-3">
              {candidateDrafts.map((draft) => (
                <CandidateDraftCard
                  key={`${draft.propertyAddress}-${draft.mlsNumber ?? "no-mls"}-${draft.importSummary.provider ?? "provider"}`}
                  draft={draft}
                  onApply={() => applyDraft(draft, "Selected property match applied to this event draft")}
                />
              ))}
            </div>
          </div>
        ) : null}

        {latestDraft ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Latest imported draft
            </p>
            <DraftPreview draft={latestDraft} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
