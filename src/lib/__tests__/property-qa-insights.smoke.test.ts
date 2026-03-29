import {
  buildPropertyQaRecoveryQuestions,
  detectPropertyQaTopic,
  getPropertyQaInsights,
} from "@/lib/property-qa-insights";

describe("property qa insights smoke", () => {
  it("scores well-covered listings and surfaces targeted starter questions", () => {
    const insights = getPropertyQaInsights({
      propertyAddress: "123 Main St",
      listPrice: "1250000",
      propertyDescription: "Bright condo with open layout.",
      bedrooms: 2,
      bathrooms: "2",
      sqft: 1200,
      yearBuilt: 2008,
      aiQaContext: {
        customFaq: [{ question: "Is parking available?", answer: "Yes, garage parking is available." }],
        agentNotes: "Seller prefers afternoon showings.",
        propertyFacts: {
          financial: { annualTaxes: 12450, commonCharges: 925 },
          schools: { district: "District 2" },
          building: { parking: ["Garage"], petPolicy: "Pets allowed", amenities: ["Gym"] },
          interior: { appliances: ["Washer/Dryer"], cooling: ["Central air"] },
          policies: { financingAllowed: "Yes" },
          neighborhood: { nearbyTransit: ["A train"], nearbyHighlights: ["Waterfront park"] },
        },
        nearbyPoi: { highlights: ["Waterfront park", "Whole Foods"] },
        mlsData: { importedSource: "mls", schoolDistrict: "District 2" },
      },
    });

    expect(insights.level).toBe("strong");
    expect(insights.score).toBeGreaterThanOrEqual(75);
    expect(insights.publishReadiness.status).toBe("ready");
    expect(insights.suggestedQuestions).toContain(
      "What taxes, HOA, or monthly carrying costs should buyers know?"
    );
    expect(insights.suggestedQuestions).toContain(
      "What amenities, parking, laundry, or pet policies come with the property?"
    );
  });

  it("marks a thin but basically identified listing as review instead of blocked", () => {
    const insights = getPropertyQaInsights({
      propertyAddress: "123 Main St",
      aiQaContext: null,
    });

    expect(insights.level).toBe("thin");
    expect(insights.publishReadiness.status).toBe("review");
    expect(insights.suggestedQuestions.length).toBeGreaterThanOrEqual(3);
    expect(insights.missingLabels).toContain("Taxes and carry");
    expect(insights.publishReadiness.recommendedActions).toContain(
      "Add at least a few custom FAQ answers or agent notes before relying on the public chat."
    );
  });

  it("blocks when even the core listing facts are missing", () => {
    const insights = getPropertyQaInsights({
      aiQaContext: null,
    });

    expect(insights.publishReadiness.status).toBe("blocked");
    expect(insights.publishReadiness.summary).toContain("missing too many core facts");
  });

  it("builds recovery prompts away from the missing topic when possible", () => {
    expect(detectPropertyQaTopic("What school district serves this home?")).toBe("schools");

    const prompts = buildPropertyQaRecoveryQuestions(
      {
        propertyAddress: "123 Main St",
        aiQaContext: {
          propertyFacts: {
            financial: { annualTaxes: 12450 },
            building: { amenities: ["Gym"] },
            neighborhood: { nearbyTransit: ["A train"] },
          },
        },
      },
      "What school district serves this home?"
    );

    expect(prompts).not.toContain("What school district or nearby schools serve this property?");
    expect(prompts).toContain("What taxes, HOA, or monthly carrying costs should buyers know?");
  });
});
