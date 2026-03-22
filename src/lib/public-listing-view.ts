import type { EventAiQaContext } from "@/lib/listing-import-shared";

type PublicListingViewInput = {
  propertyAddress: string;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: string | null;
  sqft?: number | null;
  yearBuilt?: number | null;
  propertyDescription?: string | null;
  aiQaContext?: EventAiQaContext | null;
};

export type PublicListingMarketing = {
  headline: string | null;
  summary: string | null;
  highlights: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function formatPropertyTypeLabel(value: string | null | undefined) {
  if (!value) {
    return "home";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function clipText(value: string | null, maxLength = 260) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sentenceBreak = normalized.slice(0, maxLength).match(/^(.*?[.!?])\s/);
  if (sentenceBreak?.[1]) {
    return sentenceBreak[1].trim();
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function buildFallbackHeadline(input: PublicListingViewInput, mlsData: Record<string, unknown> | null) {
  const city = asString(mlsData?.city);
  const neighborhood = asString(mlsData?.neighborhood);
  const location = neighborhood || city || input.propertyAddress.split(",")[0]?.trim() || null;
  const statLine = [
    input.bedrooms ? `${input.bedrooms}-bed` : null,
    input.bathrooms ? `${input.bathrooms}-bath` : null,
    input.sqft ? `${Number(input.sqft).toLocaleString()} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const propertyType = formatPropertyTypeLabel(input.propertyType);

  if (statLine && location) {
    return `${statLine} ${propertyType.toLowerCase()} in ${location}`;
  }

  if (location) {
    return `${propertyType} in ${location}`;
  }

  return input.propertyAddress;
}

function buildFallbackSummary(input: PublicListingViewInput, mlsData: Record<string, unknown> | null) {
  const propertyFacts = asRecord(input.aiQaContext?.propertyFacts);
  const building = asRecord(propertyFacts?.building);
  const schools = asRecord(propertyFacts?.schools);
  const description = clipText(input.propertyDescription || asString(mlsData?.description));
  if (description) {
    return description;
  }

  const fragments = [
    input.bedrooms ? `${input.bedrooms} bedrooms` : null,
    input.bathrooms ? `${input.bathrooms} bathrooms` : null,
    input.sqft ? `${Number(input.sqft).toLocaleString()} square feet` : null,
    input.yearBuilt ? `built in ${input.yearBuilt}` : null,
  ].filter(Boolean);

  if (fragments.length > 0) {
    const contextBits = [
      asString(schools?.district) ? `zoned for ${asString(schools?.district)}` : null,
      asString(asRecord(building)?.petPolicy)
        ? `pet policy: ${asString(asRecord(building)?.petPolicy)}`
        : null,
    ].filter(Boolean);

    return `Explore a ${formatPropertyTypeLabel(input.propertyType).toLowerCase()} offering ${fragments.join(
      ", "
    )}${contextBits.length > 0 ? ` and ${contextBits.join(", ")}` : ""}.`;
  }

  return null;
}

function buildFallbackHighlights(input: PublicListingViewInput, mlsData: Record<string, unknown> | null) {
  const propertyFacts = asRecord(input.aiQaContext?.propertyFacts);
  const building = asRecord(propertyFacts?.building);
  const schools = asRecord(propertyFacts?.schools);
  const rawHighlights = [
    ...asStringArray(mlsData?.marketingHighlights),
    ...asStringArray(mlsData?.features),
    ...asStringArray(asRecord(input.aiQaContext?.nearbyPoi)?.highlights),
    ...asStringArray(building?.amenities),
    ...asStringArray(building?.outdoorSpace),
    ...asStringArray(building?.parking),
    ...asStringArray(building?.laundry),
  ];

  const unique = Array.from(new Set(rawHighlights.map((item) => item.trim()).filter(Boolean)));
  if (unique.length > 0) {
    return unique.slice(0, 4);
  }

  const fallback = [
    input.yearBuilt ? `Built ${input.yearBuilt}` : null,
    asString(schools?.district || mlsData?.schoolDistrict)
      ? `School district: ${asString(schools?.district || mlsData?.schoolDistrict)}`
      : null,
    asString(mlsData?.neighborhood) ? `Neighborhood: ${asString(mlsData?.neighborhood)}` : null,
    asBoolean(building?.doorman) ? "Doorman building" : null,
    asBoolean(building?.elevator) ? "Elevator access" : null,
    asString(building?.petPolicy) ? `Pets: ${asString(building?.petPolicy)}` : null,
  ].filter(Boolean);

  return fallback.slice(0, 4) as string[];
}

export function buildPublicListingMarketing(input: PublicListingViewInput): PublicListingMarketing {
  const mlsData = asRecord(input.aiQaContext?.mlsData);
  const headline = asString(mlsData?.marketingHeadline) || buildFallbackHeadline(input, mlsData);
  const summary = asString(mlsData?.marketingSummary) || buildFallbackSummary(input, mlsData);
  const highlights = buildFallbackHighlights(input, mlsData);

  return {
    headline,
    summary,
    highlights,
  };
}
