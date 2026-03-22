type GooglePlacesAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      types?: string[];
    };
  }>;
};

type GooglePlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  shortFormattedAddress?: string;
  displayName?: { text?: string };
  postalAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

export type GoogleAddressSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string | null;
  fullText: string;
  types: string[];
};

export type ResolvedGoogleAddress = {
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

const GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const GOOGLE_PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places";

function getGooglePlacesApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
}

export function isGooglePlacesConfigured() {
  return Boolean(getGooglePlacesApiKey());
}

function toTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function fetchGooglePlacesJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fieldMask?: string
) {
  const apiKey = getGooglePlacesApiKey();

  if (!apiKey) {
    throw new Error("Google Places is not configured");
  }

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-Goog-Api-Key", apiKey);

  if (fieldMask) {
    headers.set("X-Goog-FieldMask", fieldMask);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      (payload && typeof payload === "object" && "error" in payload
        ? ((payload as { error?: { message?: string } }).error?.message ?? null)
        : null) || "Google Places request failed";

    throw new Error(errorMessage);
  }

  return payload as T;
}

export async function suggestGoogleAddresses(query: string, sessionToken: string) {
  const input = query.trim();

  if (!input) {
    return [] as GoogleAddressSuggestion[];
  }

  const payload = await fetchGooglePlacesJson<GooglePlacesAutocompleteResponse>(
    GOOGLE_PLACES_AUTOCOMPLETE_URL,
    {
      method: "POST",
      body: JSON.stringify({
        input,
        sessionToken,
        includeQueryPredictions: false,
        languageCode: "en",
        regionCode: "US",
        includedRegionCodes: ["us"],
      }),
    },
    [
      "suggestions.placePrediction.placeId",
      "suggestions.placePrediction.text.text",
      "suggestions.placePrediction.structuredFormat.mainText.text",
      "suggestions.placePrediction.structuredFormat.secondaryText.text",
      "suggestions.placePrediction.types",
    ].join(",")
  );

  return (payload.suggestions ?? [])
    .map((item) => item.placePrediction)
    .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId))
    .map((prediction) => {
      const fullText =
        toTrimmedString(prediction.text?.text) ||
        [
          toTrimmedString(prediction.structuredFormat?.mainText?.text),
          toTrimmedString(prediction.structuredFormat?.secondaryText?.text),
        ]
          .filter(Boolean)
          .join(", ");

      return {
        placeId: prediction.placeId as string,
        primaryText:
          toTrimmedString(prediction.structuredFormat?.mainText?.text) || fullText || "Address match",
        secondaryText: toTrimmedString(prediction.structuredFormat?.secondaryText?.text),
        fullText: fullText || "Address match",
        types: Array.isArray(prediction.types) ? prediction.types.filter(Boolean) : [],
      } satisfies GoogleAddressSuggestion;
    })
    .filter((suggestion) => suggestion.fullText);
}

export async function resolveGoogleAddress(placeId: string, sessionToken?: string) {
  const normalizedPlaceId = placeId.trim();

  if (!normalizedPlaceId) {
    throw new Error("Google Places placeId is required");
  }

  const detailsUrl = new URL(
    `${GOOGLE_PLACES_DETAILS_URL}/${encodeURIComponent(normalizedPlaceId)}`
  );
  detailsUrl.searchParams.set("languageCode", "en");
  detailsUrl.searchParams.set("regionCode", "US");

  if (sessionToken?.trim()) {
    detailsUrl.searchParams.set("sessionToken", sessionToken.trim());
  }

  const payload = await fetchGooglePlacesJson<GooglePlaceDetailsResponse>(
    detailsUrl,
    { method: "GET" },
    [
      "id",
      "formattedAddress",
      "shortFormattedAddress",
      "displayName.text",
      "postalAddress.addressLines",
      "postalAddress.locality",
      "postalAddress.administrativeArea",
      "postalAddress.postalCode",
      "postalAddress.regionCode",
      "location.latitude",
      "location.longitude",
    ].join(",")
  );

  const postal = payload.postalAddress;
  const formattedAddress =
    toTrimmedString(payload.formattedAddress) ||
    toTrimmedString(payload.shortFormattedAddress) ||
    toTrimmedString(payload.displayName?.text);

  if (!formattedAddress) {
    throw new Error("Google Places could not resolve that address");
  }

  return {
    placeId: payload.id || normalizedPlaceId,
    formattedAddress,
    shortFormattedAddress: toTrimmedString(payload.shortFormattedAddress),
    addressLine1: Array.isArray(postal?.addressLines)
      ? toTrimmedString(postal?.addressLines.filter(Boolean).join(", "))
      : null,
    city: toTrimmedString(postal?.locality),
    state: toTrimmedString(postal?.administrativeArea),
    postalCode: toTrimmedString(postal?.postalCode),
    countryCode: toTrimmedString(postal?.regionCode),
    latitude:
      typeof payload.location?.latitude === "number" ? payload.location.latitude : null,
    longitude:
      typeof payload.location?.longitude === "number" ? payload.location.longitude : null,
  } satisfies ResolvedGoogleAddress;
}

