import { describe, expect, it } from "vitest";
import { buildPublicListingMarketing } from "@/lib/public-listing-view";

describe("buildPublicListingMarketing", () => {
  it("generates a fallback headline from property stats", () => {
    const result = buildPublicListingMarketing({
      propertyAddress: "123 Main St, Brooklyn, NY",
      propertyType: "condo",
      bedrooms: 2,
      bathrooms: "2",
      sqft: 1200,
    });

    expect(result.headline).toBeTruthy();
    expect(result.headline).toContain("2-bed");
    expect(result.headline).toContain("condo");
  });

  it("uses address-derived headline when no stats are available", () => {
    const result = buildPublicListingMarketing({
      propertyAddress: "789 Unknown Dr, Nowhere",
    });

    // Falls back to "home in {first part of address}" when no stats
    expect(result.headline).toContain("789 Unknown Dr");
  });

  it("uses marketing headline from MLS data when available", () => {
    const result = buildPublicListingMarketing({
      propertyAddress: "123 Main St",
      aiQaContext: {
        mlsData: {
          marketingHeadline: "Stunning Corner Penthouse With Skyline Views",
        },
      },
    });

    expect(result.headline).toBe("Stunning Corner Penthouse With Skyline Views");
  });

  it("clips summaries to a reasonable length", () => {
    const longDescription = "A ".repeat(200) + "very nice home with lots of features.";
    const result = buildPublicListingMarketing({
      propertyAddress: "123 Main St",
      propertyDescription: longDescription,
    });

    if (result.summary) {
      expect(result.summary.length).toBeLessThanOrEqual(300);
    }
  });

  it("returns empty highlights when no data is available", () => {
    const result = buildPublicListingMarketing({
      propertyAddress: "123 Main St",
    });

    expect(result.highlights).toEqual([]);
  });

  it("extracts highlights from MLS features", () => {
    const result = buildPublicListingMarketing({
      propertyAddress: "123 Main St",
      aiQaContext: {
        mlsData: {
          features: ["Hardwood floors", "Central AC", "In-unit laundry"],
        },
      },
    });

    expect(result.highlights.length).toBeGreaterThan(0);
    expect(result.highlights).toContain("Hardwood floors");
  });

  it("limits highlights to 4 items max", () => {
    const result = buildPublicListingMarketing({
      propertyAddress: "123 Main St",
      aiQaContext: {
        mlsData: {
          features: ["A", "B", "C", "D", "E", "F", "G"],
        },
      },
    });

    expect(result.highlights.length).toBeLessThanOrEqual(4);
  });

  it("deduplicates highlights", () => {
    const result = buildPublicListingMarketing({
      propertyAddress: "123 Main St",
      aiQaContext: {
        mlsData: {
          features: ["Hardwood floors", "Hardwood floors", "Central AC"],
          marketingHighlights: ["Hardwood floors"],
        },
      },
    });

    const hardwoodCount = result.highlights.filter(
      (h) => h === "Hardwood floors"
    ).length;
    expect(hardwoodCount).toBeLessThanOrEqual(1);
  });

  it("builds summary from property facts when no description", () => {
    const result = buildPublicListingMarketing({
      propertyAddress: "123 Main St",
      propertyType: "townhouse",
      bedrooms: 3,
      bathrooms: "2.5",
      sqft: 2000,
      yearBuilt: 1990,
    });

    expect(result.summary).toBeTruthy();
    expect(result.summary).toContain("3 bedrooms");
  });

  it("formats underscored property types into title case", () => {
    const result = buildPublicListingMarketing({
      propertyAddress: "123 Main St, Brooklyn, NY",
      propertyType: "single_family",
      bedrooms: 4,
    });

    expect(result.headline).toContain("single family");
  });

  it("handles null property type gracefully as 'home'", () => {
    const result = buildPublicListingMarketing({
      propertyAddress: "123 Main St, Brooklyn, NY",
      bedrooms: 2,
      bathrooms: "1",
      sqft: 800,
    });

    expect(result.headline).toContain("home");
  });
});
