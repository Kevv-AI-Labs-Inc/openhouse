import { describe, expect, it } from "vitest";
import {
  createEmptyEventFormState,
  applyImportedDraft,
  buildEventPayload,
} from "@/lib/event-form";
import type { EventImportDraft } from "@/lib/listing-import-shared";

describe("createEmptyEventFormState", () => {
  it("returns a form with all required string fields initialized", () => {
    const state = createEmptyEventFormState();

    expect(state.propertyAddress).toBe("");
    expect(state.mlsNumber).toBe("");
    expect(state.listPrice).toBe("");
    expect(state.propertyDescription).toBe("");
    expect(state.complianceText).toBe("");
    expect(state.propertyType).toBe("");
    expect(state.bedrooms).toBe("");
    expect(state.bathrooms).toBe("");
    expect(state.sqft).toBe("");
    expect(state.yearBuilt).toBe("");
  });

  it("defaults to open_house public mode", () => {
    const state = createEmptyEventFormState();
    expect(state.publicMode).toBe("open_house");
  });

  it("defaults to active status", () => {
    const state = createEmptyEventFormState();
    expect(state.status).toBe("active");
  });

  it("has valid ISO-like start and end times", () => {
    const state = createEmptyEventFormState();
    expect(state.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(state.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("end time is after start time", () => {
    const state = createEmptyEventFormState();
    expect(new Date(state.endTime).getTime()).toBeGreaterThan(
      new Date(state.startTime).getTime()
    );
  });

  it("starts with empty arrays and nulls", () => {
    const state = createEmptyEventFormState();
    expect(state.propertyPhotos).toEqual([]);
    expect(state.aiQaContext).toBeNull();
    expect(state.importSummary).toBeNull();
  });
});

describe("applyImportedDraft", () => {
  const baseDraft: EventImportDraft = {
    propertyAddress: "123 Main St, NY 10001",
    mlsNumber: "MLS12345",
    listPrice: "750000",
    propertyType: "condo",
    bedrooms: 2,
    bathrooms: "2",
    sqft: 1200,
    yearBuilt: 2005,
    propertyDescription: "Beautiful condo with city views.",
    propertyPhotos: ["https://example.com/photo1.jpg"],
    aiQaContext: null,
    importSummary: {
      source: "mls",
      headline: "Imported from MLS",
      subheadline: "",
      badges: ["MLS"],
    },
  };

  it("applies all draft fields to an empty form", () => {
    const empty = createEmptyEventFormState();
    const result = applyImportedDraft(empty, baseDraft);

    expect(result.propertyAddress).toBe("123 Main St, NY 10001");
    expect(result.mlsNumber).toBe("MLS12345");
    expect(result.listPrice).toBe("750000");
    expect(result.propertyType).toBe("condo");
    expect(result.bedrooms).toBe("2");
    expect(result.bathrooms).toBe("2");
    expect(result.sqft).toBe("1200");
    expect(result.yearBuilt).toBe("2005");
    expect(result.propertyDescription).toBe("Beautiful condo with city views.");
    expect(result.propertyPhotos).toEqual(["https://example.com/photo1.jpg"]);
  });

  it("preserves existing form values when draft fields are empty", () => {
    const existing = createEmptyEventFormState();
    existing.propertyAddress = "Existing address";
    existing.mlsNumber = "EXISTING-MLS";

    const sparseImport: EventImportDraft = {
      ...baseDraft,
      propertyAddress: "",
      mlsNumber: null,
      listPrice: null,
      bedrooms: null,
      sqft: null,
      yearBuilt: null,
      propertyPhotos: [],
    };

    const result = applyImportedDraft(existing, sparseImport);

    expect(result.propertyAddress).toBe("Existing address");
    expect(result.mlsNumber).toBe("EXISTING-MLS");
  });

  it("replaces import summary on every apply", () => {
    const empty = createEmptyEventFormState();
    const result = applyImportedDraft(empty, baseDraft);

    expect(result.importSummary).toEqual(baseDraft.importSummary);
  });

  it("preserves time fields from the original form", () => {
    const existing = createEmptyEventFormState();
    const originalStart = existing.startTime;
    const originalEnd = existing.endTime;

    const result = applyImportedDraft(existing, baseDraft);

    expect(result.startTime).toBe(originalStart);
    expect(result.endTime).toBe(originalEnd);
  });
});

describe("buildEventPayload", () => {
  it("converts string numbers to actual numbers", () => {
    const form = createEmptyEventFormState();
    form.propertyAddress = "123 Main St";
    form.bedrooms = "3";
    form.bathrooms = "2.5";
    form.sqft = "1800";
    form.yearBuilt = "2010";

    const payload = buildEventPayload(form);

    expect(payload.bedrooms).toBe(3);
    expect(payload.bathrooms).toBe(2.5);
    expect(payload.sqft).toBe(1800);
    expect(payload.yearBuilt).toBe(2010);
  });

  it("omits empty string fields as undefined", () => {
    const form = createEmptyEventFormState();
    form.propertyAddress = "456 Oak";

    const payload = buildEventPayload(form);

    expect(payload.mlsNumber).toBeUndefined();
    expect(payload.listPrice).toBeUndefined();
    expect(payload.propertyDescription).toBeUndefined();
    expect(payload.complianceText).toBeUndefined();
    expect(payload.bedrooms).toBeUndefined();
  });

  it("produces valid ISO timestamps", () => {
    const form = createEmptyEventFormState();
    form.propertyAddress = "789 Pine";

    const payload = buildEventPayload(form);

    expect(() => new Date(payload.startTime).toISOString()).not.toThrow();
    expect(() => new Date(payload.endTime).toISOString()).not.toThrow();
  });

  it("omits empty photo arrays", () => {
    const form = createEmptyEventFormState();
    form.propertyAddress = "Test";

    const payload = buildEventPayload(form);
    expect(payload.propertyPhotos).toBeUndefined();
  });

  it("includes photo arrays when populated", () => {
    const form = createEmptyEventFormState();
    form.propertyAddress = "Test";
    form.propertyPhotos = ["https://example.com/a.jpg"];

    const payload = buildEventPayload(form);
    expect(payload.propertyPhotos).toEqual(["https://example.com/a.jpg"]);
  });

  it("trims whitespace from string fields", () => {
    const form = createEmptyEventFormState();
    form.propertyAddress = "Test";
    form.mlsNumber = "  MLS-123  ";
    form.listPrice = "  500000  ";
    form.propertyDescription = "  Nice place  ";

    const payload = buildEventPayload(form);

    expect(payload.mlsNumber).toBe("MLS-123");
    expect(payload.listPrice).toBe("500000");
    expect(payload.propertyDescription).toBe("Nice place");
  });
});
