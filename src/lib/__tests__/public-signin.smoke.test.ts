import { publicSignInSchema } from "@/lib/public-signin";
import { isPublicEventVisible } from "@/lib/public-mode";

describe("public sign-in smoke", () => {
  it("requires name, phone, and email", () => {
    const result = publicSignInSchema.safeParse({
      fullName: "",
      phone: "",
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("accepts the capture-first payload shape", () => {
    const result = publicSignInSchema.safeParse({
      clientSubmissionId: "2f0d5a57-a32d-495d-9e9c-6540f8d955ca",
      fullName: "Taylor Buyer",
      phone: "555-123-4567",
      email: "taylor@example.com",
      hasAgent: true,
      isPreApproved: "yes",
      interestLevel: "very",
      buyingTimeline: "0_3_months",
      customAnswers: {
        neighborhood: "Walkable and close to transit",
      },
    });

    expect(result.success).toBe(true);
  });

  it("hides draft and cancelled events from public access", () => {
    expect(isPublicEventVisible("active")).toBe(true);
    expect(isPublicEventVisible("completed")).toBe(true);
    expect(isPublicEventVisible("draft")).toBe(false);
    expect(isPublicEventVisible("cancelled")).toBe(false);
  });
});
