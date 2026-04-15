/**
 * Type Safety Regression Tests
 *
 * Validates that critical type exports and interfaces haven't drifted.
 * These tests catch breaking type changes that wouldn't be caught by runtime tests.
 */
import { describe, expect, it } from "vitest";
import { openHousePropertyTypes, publicModes } from "@/lib/listing-import-shared";
import type {
  OpenHousePropertyType,
  PublicMode,
  EventImportDraft,
  EventAiQaContext,
  EventPropertyFacts,
} from "@/lib/listing-import-shared";
import type { SellerReportSignIn, SellerReportBenchmark } from "@/lib/seller-report";
import type { PublicSignInPayload } from "@/lib/public-signin";
import type { FeatureAccessTier, PlanTier, SellerReportAccess } from "@/lib/plans";
import type { FollowUpEmailMode } from "@/lib/follow-up-email";
import type { PublicListingMarketing } from "@/lib/public-listing-view";

describe("listing-import-shared constants", () => {
  it("property types include all expected values", () => {
    const expected = ["single_family", "condo", "townhouse", "multi_family", "land", "other"];
    expect([...openHousePropertyTypes]).toEqual(expected);
  });

  it("public modes include all expected values", () => {
    expect([...publicModes]).toEqual(["open_house", "listing_inquiry"]);
  });
});

describe("type shape contracts", () => {
  it("EventImportDraft has all required fields", () => {
    // This test serves as a compile-time contract.
    // If any field is removed from EventImportDraft, this test will fail to compile.
    const draft: EventImportDraft = {
      propertyAddress: "123 Main St",
      mlsNumber: null,
      listPrice: null,
      propertyType: null,
      bedrooms: null,
      bathrooms: null,
      sqft: null,
      yearBuilt: null,
      propertyDescription: null,
      propertyPhotos: [],
      aiQaContext: null,
      importSummary: {
        source: "mls",
        headline: "Test",
        subheadline: "",
        badges: [],
      },
    };

    expect(draft.propertyAddress).toBeTruthy();
    expect(draft.importSummary.source).toBe("mls");
  });

  it("EventImportDraft.importSummary.source only allows valid values", () => {
    // Compile-time assertion: these are the only allowed source types
    const validSources: Array<EventImportDraft["importSummary"]["source"]> = [
      "mls",
      "address",
      "flyer",
    ];

    expect(validSources).toHaveLength(3);
  });

  it("PublicSignInPayload requires fullName, phone, and email", () => {
    const payload: PublicSignInPayload = {
      fullName: "Taylor",
      phone: "555-000-0000",
      email: "test@example.com",
    };

    expect(payload.fullName).toBeTruthy();
    expect(payload.phone).toBeTruthy();
    expect(payload.email).toBeTruthy();
  });

  it("FeatureAccessTier is a union of free | trial_pro | pro", () => {
    const tiers: FeatureAccessTier[] = ["free", "trial_pro", "pro"];
    expect(tiers).toHaveLength(3);
  });

  it("PlanTier is either free or pro", () => {
    const tiers: PlanTier[] = ["free", "pro"];
    expect(tiers).toHaveLength(2);
  });

  it("SellerReportAccess is either basic or detailed", () => {
    const access: SellerReportAccess[] = ["basic", "detailed"];
    expect(access).toHaveLength(2);
  });

  it("FollowUpEmailMode covers all 4 modes", () => {
    const modes: FollowUpEmailMode[] = ["draft", "google", "microsoft", "custom_domain"];
    expect(modes).toHaveLength(4);
  });

  it("PublicListingMarketing has the expected shape", () => {
    const marketing: PublicListingMarketing = {
      headline: "Test",
      summary: null,
      highlights: ["Feature 1"],
    };

    expect(marketing).toHaveProperty("headline");
    expect(marketing).toHaveProperty("summary");
    expect(marketing).toHaveProperty("highlights");
  });

  it("SellerReportSignIn has all required fields", () => {
    const signIn: SellerReportSignIn = {
      id: 1,
      fullName: "T",
      phone: null,
      email: null,
      captureMode: null,
      hasAgent: false,
      isPreApproved: null,
      interestLevel: null,
      buyingTimeline: null,
      priceRange: null,
      leadTier: null,
      leadScore: null,
      signedInAt: new Date().toISOString(),
    };

    expect(signIn.id).toBe(1);
  });

  it("SellerReportBenchmark.confidence is a strict union", () => {
    const valid: Array<SellerReportBenchmark["confidence"]> = [
      "thin",
      "directional",
      "solid",
    ];

    expect(valid).toHaveLength(3);
  });

  it("EventPropertyFacts has all category groups", () => {
    const facts: EventPropertyFacts = {
      financial: { annualTaxes: 12000 },
      schools: { district: "NYC DOE" },
      building: { doorman: true },
      interior: { appliances: ["Dishwasher"] },
      policies: { subletAllowed: "yes" },
      neighborhood: { name: "Brooklyn Heights" },
      listing: { status: "active" },
      market: { medianSoldPrice: 975000 },
    };

    expect(Object.keys(facts)).toHaveLength(8);
  });
});
