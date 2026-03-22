import type { FollowUpEmailMode } from "@/lib/follow-up-email";

export type StoredFollowUpDraft = {
  subject: string;
  body: string;
  deliveryMode: FollowUpEmailMode;
  providerErrors?: Array<{
    provider: Exclude<FollowUpEmailMode, "draft">;
    message: string;
  }>;
  generatedAt?: string;
  generationSource?: "auto_sign_in" | "auto_chat" | "manual";
};

export function parseStoredFollowUpDraft(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as StoredFollowUpDraft;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.subject !== "string" ||
      typeof parsed.body !== "string"
    ) {
      return null;
    }

    return {
      ...parsed,
      deliveryMode:
        parsed.deliveryMode === "google" ||
        parsed.deliveryMode === "microsoft" ||
        parsed.deliveryMode === "custom_domain"
          ? parsed.deliveryMode
          : "draft",
    } satisfies StoredFollowUpDraft;
  } catch {
    return null;
  }
}

export function serializeStoredFollowUpDraft(draft: StoredFollowUpDraft) {
  return JSON.stringify(draft);
}
