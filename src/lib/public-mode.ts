import type { PublicMode } from "@/lib/listing-import-shared";

export function formatPublicModeLabel(mode: PublicMode | string | null | undefined) {
  return mode === "listing_inquiry" ? "Listing Inquiry" : "Open House";
}

export function inferCaptureMode(params: {
  captureMode?: string | null;
  eventPublicMode?: string | null;
  signedInAt?: string | Date | null;
  eventEndTime?: string | Date | null;
}): PublicMode {
  if (params.captureMode === "listing_inquiry" || params.captureMode === "open_house") {
    return params.captureMode;
  }

  const signedInAt = params.signedInAt ? new Date(params.signedInAt) : null;
  const eventEndTime = params.eventEndTime ? new Date(params.eventEndTime) : null;

  if (
    signedInAt &&
    eventEndTime &&
    Number.isFinite(signedInAt.getTime()) &&
    Number.isFinite(eventEndTime.getTime()) &&
    signedInAt > eventEndTime
  ) {
    return "listing_inquiry";
  }

  return params.eventPublicMode === "listing_inquiry" ? "listing_inquiry" : "open_house";
}

export function isPublicEventVisible(status: string | null | undefined) {
  return status !== "draft" && status !== "cancelled";
}
