export const openHousePropertyTypes = [
  "single_family",
  "condo",
  "townhouse",
  "multi_family",
  "land",
  "other",
] as const;

export type OpenHousePropertyType = (typeof openHousePropertyTypes)[number];

export const publicModes = ["open_house", "listing_inquiry"] as const;

export type PublicMode = (typeof publicModes)[number];

export type EventPropertyFacts = {
  financial?: {
    isCoop?: boolean | null;
    annualTaxes?: number | null;
    taxYear?: number | null;
    monthlyTaxes?: number | null;
    commonCharges?: number | null;
    commonChargesFrequency?: string | null;
    maintenanceFee?: number | null;
    maintenanceFeeFrequency?: string | null;
    maintenanceFeeEstimated?: boolean | null;
    hoaFee?: number | null;
    hoaFeeFrequency?: string | null;
    hoaFee2?: number | null;
    hoaFee2Frequency?: string | null;
    feeIncludes?: string[];
    assessmentFee?: number | null;
    assessmentFeeFrequency?: string | null;
    estimatedMonthlyCarry?: number | null;
    flipTax?: string | null;
    taxAbatement?: string | null;
    notes?: string[];
  };
  schools?: {
    district?: string | null;
    elementary?: string | null;
    middle?: string | null;
    high?: string | null;
    schools?: string[];
  };
  building?: {
    buildingType?: string | null;
    parking?: string[];
    garageSpaces?: number | null;
    parkingTotal?: number | null;
    laundry?: string[];
    petPolicy?: string | null;
    amenities?: string[];
    outdoorSpace?: string[];
    utilitiesIncluded?: string[];
    utilities?: string[];
    waterSource?: string[];
    sewer?: string[];
    doorman?: boolean | null;
    elevator?: boolean | null;
    gym?: boolean | null;
    pool?: boolean | null;
    storage?: boolean | null;
  };
  interior?: {
    appliances?: string[];
    heating?: string[];
    cooling?: string[];
  };
  policies?: {
    subletAllowed?: string | null;
    piedATerreAllowed?: string | null;
    financingAllowed?: string | null;
    occupancyNotes?: string[];
  };
  neighborhood?: {
    name?: string | null;
    nearbyTransit?: string[];
    nearbyHighlights?: string[];
  };
  listing?: {
    status?: string | null;
    daysOnMarket?: number | null;
    virtualTourUrl?: string | null;
    source?: string | null;
    fallbackUsed?: boolean | null;
  };
  market?: {
    medianSoldPrice?: number | null;
    medianPricePerSqft?: number | null;
    saleWindowDays?: number | null;
    source?: string | null;
    narrative?: string | null;
    comparableSales?: Array<{
      address?: string | null;
      soldPrice?: number | null;
      soldAt?: string | null;
      beds?: number | null;
      baths?: string | null;
      sqft?: number | null;
      distanceMiles?: number | null;
      notes?: string | null;
    }>;
  };
};

export type EventAiQaContext = {
  customFaq?: Array<{ question: string; answer: string }>;
  mlsData?: Record<string, unknown>;
  propertyFacts?: EventPropertyFacts;
  nearbyPoi?: Record<string, unknown>;
  agentNotes?: string;
};

export type EventImportDraft = {
  propertyAddress: string;
  mlsNumber: string | null;
  listPrice: string | null;
  propertyType: OpenHousePropertyType | null;
  bedrooms: number | null;
  bathrooms: string | null;
  sqft: number | null;
  yearBuilt: number | null;
  propertyDescription: string | null;
  propertyPhotos: string[];
  aiQaContext: EventAiQaContext | null;
  importSummary: {
    source: "mls" | "address" | "flyer";
    headline: string;
    subheadline: string;
    badges: string[];
    matchConfidence?: number | null;
    matchedBy?: string | null;
    provider?: string | null;
  };
};
