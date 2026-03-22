import type {
  EventAiQaContext,
  EventImportDraft,
  OpenHousePropertyType,
  PublicMode,
} from "@/lib/listing-import-shared";

export type EventFormState = {
  propertyAddress: string;
  mlsNumber: string;
  listPrice: string;
  propertyDescription: string;
  complianceText: string;
  startTime: string;
  endTime: string;
  publicMode: PublicMode;
  status: string;
  propertyType: OpenHousePropertyType | "";
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  yearBuilt: string;
  propertyPhotos: string[];
  aiQaContext: EventAiQaContext | null;
  importSummary: EventImportDraft["importSummary"] | null;
};

function toLocalDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDefaultEventWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(Math.max(start.getHours(), 10));

  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  return {
    startTime: toLocalDateTimeValue(start),
    endTime: toLocalDateTimeValue(end),
  };
}

export function createEmptyEventFormState(): EventFormState {
  const defaults = getDefaultEventWindow();
  return {
    propertyAddress: "",
    mlsNumber: "",
    listPrice: "",
    propertyDescription: "",
    complianceText: "",
    startTime: defaults.startTime,
    endTime: defaults.endTime,
    publicMode: "open_house",
    status: "active",
    propertyType: "",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    yearBuilt: "",
    propertyPhotos: [],
    aiQaContext: null,
    importSummary: null,
  };
}

export function applyImportedDraft(
  current: EventFormState,
  draft: EventImportDraft
): EventFormState {
  return {
    ...current,
    propertyAddress: draft.propertyAddress || current.propertyAddress,
    mlsNumber: draft.mlsNumber || current.mlsNumber,
    listPrice: draft.listPrice || current.listPrice,
    propertyDescription: draft.propertyDescription || current.propertyDescription,
    propertyType: draft.propertyType || current.propertyType,
    bedrooms:
      draft.bedrooms !== null && draft.bedrooms !== undefined
        ? String(draft.bedrooms)
        : current.bedrooms,
    bathrooms: draft.bathrooms || current.bathrooms,
    sqft: draft.sqft !== null && draft.sqft !== undefined ? String(draft.sqft) : current.sqft,
    yearBuilt:
      draft.yearBuilt !== null && draft.yearBuilt !== undefined
        ? String(draft.yearBuilt)
        : current.yearBuilt,
    propertyPhotos: draft.propertyPhotos.length > 0 ? draft.propertyPhotos : current.propertyPhotos,
    aiQaContext: draft.aiQaContext || current.aiQaContext,
    importSummary: draft.importSummary,
  };
}

export function buildEventPayload(form: EventFormState) {
  const defaults = getDefaultEventWindow();
  const startTime = form.startTime || defaults.startTime;
  const endTime = form.endTime || defaults.endTime;
  return {
    propertyAddress: form.propertyAddress,
    mlsNumber: form.mlsNumber.trim() || undefined,
    listPrice: form.listPrice.trim() || undefined,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    publicMode: form.publicMode,
    propertyDescription: form.propertyDescription.trim() || undefined,
    complianceText: form.complianceText.trim() || undefined,
    status: form.status,
    propertyType: form.propertyType || undefined,
    bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
    bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
    sqft: form.sqft ? Number(form.sqft) : undefined,
    yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : undefined,
    propertyPhotos: form.propertyPhotos.length > 0 ? form.propertyPhotos : undefined,
    aiQaContext: form.aiQaContext || undefined,
  };
}
