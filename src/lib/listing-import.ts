import { z } from "zod";
import { PDFParse } from "pdf-parse";
import { chatCompletion, hasAiConfiguration } from "@/lib/ai/openai";
import { hasWebSearchConfiguration, searchPublicWeb } from "@/lib/ai/web-search";
import type {
  EventPropertyFacts,
  EventImportDraft,
  OpenHousePropertyType,
} from "@/lib/listing-import-shared";
export { openHousePropertyTypes } from "@/lib/listing-import-shared";

type ImportedListing = {
  source: "mls" | "address" | "flyer";
  id: string | null;
  mlsNumber: string | null;
  listingKey: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  listPrice: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  propertyType: OpenHousePropertyType | null;
  status: string | null;
  description: string | null;
  features: string[];
  neighborhood: string | null;
  schoolDistrict: string | null;
  photos: string[];
  virtualTourUrl: string | null;
  daysOnMarket: number | null;
  providerSource: string | null;
  fallbackUsed: boolean | null;
  rawPayload: Record<string, unknown> | null;
  propertyFacts: EventPropertyFacts | null;
};

const flyerExtractionSchema = z.object({
  mls_number: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip_code: z.string().nullable().optional(),
  list_price: z.number().nullable().optional(),
  bedrooms: z.number().nullable().optional(),
  bathrooms: z.number().nullable().optional(),
  sqft: z.number().nullable().optional(),
  year_built: z.number().nullable().optional(),
  property_type: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  school_district: z.string().nullable().optional(),
  features: z.array(z.string()).optional(),
  faq: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .optional(),
  nearby_poi: z.record(z.string(), z.unknown()).optional(),
});

const marketingCopySchema = z.object({
  headline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  highlights: z.array(z.string()).max(5).optional(),
});

const addressFallbackCandidateSchema = z.object({
  candidates: z
    .array(
      z.object({
        address: z.string(),
        city: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        zip_code: z.string().nullable().optional(),
        list_price: z.number().nullable().optional(),
        bedrooms: z.number().nullable().optional(),
        bathrooms: z.number().nullable().optional(),
        sqft: z.number().nullable().optional(),
        year_built: z.number().nullable().optional(),
        property_type: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        neighborhood: z.string().nullable().optional(),
        school_district: z.string().nullable().optional(),
        features: z.array(z.string()).optional(),
        provider: z.string().nullable().optional(),
        source_url: z.string().nullable().optional(),
        match_confidence: z.number().min(0).max(1).nullable().optional(),
        matched_by: z.string().nullable().optional(),
      })
    )
    .max(3)
    .optional(),
});

function getListingImportConfig() {
  const usesProviderAlias = Boolean(
    process.env.LISTING_PROVIDER_BASE_URL || process.env.LISTING_PROVIDER_API_KEY
  );
  const usesLegacyAlias = Boolean(process.env.BBO_BASE_URL || process.env.BBO_API_KEY);
  const baseUrl =
    process.env.LISTING_DATA_API_URL ||
    process.env.LISTING_PROVIDER_BASE_URL ||
    process.env.BBO_BASE_URL ||
    process.env.REAL_ESTATE_API_URL ||
    process.env.MLS_IMPORT_API_URL ||
    "";
  const apiKey =
    process.env.LISTING_DATA_API_KEY ||
    process.env.LISTING_PROVIDER_API_KEY ||
    process.env.BBO_API_KEY ||
    process.env.REAL_ESTATE_API_KEY ||
    process.env.MLS_IMPORT_API_KEY ||
    "";
  const mlsPath =
    process.env.LISTING_DATA_MLS_LOOKUP_PATH ||
    (usesProviderAlias || usesLegacyAlias
      ? "/api/v1/listings/:mlsId"
      : "/api/v1/listings/mls/:mlsId");
  const byKeyPath =
    process.env.LISTING_DATA_BY_KEY_LOOKUP_PATH ||
    process.env.LISTING_DATA_LISTING_KEY_LOOKUP_PATH ||
    "/api/v1/listings/by-key/:listingKey";
  const addressResolvePath =
    process.env.LISTING_DATA_ADDRESS_RESOLVE_PATH || "/api/v1/listings/by-address";
  const addressCandidatesPath =
    process.env.LISTING_DATA_ADDRESS_CANDIDATES_PATH ||
    "/api/v1/listings/address-candidates";

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    mlsPath,
    byKeyPath,
    addressResolvePath,
    addressCandidatesPath,
  };
}

function parseDomainList(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isListingImportConfigured() {
  const config = getListingImportConfig();
  return Boolean(config.baseUrl && config.apiKey);
}

function buildServiceHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
    Authorization: `Bearer ${apiKey}`,
  };
}

function buildServiceUrl(baseUrl: string, path: string) {
  if (!path.startsWith("/")) {
    return `${baseUrl}/${path}`;
  }

  return `${baseUrl}${path}`;
}

function toDataUrl(fileBuffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
}

async function fetchServiceJson<T>(
  input: RequestInfo | URL,
  init: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") || "";

  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (typeof payload === "object" && payload && "error" in payload) {
      const error = payload as {
        error?: { message?: string };
        message?: string;
      };
      throw new Error(error.error?.message || error.message || "Listing import request failed");
    }

    throw new Error(typeof payload === "string" ? payload : "Listing import request failed");
  }

  return payload as T;
}

async function parseServiceError(response: Response, fallback: string) {
  try {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as {
        error?: { message?: string };
        message?: string;
      };
      return payload.error?.message || payload.message || fallback;
    }

    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

async function extractAddressCandidatesFromPublicWeb(query: string) {
  if (!hasAiConfiguration() || !hasWebSearchConfiguration()) {
    return [] as EventImportDraft[];
  }

  const searchQuery = `${query} real estate listing property details price bedrooms bathrooms`;
  const includeDomains =
    parseDomainList(process.env.ADDRESS_IMPORT_WEB_SEARCH_INCLUDE_DOMAINS).length > 0
      ? parseDomainList(process.env.ADDRESS_IMPORT_WEB_SEARCH_INCLUDE_DOMAINS)
      : parseDomainList(process.env.PROPERTY_QA_WEB_SEARCH_INCLUDE_DOMAINS);

  const webResults = await searchPublicWeb(searchQuery, {
    includeDomains: includeDomains.length > 0 ? includeDomains : undefined,
  });

  if (webResults.length === 0) {
    return [];
  }

  const prompt = `You are extracting likely residential property candidates from public search results.

Target address:
${query}

Instructions:
- Return JSON only.
- Include at most 3 candidates.
- Only include candidates that plausibly match the same property or unit.
- Prefer exact or near-exact address matches.
- Do not invent missing facts.
- match_confidence should be between 0 and 1.
- matched_by should briefly explain why the candidate was selected, for example "exact address match", "same building + matching unit", or "building-level match".

Search results:
${JSON.stringify(webResults, null, 2)}`;

  const result = await chatCompletion({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1200,
    temperature: 0.2,
    responseFormat: "json",
  });

  const parsed = addressFallbackCandidateSchema.parse(JSON.parse(result.content));
  const candidates = parsed.candidates ?? [];

  const drafts = await Promise.all(
    candidates.map(async (candidate) => {
      const normalized = normalizeImportedListing(
        {
          address: candidate.address,
          city: candidate.city,
          state: candidate.state,
          zip_code: candidate.zip_code,
          list_price: candidate.list_price,
          bedrooms: candidate.bedrooms,
          bathrooms: candidate.bathrooms,
          sqft: candidate.sqft,
          year_built: candidate.year_built,
          property_type: candidate.property_type,
          description: candidate.description,
          neighborhood: candidate.neighborhood,
          school_district: candidate.school_district,
          features: candidate.features,
          source: candidate.provider || "public-web",
          source_url: candidate.source_url,
          webSearchResults: webResults,
        },
        "address"
      );

      return withMarketingCopy(
        mapListingToEventDraft(normalized, {
          score: candidate.match_confidence ?? 0.45,
          matchedBy: candidate.matched_by || "public web fallback",
          provider: candidate.provider || "Public web",
        }),
        normalized
      );
    })
  );

  return drafts;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toStringValue(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    return value
      .split(/[|,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return null;
}

function mapPropertyType(value: string | null | undefined): OpenHousePropertyType | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();

  if (normalized.includes("condo") || normalized.includes("apartment")) return "condo";
  if (normalized.includes("town")) return "townhouse";
  if (normalized.includes("multi") || normalized.includes("duplex") || normalized.includes("triplex")) {
    return "multi_family";
  }
  if (normalized.includes("land") || normalized.includes("lot")) return "land";
  if (
    normalized.includes("single") ||
    normalized.includes("detached") ||
    normalized.includes("house") ||
    normalized.includes("residential")
  ) {
    return "single_family";
  }

  return "other";
}

function pickFromRecords<T>(
  records: Array<Record<string, unknown>>,
  keys: string[],
  extractor: (value: unknown) => T | null
): T | null {
  for (const key of keys) {
    for (const record of records) {
      const value = extractor(record[key]);
      if (value !== null) {
        return value;
      }
    }
  }

  return null;
}

function pickStringFromRecords(records: Array<Record<string, unknown>>, keys: string[]) {
  return pickFromRecords(records, keys, toStringValue);
}

function pickNumberFromRecords(records: Array<Record<string, unknown>>, keys: string[]) {
  return pickFromRecords(records, keys, toNumber);
}

function pickBooleanFromRecords(records: Array<Record<string, unknown>>, keys: string[]) {
  return pickFromRecords(records, keys, toBoolean);
}

function pickStringArrayFromRecords(records: Array<Record<string, unknown>>, keys: string[]) {
  const values = keys.flatMap((key) =>
    records.flatMap((record) => toStringArray(record[key]))
  );
  return Array.from(new Set(values));
}

function extractSchoolNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item === "string") {
          return [item.trim()];
        }

        if (isRecord(item)) {
          return [
            toStringValue(item.name),
            toStringValue(item.schoolName),
            toStringValue(item.SchoolName),
          ].filter((entry): entry is string => Boolean(entry));
        }

        return [];
      })
      .filter(Boolean);
  }

  return toStringArray(value);
}

function pickSchoolNamesFromRecords(records: Array<Record<string, unknown>>, keys: string[]) {
  const names = keys.flatMap((key) =>
    records.flatMap((record) => extractSchoolNames(record[key]))
  );
  return Array.from(new Set(names));
}

function toPolicyLabel(value: unknown): string | null {
  if (typeof value === "boolean") {
    return value ? "Allowed" : "Not allowed";
  }

  return toStringValue(value);
}

function buildPropertyFacts(
  records: Array<Record<string, unknown>>,
  listing: Omit<ImportedListing, "propertyFacts">
): EventPropertyFacts | null {
  const annualTaxes = pickNumberFromRecords(records, [
    "annualTaxes",
    "AnnualTaxes",
    "taxAnnualAmount",
    "TaxAnnualAmount",
    "taxAmount",
    "TaxAmount",
  ]);
  const monthlyTaxes = pickNumberFromRecords(records, [
    "monthlyTaxes",
    "MonthlyTaxes",
    "monthlyTaxAmount",
    "MonthlyTaxAmount",
  ]);
  const commonCharges = pickNumberFromRecords(records, [
    "commonCharges",
    "CommonCharges",
    "monthlyCommonCharges",
    "MonthlyCommonCharges",
  ]);
  const maintenanceFee = pickNumberFromRecords(records, [
    "maintenanceFee",
    "MaintenanceFee",
    "maintenance",
    "Maintenance",
  ]);
  const hoaFee = pickNumberFromRecords(records, [
    "hoaFee",
    "HOAFee",
    "associationFee",
    "AssociationFee",
  ]);
  const assessmentFee = pickNumberFromRecords(records, [
    "assessmentFee",
    "AssessmentFee",
    "specialAssessment",
    "SpecialAssessment",
  ]);

  const estimatedMonthlyCarry =
    [monthlyTaxes, commonCharges, maintenanceFee, hoaFee, assessmentFee]
      .filter((value): value is number => value !== null)
      .reduce((sum, value) => sum + value, 0) ||
    (annualTaxes ? annualTaxes / 12 : null);

  const amenities = Array.from(
    new Set([
      ...listing.features,
      ...pickStringArrayFromRecords(records, [
        "amenities",
        "Amenities",
        "associationAmenities",
        "AssociationAmenities",
        "interiorFeatures",
        "InteriorFeatures",
        "exteriorFeatures",
        "ExteriorFeatures",
      ]),
    ])
  );
  const amenityText = amenities.join(" ").toLowerCase();

  const nearbyTransit = pickStringArrayFromRecords(records, [
    "nearbyTransit",
    "NearbyTransit",
    "transportation",
    "Transportation",
    "transit",
    "Transit",
  ]);

  const facts: EventPropertyFacts = {
    financial: {
      annualTaxes,
      monthlyTaxes,
      commonCharges,
      maintenanceFee,
      hoaFee,
      assessmentFee,
      estimatedMonthlyCarry:
        estimatedMonthlyCarry && estimatedMonthlyCarry > 0 ? estimatedMonthlyCarry : null,
      flipTax: pickStringFromRecords(records, ["flipTax", "FlipTax"]),
      taxAbatement: pickStringFromRecords(records, ["taxAbatement", "TaxAbatement"]),
      notes: pickStringArrayFromRecords(records, [
        "financialNotes",
        "FinancialNotes",
        "includedInMaintenance",
        "IncludedInMaintenance",
      ]),
    },
    schools: {
      district:
        listing.schoolDistrict ||
        pickStringFromRecords(records, ["schoolDistrict", "SchoolDistrict"]),
      elementary: pickStringFromRecords(records, [
        "elementarySchool",
        "ElementarySchool",
      ]),
      middle: pickStringFromRecords(records, [
        "middleSchool",
        "MiddleSchool",
        "middleOrJuniorSchool",
        "MiddleOrJuniorSchool",
      ]),
      high: pickStringFromRecords(records, ["highSchool", "HighSchool"]),
      schools: pickSchoolNamesFromRecords(records, ["schools", "Schools"]),
    },
    building: {
      buildingType: pickStringFromRecords(records, [
        "buildingType",
        "BuildingType",
        "propertySubType",
        "PropertySubType",
      ]),
      parking: pickStringArrayFromRecords(records, ["parkingFeatures", "ParkingFeatures"]),
      laundry: pickStringArrayFromRecords(records, ["laundryFeatures", "LaundryFeatures"]),
      petPolicy: pickStringFromRecords(records, ["petPolicy", "petsAllowed", "PetsAllowed"]),
      amenities: amenities.slice(0, 16),
      outdoorSpace: pickStringArrayFromRecords(records, [
        "outdoorSpace",
        "OutdoorSpace",
        "patioAndPorchFeatures",
        "PatioAndPorchFeatures",
      ]),
      utilitiesIncluded: pickStringArrayFromRecords(records, [
        "utilitiesIncluded",
        "UtilitiesIncluded",
      ]),
      doorman:
        pickBooleanFromRecords(records, ["doorman", "Doorman"]) ??
        (amenityText.includes("doorman") ? true : null),
      elevator:
        pickBooleanFromRecords(records, ["elevator", "Elevator"]) ??
        (amenityText.includes("elevator") ? true : null),
      gym:
        pickBooleanFromRecords(records, ["gym", "Gym"]) ??
        (amenityText.includes("gym") || amenityText.includes("fitness") ? true : null),
      pool:
        pickBooleanFromRecords(records, ["pool", "Pool"]) ??
        (amenityText.includes("pool") ? true : null),
      storage:
        pickBooleanFromRecords(records, ["storage", "StorageAvailable"]) ??
        (amenityText.includes("storage") ? true : null),
    },
    interior: {
      appliances: pickStringArrayFromRecords(records, ["appliances", "Appliances"]),
      heating: pickStringArrayFromRecords(records, ["heating", "Heating"]),
      cooling: pickStringArrayFromRecords(records, ["cooling", "Cooling"]),
    },
    policies: {
      subletAllowed: pickFromRecords(records, ["subletAllowed", "SubletAllowed"], toPolicyLabel),
      piedATerreAllowed: pickFromRecords(
        records,
        ["piedATerreAllowed", "PiedATerreAllowed"],
        toPolicyLabel
      ),
      financingAllowed: pickFromRecords(
        records,
        ["financingAllowed", "FinancingAllowed"],
        toPolicyLabel
      ),
      occupancyNotes: pickStringArrayFromRecords(records, [
        "occupancyNotes",
        "OccupancyNotes",
      ]),
    },
    neighborhood: {
      name: listing.neighborhood,
      nearbyTransit: nearbyTransit.slice(0, 8),
      nearbyHighlights: pickStringArrayFromRecords(records, [
        "nearbyHighlights",
        "NearbyHighlights",
      ]).slice(0, 8),
    },
    listing: {
      status: listing.status,
      daysOnMarket: listing.daysOnMarket,
      virtualTourUrl: listing.virtualTourUrl,
      source: listing.providerSource,
      fallbackUsed: listing.fallbackUsed,
    },
  };

  const hasAnyFacts = Object.values(facts).some((section) => {
    if (!section || typeof section !== "object") {
      return false;
    }

    return Object.values(section).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== "";
    });
  });

  return hasAnyFacts ? facts : null;
}

function formatAddress(
  address: string,
  city?: string | null,
  state?: string | null,
  zipCode?: string | null
) {
  const locality = [city, state, zipCode].filter(Boolean).join(" ");
  if (locality) {
    const normalizedAddress = address.replace(/,\s*/g, " ").toLowerCase();
    const normalizedLocality = locality.replace(/,\s*/g, " ").toLowerCase();
    if (normalizedAddress.includes(normalizedLocality)) {
      return address;
    }
  }
  const pieces = [address, locality].filter(Boolean);
  return pieces.join(", ");
}

function buildStreetLine(record: Record<string, unknown>) {
  const streetPieces = [
    toStringValue(record.streetNumber ?? record.StreetNumber ?? record.houseNumber ?? record.HouseNumber),
    toStringValue(
      record.streetDirPrefix ??
        record.StreetDirPrefix ??
        record.streetPrefix ??
        record.StreetPrefix
    ),
    toStringValue(record.streetName ?? record.StreetName),
    toStringValue(record.streetSuffix ?? record.StreetSuffix ?? record.streetType ?? record.StreetType),
    toStringValue(
      record.streetSuffixModifier ??
        record.StreetSuffixModifier ??
        record.streetDirSuffix ??
        record.StreetDirSuffix
    ),
  ].filter(Boolean);

  const streetLine = streetPieces.join(" ").trim();
  if (!streetLine) {
    return null;
  }

  const unitValue = toStringValue(
    record.unitNumber ??
      record.UnitNumber ??
      record.unit ??
      record.Unit ??
      record.apartmentNumber ??
      record.ApartmentNumber
  );

  if (!unitValue) {
    return streetLine;
  }

  const normalizedUnit = /^(apt|unit|#|suite|ste)\b/i.test(unitValue)
    ? unitValue
    : `Unit ${unitValue}`;

  return `${streetLine} ${normalizedUnit}`.trim();
}

function extractListingAddress(
  property: Record<string, unknown>,
  rawListing: Record<string, unknown>
) {
  const streetLine =
    buildStreetLine(property) ??
    buildStreetLine(rawListing) ??
    toStringValue(
      property.address ??
        property.unparsedAddress ??
        property.UnparsedAddress ??
        property.fullStreetAddress ??
        property.FullStreetAddress ??
        property.streetAddress ??
        property.StreetAddress ??
        property.propertyAddress ??
        property.PropertyAddress ??
        rawListing.address ??
        rawListing.unparsedAddress ??
        rawListing.UnparsedAddress ??
        rawListing.fullStreetAddress ??
        rawListing.FullStreetAddress
    );

  return {
    address: streetLine,
    city: toStringValue(property.city ?? property.City ?? rawListing.city ?? rawListing.City),
    state: toStringValue(
      property.state ??
        property.State ??
        property.stateOrProvince ??
        property.StateOrProvince ??
        rawListing.state ??
        rawListing.State
    ),
    zipCode: toStringValue(
      property.zip_code ??
        property.zipCode ??
        property.ZipCode ??
        property.postalCode ??
        property.PostalCode ??
        rawListing.zip_code ??
        rawListing.zipCode ??
        rawListing.ZipCode
    ),
  };
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return `$${Math.round(value).toLocaleString()}`;
}

function normalizeImportedListing(
  rawListing: Record<string, unknown>,
  source: ImportedListing["source"]
): ImportedListing {
  const property = isRecord(rawListing.property) ? rawListing.property : rawListing;
  const resolvedAddress = extractListingAddress(property, rawListing);
  const mediaItems = Array.isArray(rawListing.media)
    ? rawListing.media.filter(isRecord)
    : [];
  const mediaPhotoUrls = mediaItems
    .map((item) =>
      toStringValue(item.displayUrl) ||
      toStringValue(item.url) ||
      toStringValue(item.mediaURL) ||
      toStringValue(item.rawUrl)
    )
    .filter((entry): entry is string => Boolean(entry));
  const derivedPhotos = [
    ...toStringArray(rawListing.imageUrls),
    ...mediaPhotoUrls,
    ...toStringArray(property.photos),
  ].filter(Boolean);
  const baseListing: Omit<ImportedListing, "propertyFacts"> = {
    source,
    id: toStringValue(property.id ?? property.listing_id ?? property.listingId),
    mlsNumber: toStringValue(
      property.mls_id ?? property.mlsNumber ?? property.mls_number ?? property.listingId
    ),
    listingKey: toStringValue(property.listingKey ?? property.listing_key),
    address: resolvedAddress.address || "Imported property",
    city: resolvedAddress.city,
    state: resolvedAddress.state,
    zipCode: resolvedAddress.zipCode,
    listPrice: toNumber(property.price ?? property.list_price ?? property.listPrice ?? property.ListPrice),
    bedrooms: toNumber(property.bedrooms ?? property.bedroomsTotal ?? property.BedroomsTotal),
    bathrooms: toNumber(
      property.bathrooms ??
        property.bathroomsFull ??
        property.bathroomsTotalInteger ??
        property.BathroomsFull
    ),
    sqft: toNumber(property.sqft ?? property.livingArea ?? property.LivingArea),
    lotSize: toNumber(property.lot_size ?? property.lotSize),
    yearBuilt: toNumber(property.year_built ?? property.yearBuilt ?? property.YearBuilt),
    propertyType: mapPropertyType(
      toStringValue(property.property_type ?? property.propertyType ?? property.PropertyType)
    ),
    status: toStringValue(property.status ?? property.standardStatus ?? property.StandardStatus),
    description: toStringValue(
      property.description ?? property.publicRemarks ?? property.PublicRemarks
    ),
    features: toStringArray(property.features ?? property.interiorFeatures ?? property.appliances),
    neighborhood: toStringValue(property.neighborhood ?? property.subdivisionName),
    schoolDistrict: toStringValue(property.school_district ?? property.schoolDistrict),
    photos: Array.from(new Set(derivedPhotos)),
    virtualTourUrl: toStringValue(
      property.virtual_tour_url ?? property.virtualTourUrl ?? property.virtualTourURL
    ),
    daysOnMarket: toNumber(property.days_on_market ?? property.daysOnMarket),
    providerSource: toStringValue(rawListing.source),
    fallbackUsed: toBoolean(rawListing.fallbackUsed),
    rawPayload: rawListing,
  };

  const records = [property, rawListing].filter(isRecord);

  return {
    ...baseListing,
    propertyFacts: buildPropertyFacts(records, baseListing),
  };
}

function buildFaq(listing: ImportedListing) {
  const faqs: Array<{ question: string; answer: string }> = [];
  const financial = listing.propertyFacts?.financial;
  const schools = listing.propertyFacts?.schools;
  const building = listing.propertyFacts?.building;
  const policies = listing.propertyFacts?.policies;

  if (listing.listPrice) {
    faqs.push({
      question: "What is the list price?",
      answer: `The current list price is $${Math.round(listing.listPrice).toLocaleString()}.`,
    });
  }

  if (listing.bedrooms || listing.bathrooms || listing.sqft) {
    const fragments = [
      listing.bedrooms ? `${listing.bedrooms} bedrooms` : null,
      listing.bathrooms ? `${listing.bathrooms} bathrooms` : null,
      listing.sqft ? `${listing.sqft.toLocaleString()} square feet` : null,
    ].filter(Boolean);

    faqs.push({
      question: "What are the main property stats?",
      answer: `The home offers ${fragments.join(", ")}.`,
    });
  }

  if (listing.neighborhood || listing.schoolDistrict) {
    const pieces = [
      listing.neighborhood ? `Neighborhood: ${listing.neighborhood}` : null,
      (schools?.district || listing.schoolDistrict)
        ? `School district: ${schools?.district || listing.schoolDistrict}`
        : null,
    ].filter(Boolean);

    faqs.push({
      question: "What area details are available?",
      answer: pieces.join(". "),
    });
  }

  if (
    financial?.annualTaxes ||
    financial?.commonCharges ||
    financial?.maintenanceFee ||
    financial?.hoaFee ||
    financial?.assessmentFee
  ) {
    const pieces = [
      financial.annualTaxes ? `Annual taxes: ${formatCurrency(financial.annualTaxes)}` : null,
      financial.commonCharges
        ? `Common charges: ${formatCurrency(financial.commonCharges)}/month`
        : null,
      financial.maintenanceFee
        ? `Maintenance: ${formatCurrency(financial.maintenanceFee)}/month`
        : null,
      financial.hoaFee ? `HOA: ${formatCurrency(financial.hoaFee)}/month` : null,
      financial.assessmentFee
        ? `Assessment: ${formatCurrency(financial.assessmentFee)}/month`
        : null,
    ].filter(Boolean);

    faqs.push({
      question: "What monthly costs or taxes should buyers know about?",
      answer: pieces.join(". "),
    });
  }

  if (
    building?.parking?.length ||
    building?.laundry?.length ||
    building?.petPolicy ||
    building?.amenities?.length
  ) {
    const pieces = [
      building.parking?.length ? `Parking: ${building.parking.join(", ")}` : null,
      building.laundry?.length ? `Laundry: ${building.laundry.join(", ")}` : null,
      building.petPolicy ? `Pets: ${building.petPolicy}` : null,
      building.amenities?.length
        ? `Amenities include ${building.amenities.slice(0, 4).join(", ")}`
        : null,
    ].filter(Boolean);

    faqs.push({
      question: "What building amenities or policies are available?",
      answer: pieces.join(". "),
    });
  }

  if (
    policies?.subletAllowed ||
    policies?.piedATerreAllowed ||
    policies?.financingAllowed ||
    policies?.occupancyNotes?.length
  ) {
    const pieces = [
      policies.subletAllowed ? `Sublets: ${policies.subletAllowed}` : null,
      policies.piedATerreAllowed ? `Pied-a-terre: ${policies.piedATerreAllowed}` : null,
      policies.financingAllowed ? `Financing: ${policies.financingAllowed}` : null,
      policies.occupancyNotes?.length ? policies.occupancyNotes.join(", ") : null,
    ].filter(Boolean);

    faqs.push({
      question: "Are there occupancy or financing rules buyers should know?",
      answer: pieces.join(". "),
    });
  }

  if (listing.daysOnMarket) {
    faqs.push({
      question: "How long has this property been on market?",
      answer: `The listing shows ${listing.daysOnMarket} days on market.`,
    });
  }

  return faqs.slice(0, 6);
}

function buildNearbyPoiContext(listing: ImportedListing) {
  const context: Record<string, unknown> = {};

  if (listing.neighborhood) {
    context.neighborhood = listing.neighborhood;
  }

  if (listing.schoolDistrict) {
    context.schoolDistrict = listing.schoolDistrict;
  }

  if (listing.virtualTourUrl) {
    context.virtualTourUrl = listing.virtualTourUrl;
  }

  if (listing.features.length > 0) {
    context.highlights = listing.features.slice(0, 8);
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

function toDraftSummary(
  listing: ImportedListing,
  options?: {
    score?: number | null;
    matchedBy?: string | null;
    provider?: string | null;
  }
): EventImportDraft["importSummary"] {
  const badges = [
    listing.mlsNumber ? `MLS ${listing.mlsNumber}` : null,
    listing.listPrice ? `$${Math.round(listing.listPrice).toLocaleString()}` : null,
    listing.propertyType ? listing.propertyType.replace("_", " ") : null,
    listing.photos.length > 0 ? `${listing.photos.length} photos` : null,
    listing.status ? listing.status.replace(/_/g, " ") : null,
    options?.score !== null && options?.score !== undefined
      ? `${Math.round(options.score * 100)}% match`
      : null,
    options?.provider || listing.providerSource,
    options?.matchedBy ? options.matchedBy.replace(/[_-]/g, " ") : null,
  ].filter((item): item is string => Boolean(item));

  return {
    source: listing.source,
    headline: listing.address,
    subheadline: [listing.city, listing.state, listing.schoolDistrict]
      .filter(Boolean)
      .join(" · "),
    badges,
    matchConfidence: options?.score ?? null,
    matchedBy: options?.matchedBy ?? null,
    provider: options?.provider || listing.providerSource,
  };
}

function buildFallbackMarketingCopy(listing: ImportedListing) {
  const location = listing.neighborhood || listing.city || listing.address;
  const statLine = [
    listing.bedrooms ? `${listing.bedrooms}-bed` : null,
    listing.bathrooms ? `${listing.bathrooms}-bath` : null,
    listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const propertyType =
    listing.propertyType?.replace(/_/g, " ") || "home";
  const summary =
    listing.description?.replace(/\s+/g, " ").trim().slice(0, 260) ||
    `Explore a ${propertyType} in ${location} with polished open-house-ready details.`;

  return {
    headline: statLine
      ? `${statLine} ${propertyType} in ${location}`
      : `${propertyType.charAt(0).toUpperCase() + propertyType.slice(1)} in ${location}`,
    summary,
    highlights: Array.from(
      new Set([
        ...listing.features.filter(Boolean),
        ...(listing.propertyFacts?.building?.amenities ?? []).slice(0, 4),
        ...(listing.propertyFacts?.building?.outdoorSpace ?? []).slice(0, 2),
      ])
    ).slice(0, 4),
  };
}

async function generateMarketingCopy(listing: ImportedListing) {
  const fallback = buildFallbackMarketingCopy(listing);

  if (!hasAiConfiguration()) {
    return fallback;
  }

  const facts = {
    address: formatAddress(listing.address, listing.city, listing.state, listing.zipCode),
    listPrice: listing.listPrice,
    propertyType: listing.propertyType,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sqft: listing.sqft,
    yearBuilt: listing.yearBuilt,
    status: listing.status,
    neighborhood: listing.neighborhood,
    schoolDistrict: listing.schoolDistrict,
    features: listing.features.slice(0, 10),
    description: listing.description,
    propertyFacts: listing.propertyFacts,
  };

  try {
    const result = await chatCompletion({
      messages: [
        {
          role: "user",
          content: `Write polished marketing copy for a public open-house sign-in page.\n\nReturn JSON only with:\n- headline: max 90 characters\n- summary: max 260 characters\n- highlights: array of 3 to 4 short bullets\n\nRules:\n- Sound credible, polished, and North American residential real-estate appropriate.\n- Do not invent facts.\n- Avoid raw MLS jargon, all-caps, and awkward abbreviations.\n- Avoid fair-housing sensitive language.\n- Focus on layout, light, flow, upgrades, convenience, and practical buyer value.\n\nListing facts:\n${JSON.stringify(facts, null, 2)}`,
        },
      ],
      maxTokens: 420,
      temperature: 0.4,
      responseFormat: "json",
    });

    const parsed = marketingCopySchema.parse(JSON.parse(result.content));

    return {
      headline: parsed.headline?.trim() || fallback.headline,
      summary: parsed.summary?.trim() || fallback.summary,
      highlights:
        parsed.highlights?.map((item) => item.trim()).filter(Boolean).slice(0, 4) ||
        fallback.highlights,
    };
  } catch {
    return fallback;
  }
}

async function withMarketingCopy(
  draft: EventImportDraft,
  listing: ImportedListing
): Promise<EventImportDraft> {
  const marketing = await generateMarketingCopy(listing);

  return {
    ...draft,
    aiQaContext: {
      ...(draft.aiQaContext ?? {}),
      customFaq: draft.aiQaContext?.customFaq,
      propertyFacts: draft.aiQaContext?.propertyFacts,
      nearbyPoi: draft.aiQaContext?.nearbyPoi,
      mlsData: {
        ...(draft.aiQaContext?.mlsData ?? {}),
        marketingHeadline: marketing.headline,
        marketingSummary: marketing.summary,
        marketingHighlights: marketing.highlights,
      },
    },
  };
}

export function mapListingToEventDraft(
  listing: ImportedListing,
  options?: {
    score?: number | null;
    matchedBy?: string | null;
    provider?: string | null;
  }
): EventImportDraft {
  return {
    propertyAddress: formatAddress(listing.address, listing.city, listing.state, listing.zipCode),
    mlsNumber: listing.mlsNumber,
    listPrice: listing.listPrice !== null ? String(Math.round(listing.listPrice)) : null,
    propertyType: listing.propertyType,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms !== null ? String(listing.bathrooms) : null,
    sqft: listing.sqft,
    yearBuilt: listing.yearBuilt,
    propertyDescription: listing.description,
    propertyPhotos: listing.photos,
    aiQaContext: {
      customFaq: buildFaq(listing),
      propertyFacts: listing.propertyFacts ?? undefined,
      mlsData: {
        importedSource: listing.source,
        importedAt: new Date().toISOString(),
        externalId: listing.id,
        mlsNumber: listing.mlsNumber,
        listingKey: listing.listingKey,
        address: formatAddress(listing.address, listing.city, listing.state, listing.zipCode),
        city: listing.city,
        state: listing.state,
        zipCode: listing.zipCode,
        listPrice: listing.listPrice,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        sqft: listing.sqft,
        lotSize: listing.lotSize,
        yearBuilt: listing.yearBuilt,
        propertyType: listing.propertyType,
        status: listing.status,
        features: listing.features,
        neighborhood: listing.neighborhood,
        schoolDistrict: listing.schoolDistrict,
        virtualTourUrl: listing.virtualTourUrl,
        daysOnMarket: listing.daysOnMarket,
        photos: listing.photos,
        source: listing.providerSource,
        fallbackUsed: listing.fallbackUsed,
        sourcePayload: listing.rawPayload,
      },
      nearbyPoi: buildNearbyPoiContext(listing),
    },
    importSummary: toDraftSummary(listing, options),
  };
}

type ListingLookupResponse = {
  success?: boolean;
  data?: {
    listing?: Record<string, unknown>;
  };
  listing?: Record<string, unknown>;
  property?: Record<string, unknown>;
  media?: Array<Record<string, unknown>>;
  imageUrls?: string[];
  source?: string;
  fallbackUsed?: boolean;
};

type AddressImportInput = {
  query: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
};

type ListingDataAddressCandidate = {
  listingKey: string | null;
  listingId: string | null;
  address: string | null;
  city: string | null;
  stateOrProvince: string | null;
  postalCode: string | null;
  standardStatus: string | null;
  confidence: number | null;
  source: string | null;
};

function normalizeAddressSearchQuery(query: string) {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+#/g, " #");
}

function splitAddressQuery(query: string) {
  const normalized = normalizeAddressSearchQuery(query);
  const segments = normalized
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return {
      address: "",
      city: undefined,
      state: undefined,
      postalCode: undefined,
    };
  }

  if (segments.length === 1) {
    return {
      address: segments[0],
      city: undefined,
      state: undefined,
      postalCode: undefined,
    };
  }

  const address = segments[0];
  const city = segments[1] || undefined;
  const tail = segments.slice(2).join(" ").trim();
  const stateMatch = tail.match(/\b([A-Z]{2})\b/i);
  const postalMatch = tail.match(/\b(\d{5}(?:-\d{4})?)\b/);

  return {
    address,
    city,
    state: stateMatch?.[1]?.toUpperCase(),
    postalCode: postalMatch?.[1],
  };
}

function extractLookupListing(payload: ListingLookupResponse) {
  return (
    payload.data?.listing ??
    payload.listing ??
    (payload.property
      ? {
          source: payload.source,
          fallbackUsed: payload.fallbackUsed,
          property: payload.property,
          media: payload.media,
          imageUrls: payload.imageUrls,
        }
      : null)
  );
}

function buildAddressLookupPayload(input: AddressImportInput) {
  const normalizedQuery = normalizeAddressSearchQuery(input.query);
  const parsedQuery = splitAddressQuery(normalizedQuery);
  const rawAddress = input.address?.trim() || "";
  const address =
    (
      rawAddress &&
      rawAddress === normalizedQuery &&
      parsedQuery.address &&
      (parsedQuery.city || parsedQuery.state || parsedQuery.postalCode)
        ? parsedQuery.address
        : rawAddress || parsedQuery.address || normalizedQuery
    ).trim();
  const city = input.city?.trim() || parsedQuery.city || undefined;
  const stateOrProvince = input.state?.trim() || parsedQuery.state || undefined;
  const postalCode = input.postalCode?.trim() || parsedQuery.postalCode || undefined;

  return {
    query: normalizedQuery,
    requestBody: {
      address,
      ...(city ? { city } : {}),
      ...(stateOrProvince ? { stateOrProvince } : {}),
      ...(postalCode ? { postalCode } : {}),
    },
  };
}

async function importListingByLookupPath(
  config: ReturnType<typeof getListingImportConfig>,
  lookupPath: string,
  source: ImportedListing["source"],
  notFoundMessage: string,
  options?: {
    withMarketing?: boolean;
  }
) {
  const url = buildServiceUrl(config.baseUrl, lookupPath);
  const payload = await fetchServiceJson<ListingLookupResponse>(url, {
    method: "GET",
    headers: buildServiceHeaders(config.apiKey),
    cache: "no-store",
  });
  const listing = extractLookupListing(payload);

  if (!listing) {
    throw new Error(notFoundMessage);
  }

  const normalized = normalizeImportedListing(listing, source);
  const draft = mapListingToEventDraft(normalized);
  return options?.withMarketing === false
    ? draft
    : withMarketingCopy(draft, normalized);
}

async function fetchAddressResolution(
  config: ReturnType<typeof getListingImportConfig>,
  input: AddressImportInput
) {
  const { requestBody } = buildAddressLookupPayload(input);
  const url = buildServiceUrl(config.baseUrl, config.addressResolvePath);
  const response = await fetch(url, {
    method: "POST",
    headers: buildServiceHeaders(config.apiKey),
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });

  if (response.ok) {
    const payload = (await response.json()) as ListingLookupResponse;
    const listing = extractLookupListing(payload);
    if (!listing) {
      return { type: "not_found" as const };
    }

    const normalized = normalizeImportedListing(listing, "address");
    return {
      type: "single" as const,
      draft: await withMarketingCopy(mapListingToEventDraft(normalized), normalized),
    };
  }

  if (response.status === 404) {
    return { type: "not_found" as const };
  }

  if (response.status === 409) {
    const payload = (await response.json()) as { candidates?: unknown[] };
    const candidates = (Array.isArray(payload.candidates) ? payload.candidates : [])
      .map((candidate) => {
        if (!isRecord(candidate)) return null;
        return {
          listingKey: toStringValue(candidate.listingKey),
          listingId: toStringValue(candidate.listingId),
          address: toStringValue(candidate.address),
          city: toStringValue(candidate.city),
          stateOrProvince: toStringValue(candidate.stateOrProvince),
          postalCode: toStringValue(candidate.postalCode),
          standardStatus: toStringValue(candidate.standardStatus),
          confidence: toNumber(candidate.confidence),
          source: toStringValue(candidate.source),
        } satisfies ListingDataAddressCandidate;
      })
      .filter((candidate): candidate is ListingDataAddressCandidate => Boolean(candidate));

    return { type: "multiple" as const, candidates };
  }

  throw new Error(await parseServiceError(response, "Address import failed"));
}

async function fetchAddressCandidates(
  config: ReturnType<typeof getListingImportConfig>,
  input: AddressImportInput
) {
  const { requestBody } = buildAddressLookupPayload(input);
  const url = buildServiceUrl(config.baseUrl, config.addressCandidatesPath);
  const payload = await fetchServiceJson<unknown[]>(url, {
    method: "POST",
    headers: buildServiceHeaders(config.apiKey),
    body: JSON.stringify({
      ...requestBody,
      limit: 5,
    }),
    cache: "no-store",
  });

  return (Array.isArray(payload) ? payload : [])
    .map((candidate) => {
      if (!isRecord(candidate)) return null;
      return {
        listingKey: toStringValue(candidate.listingKey),
        listingId: toStringValue(candidate.listingId),
        address: toStringValue(candidate.address),
        city: toStringValue(candidate.city),
        stateOrProvince: toStringValue(candidate.stateOrProvince),
        postalCode: toStringValue(candidate.postalCode),
        standardStatus: toStringValue(candidate.standardStatus),
        confidence: toNumber(candidate.confidence),
        source: toStringValue(candidate.source),
      } satisfies ListingDataAddressCandidate;
    })
    .filter((candidate): candidate is ListingDataAddressCandidate => Boolean(candidate));
}

async function hydrateAddressCandidates(
  config: ReturnType<typeof getListingImportConfig>,
  candidates: ListingDataAddressCandidate[]
) {
  const hydratedDrafts: Array<EventImportDraft | null> = await Promise.all(
    candidates
      .filter((candidate) => candidate.listingKey)
      .slice(0, 5)
      .map(async (candidate) => {
        try {
          const draft = await importListingByLookupPath(
            config,
            config.byKeyPath.replace(
              ":listingKey",
              encodeURIComponent(candidate.listingKey as string)
            ),
            "address",
            `Listing ${candidate.listingKey} was not found`,
            { withMarketing: false }
          );

          const enrichedDraft: EventImportDraft = {
            ...draft,
            importSummary: {
              ...draft.importSummary,
              matchConfidence: candidate.confidence,
              matchedBy:
                candidate.confidence !== null && candidate.confidence >= 0.95
                  ? "exact address match"
                  : "address candidate",
              provider: candidate.source || "listing-data-service",
            },
          };

          return enrichedDraft;
        } catch {
          return null;
        }
      })
  );

  return hydratedDrafts.filter((draft) => draft !== null) as EventImportDraft[];
}

export async function importListingByMlsNumber(mlsNumber: string) {
  const config = getListingImportConfig();

  if (!config.baseUrl || !config.apiKey) {
    throw new Error("Listing import service is not configured");
  }

  const lookupPath = config.mlsPath.replace(":mlsId", encodeURIComponent(mlsNumber.trim()));
  return importListingByLookupPath(
    config,
    lookupPath,
    "mls",
    `Listing ${mlsNumber} was not found`,
    { withMarketing: true }
  );
}

export async function searchListingsByAddress(input: AddressImportInput | string) {
  const config = getListingImportConfig();
  const normalizedInput =
    typeof input === "string"
      ? { query: input }
      : {
          query: input.query,
          address: input.address,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
        };
  const normalizedQuery = normalizeAddressSearchQuery(normalizedInput.query);

  if (config.baseUrl && config.apiKey) {
    const resolution = await fetchAddressResolution(config, normalizedInput);

    if (resolution.type === "single") {
      return [resolution.draft];
    }

    const candidates =
      resolution.type === "multiple"
        ? resolution.candidates
        : await fetchAddressCandidates(config, normalizedInput);

    const drafts = await hydrateAddressCandidates(config, candidates);
    if (drafts.length > 0) {
      return drafts;
    }
  }

  const fallbackDrafts = await extractAddressCandidatesFromPublicWeb(normalizedQuery);

  if (fallbackDrafts.length > 0) {
    return fallbackDrafts;
  }

  if (!config.baseUrl || !config.apiKey) {
    throw new Error("Listing import service is not configured and no web fallback was available");
  }

  return [];
}

async function parsePdfText(fileBuffer: Buffer) {
  const parser = new PDFParse({ data: fileBuffer });
  const parsed = await parser.getText();
  await parser.destroy();
  return parsed.text?.trim() || "";
}

async function extractStructuredFlyerDataFromText(documentText: string) {
  if (!hasAiConfiguration()) {
    throw new Error("AI is not configured for flyer import");
  }

  const prompt = `Extract structured real-estate listing data from the following flyer or PDF text.

Return JSON only.

Rules:
- Preserve exact listing facts when available.
- If a field is missing, return null.
- property_type should be a human-readable phrase like "single family", "condo", "townhouse", "multi family", or "land".
- features should be a short array of notable highlights.
- faq should contain up to 4 concise Q&A pairs that a visitor would ask at an open house.
- nearby_poi should only include concrete information found in the document text.

Document text:
"""
${documentText.slice(0, 20000)}
"""`;

  const result = await chatCompletion({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1400,
    temperature: 0.2,
    responseFormat: "json",
  });

  const parsed = JSON.parse(result.content);
  return flyerExtractionSchema.parse(parsed);
}

async function extractStructuredFlyerDataFromImage(fileBuffer: Buffer, mimeType: string) {
  if (!hasAiConfiguration()) {
    throw new Error("AI is not configured for flyer import");
  }

  const prompt = `Extract structured real-estate listing data from this marketing flyer image.

Return JSON only.

Rules:
- Preserve exact listing facts when available.
- If a field is missing, return null.
- property_type should be a human-readable phrase like "single family", "condo", "townhouse", "multi family", or "land".
- features should be a short array of notable highlights.
- faq should contain up to 4 concise Q&A pairs that a visitor would ask at an open house.
- nearby_poi should only include concrete information visible in the flyer.`;

  const result = await chatCompletion({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: toDataUrl(fileBuffer, mimeType) } },
        ],
      },
    ],
    maxTokens: 1400,
    temperature: 0.2,
    responseFormat: "json",
  });

  const parsed = JSON.parse(result.content);
  return flyerExtractionSchema.parse(parsed);
}

export async function importListingFromFlyer(
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
) {
  const isPdf = mimeType === "application/pdf";
  const isSupportedImage = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mimeType);

  if (!isPdf && !isSupportedImage) {
    throw new Error("Only PDF, PNG, JPG, or WEBP flyers are supported");
  }

  const extracted = isPdf
    ? await (async () => {
        const extractedText = await parsePdfText(fileBuffer);

        if (!extractedText) {
          throw new Error("No text could be extracted from the uploaded PDF");
        }

        return extractStructuredFlyerDataFromText(extractedText);
      })()
    : await extractStructuredFlyerDataFromImage(fileBuffer, mimeType);
  const listing = normalizeImportedListing(
    {
      mls_number: extracted.mls_number,
      address: extracted.address,
      city: extracted.city,
      state: extracted.state,
      zip_code: extracted.zip_code,
      list_price: extracted.list_price,
      bedrooms: extracted.bedrooms,
      bathrooms: extracted.bathrooms,
      sqft: extracted.sqft,
      year_built: extracted.year_built,
      property_type: extracted.property_type,
      description: extracted.description,
      neighborhood: extracted.neighborhood,
      school_district: extracted.school_district,
      features: extracted.features,
    },
    "flyer"
  );

  const draft = mapListingToEventDraft(listing);
  const faq = extracted.faq?.slice(0, 4);
  const nearbyPoi = extracted.nearby_poi;

  return withMarketingCopy({
    ...draft,
    aiQaContext: {
      customFaq: faq && faq.length > 0 ? faq : draft.aiQaContext?.customFaq,
      mlsData: {
        ...(draft.aiQaContext?.mlsData ?? {}),
        importedSource: "flyer",
        importedAt: new Date().toISOString(),
        documentName: fileName,
      },
      nearbyPoi:
        nearbyPoi && Object.keys(nearbyPoi).length > 0
          ? nearbyPoi
          : draft.aiQaContext?.nearbyPoi,
    },
  } satisfies EventImportDraft, listing);
}
