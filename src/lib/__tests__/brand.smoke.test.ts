import { describe, expect, it } from "vitest";
import { brand } from "@/lib/brand";

describe("brand constants", () => {
  it("has required structural fields", () => {
    expect(brand.name).toBe("OpenHouse");
    expect(brand.legalName).toBe("OpenHouse Pro");
    expect(brand.productTagline).toBeTruthy();
    expect(brand.shortTagline).toBeTruthy();
    expect(brand.marketTagline).toBeTruthy();
  });

  it("has valid hex color codes", () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;

    expect(brand.colors.from).toMatch(hexPattern);
    expect(brand.colors.via).toMatch(hexPattern);
    expect(brand.colors.to).toMatch(hexPattern);
    expect(brand.colors.ink).toMatch(hexPattern);
    expect(brand.colors.surface).toMatch(hexPattern);
  });
});
