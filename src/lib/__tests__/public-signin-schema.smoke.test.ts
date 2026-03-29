import { describe, expect, it } from "vitest";
import { publicSignInSchema } from "@/lib/public-signin";

describe("publicSignInSchema", () => {
  const validPayload = {
    fullName: "Taylor Buyer",
    phone: "(555) 123-4567",
    email: "taylor@example.com",
  };

  it("accepts a minimal valid payload", () => {
    const result = publicSignInSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts a full payload with all optional fields", () => {
    const result = publicSignInSchema.safeParse({
      ...validPayload,
      clientSubmissionId: "550e8400-e29b-41d4-a716-446655440000",
      hasAgent: true,
      isPreApproved: "yes",
      interestLevel: "very",
      buyingTimeline: "0_3_months",
      priceRange: "$500k-$750k",
      customAnswers: { "How did you hear?": "Zillow" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fullName", () => {
    const result = publicSignInSchema.safeParse({
      phone: "555-000-0000",
      email: "test@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty fullName", () => {
    const result = publicSignInSchema.safeParse({
      ...validPayload,
      fullName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing phone", () => {
    const result = publicSignInSchema.safeParse({
      fullName: "Test",
      email: "test@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty phone", () => {
    const result = publicSignInSchema.safeParse({
      ...validPayload,
      phone: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = publicSignInSchema.safeParse({
      ...validPayload,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = publicSignInSchema.safeParse({
      fullName: "Test",
      phone: "555-000-0000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid interestLevel enum", () => {
    const result = publicSignInSchema.safeParse({
      ...validPayload,
      interestLevel: "extremely",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid isPreApproved enum", () => {
    const result = publicSignInSchema.safeParse({
      ...validPayload,
      isPreApproved: "maybe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid buyingTimeline enum", () => {
    const result = publicSignInSchema.safeParse({
      ...validPayload,
      buyingTimeline: "tomorrow",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid interestLevel values", () => {
    for (const level of ["very", "somewhat", "just_looking"] as const) {
      const result = publicSignInSchema.safeParse({
        ...validPayload,
        interestLevel: level,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid isPreApproved values", () => {
    for (const value of ["yes", "no", "not_yet"] as const) {
      const result = publicSignInSchema.safeParse({
        ...validPayload,
        isPreApproved: value,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid buyingTimeline values", () => {
    for (const timeline of [
      "0_3_months",
      "3_6_months",
      "6_12_months",
      "over_12_months",
      "just_browsing",
    ] as const) {
      const result = publicSignInSchema.safeParse({
        ...validPayload,
        buyingTimeline: timeline,
      });
      expect(result.success).toBe(true);
    }
  });
});
