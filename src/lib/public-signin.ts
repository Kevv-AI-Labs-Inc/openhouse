import { z } from "zod";

export const publicSignInSchema = z.object({
  clientSubmissionId: z.uuid().optional(),
  fullName: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email is required"),
  hasAgent: z.boolean().optional(),
  isPreApproved: z.enum(["yes", "no", "not_yet"]).optional(),
  interestLevel: z.enum(["very", "somewhat", "just_looking"]).optional(),
  buyingTimeline: z
    .enum(["0_3_months", "3_6_months", "6_12_months", "over_12_months", "just_browsing"])
    .optional(),
  priceRange: z.string().optional(),
  customAnswers: z.record(z.string(), z.string()).optional(),
});

export type PublicSignInPayload = z.infer<typeof publicSignInSchema>;
