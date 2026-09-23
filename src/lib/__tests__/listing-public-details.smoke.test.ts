import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatCompletion } from "@/lib/ai/openai";
import { chatWithProperty } from "@/lib/ai/property-qa";
import { importListingByMlsNumber, mapListingToEventDraft, normalizeImportedListing } from "@/lib/listing-import";
import { financialFactLines, sourceAmount } from "@/lib/property-costs";

vi.mock("pdf-parse", () => ({ PDFParse: class {} }));
vi.mock("@/lib/ai/openai", () => ({ hasAiConfiguration: () => false, chatCompletion: vi.fn() }));
vi.mock("@/lib/ai/web-search", () => ({ hasWebSearchConfiguration: () => false, searchPublicWeb: vi.fn() }));

const condo = {
  listingKey: "KEY-conformance-condo", listingId: "TEST123", address: "1 Example Street",
  city: "Flushing", stateOrProvince: "NY", postalCode: "11354",
  propertyType: "Residential", propertySubType: "Condominium", listPrice: 750000,
  daysOnMarket: 0, taxAnnualAmount: 0, taxYear: 2026,
  publicDetails: {
    associationFee: 1160, associationFeeFrequency: "Quarterly", associationFee2: 0,
    associationFeeIncludes: ["Gas", "Heat", "Water"], associationAmenities: ["Elevator"],
    petsAllowed: ["Call"], parkingFeatures: ["Waitlist"], garageSpaces: 0, parkingTotal: 1,
    laundryFeatures: ["Common Area"], appliances: ["Dishwasher"], heating: ["Natural Gas"],
    cooling: ["Central Air"], interiorFeatures: ["Entrance Foyer"], exteriorFeatures: ["Balcony"],
    utilities: ["Electricity Connected"], waterSource: ["Public"], sewer: ["Public Sewer"],
    elementarySchool: "Example Elementary", middleOrJuniorSchool: "Example Middle",
    highSchool: "Example High", highSchoolDistrict: "Queens 25",
  },
};

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("BBO public listing details", () => {
  it("keeps canonical listing facts, zero fees, billing periods, schools and lookup media", () => {
    const listing = normalizeImportedListing({
      listing: condo, property: { listPrice: 1 }, source: "bbo",
      media: [{ displayUrl: "https://example.com/photo.jpg" }],
    }, "mls");
    const draft = mapListingToEventDraft(listing);
    expect(listing.propertyType).toBe("condo");
    expect(listing.listPrice).toBe(750000);
    expect(draft.propertyPhotos).toEqual(["https://example.com/photo.jpg"]);
    expect(draft.aiQaContext?.propertyFacts?.financial).toMatchObject({
      annualTaxes: 0, taxYear: 2026, hoaFee: 1160, hoaFeeFrequency: "Quarterly",
      hoaFee2: 0, hoaFee2Frequency: null, estimatedMonthlyCarry: null,
      feeIncludes: ["Gas", "Heat", "Water"],
    });
    expect(listing.propertyFacts?.schools).toMatchObject({
      district: "Queens 25", elementary: "Example Elementary", middle: "Example Middle", high: "Example High",
    });
    expect(listing.propertyFacts?.building).toMatchObject({
      petPolicy: "Call", parking: ["Waitlist"], garageSpaces: 0, parkingTotal: 1,
      utilities: ["Electricity Connected"], waterSource: ["Public"], sewer: ["Public Sewer"],
    });
    expect(listing.propertyFacts?.interior).toEqual({ appliances: ["Dishwasher"], heating: ["Natural Gas"], cooling: ["Central Air"] });
    const faq = draft.aiQaContext?.customFaq?.find(item => item.question.includes("costs"));
    expect(faq?.answer).toContain("Annual taxes (2026): $0.00 / year");
    expect(faq?.answer).toContain("HOA fee: $1,160.00 / quarter");
    expect(faq?.answer).toContain("Additional association fee: $0.00 (billing period not provided)");
    expect(faq?.answer).not.toContain("/ month");
  });

  it("preserves estimated co-op maintenance without gating on association flag or adding taxes", () => {
    const listing = normalizeImportedListing({ property: {
      propertySubType: "Stock Cooperative", associationYN: false, taxAnnualAmount: 1200,
      publicDetails: { monthlyMaintenanceFee: 732, maintenanceFeeEstimated: true },
    } }, "mls");
    expect(listing.propertyFacts?.financial).toMatchObject({
      isCoop: true,
      maintenanceFee: 732, maintenanceFeeFrequency: "Monthly", maintenanceFeeEstimated: true,
      annualTaxes: 1200, estimatedMonthlyCarry: null, hoaFee: null,
    });
    expect(financialFactLines(listing.propertyFacts?.financial)).toContain("Estimated maintenance: $732.00 / month");
    expect(financialFactLines(listing.propertyFacts?.financial)).toContain("Reported annual tax: $1,200.00 / year");
    expect(financialFactLines(listing.propertyFacts?.financial)).toContain("Co-op tax may be building-level or included in maintenance; confirm unit costs with management.");
  });

  it("does not convert blank or qualified legacy amounts to fees or infer their period", () => {
    const financial = normalizeImportedListing({
      AssociationFee: "approximately 500", TaxAnnualAmount: "", MaintenanceFee: 700,
      estimatedMonthlyCarry: 1000,
    }, "mls").propertyFacts?.financial;
    expect(financial).toMatchObject({ annualTaxes: null, hoaFee: null, maintenanceFee: 700, maintenanceFeeFrequency: null, estimatedMonthlyCarry: null });
    expect(financialFactLines(financial)).toEqual(["Maintenance: $700.00 (billing period not provided)"]);
  });

  it.each(["listing", "property", "data"])("imports the %s response envelope through the API path", async envelope => {
    vi.stubEnv("LISTING_DATA_API_URL", "https://bbo.example.test");
    vi.stubEnv("LISTING_DATA_API_KEY", "fixture-key");
    const body = {
      ...(envelope === "data" ? { data: { listing: condo } } : { [envelope]: condo }),
      imageUrls: ["https://example.com/lookup-photo.jpg"], source: "bbo",
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const draft = await importListingByMlsNumber("TEST123");
    expect(draft.propertyAddress).toContain("1 Example Street");
    expect(draft.propertyPhotos).toEqual(body.imageUrls);
    expect(draft.aiQaContext?.propertyFacts?.financial?.hoaFeeFrequency).toBe("Quarterly");
  });
});

describe("source cost boundaries and historic snapshots", () => {
  it.each([undefined, null, "", " ", "approximately 700", "$700", "700 monthly", "-1", -1, Infinity, NaN, "1,16", true])("rejects invalid source amount %s", value => {
    expect(sourceAmount(value)).toBeNull();
  });
  it.each([0, "0", "0.00"])("retains explicit zero %s", value => expect(sourceAmount(value)).toBe(0));
  it("supports exact comma-separated amounts and unknown source frequencies without guessing", () => {
    expect(sourceAmount("1,160.25")).toBe(1160.25);
    expect(financialFactLines({ hoaFee: 120, hoaFeeFrequency: "One Time", maintenanceFee: 800, estimatedMonthlyCarry: 920 })).toEqual([
      "Maintenance: $800.00 (billing period not provided)", "HOA fee: $120.00 (One Time)",
    ]);
  });

  it("uses the legacy snapshot building type to qualify co-op taxes", () => {
    const lines = financialFactLines({ annualTaxes: 2400, maintenanceFee: 732 }, "Stock Cooperative");
    expect(lines).toContain("Reported annual tax: $2,400.00 / year");
    expect(lines).toContain("Co-op tax may be building-level or included in maintenance; confirm unit costs with management.");
    expect(lines).not.toContain("Annual taxes: $2,400.00 / year");
  });

  beforeEach(() => {
    vi.mocked(chatCompletion).mockResolvedValue({ content: JSON.stringify({ answer: "Confirm the billing period with your agent.", sourceKeys: ["listing_facts"], answerQuality: "direct" }), tokensUsed: 10 });
  });

  it("gives Q&A the explicit source periods and guards older snapshot carry totals", async () => {
    const listing = normalizeImportedListing({ listing: condo }, "mls");
    await chatWithProperty({ propertyAddress: listing.address, propertyFacts: listing.propertyFacts }, "What are the fees?");
    const prompt = JSON.stringify(vi.mocked(chatCompletion).mock.calls[0][0].messages);
    expect(prompt).toContain("HOA fee: $1,160.00 / quarter");
    expect(prompt).toContain("Garage spaces: 0");
    expect(prompt).toContain("Pet policy: Call");
    expect(prompt).toContain("Do not sum property taxes and maintenance");
    vi.mocked(chatCompletion).mockClear();
    await chatWithProperty({ propertyAddress: "Example", propertyFacts: { financial: { hoaFee: 300, estimatedMonthlyCarry: 999 } } }, "What are the fees?");
    const oldPrompt = JSON.stringify(vi.mocked(chatCompletion).mock.calls[0][0].messages);
    expect(oldPrompt).toContain("HOA fee: $300.00 (billing period not provided)");
    expect(oldPrompt).not.toContain("$999");
    expect(oldPrompt).not.toContain("$300.00 / month");
  });
});
