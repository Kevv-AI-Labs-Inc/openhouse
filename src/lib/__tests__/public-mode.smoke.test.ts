import { describe, expect, it } from "vitest";
import {
  formatPublicModeLabel,
  inferCaptureMode,
  isPublicEventVisible,
} from "@/lib/public-mode";

describe("formatPublicModeLabel", () => {
  it("returns 'Listing Inquiry' for listing_inquiry mode", () => {
    expect(formatPublicModeLabel("listing_inquiry")).toBe("Listing Inquiry");
  });

  it("returns 'Open House' for open_house mode", () => {
    expect(formatPublicModeLabel("open_house")).toBe("Open House");
  });

  it("defaults to 'Open House' for null / undefined / unknown", () => {
    expect(formatPublicModeLabel(null)).toBe("Open House");
    expect(formatPublicModeLabel(undefined)).toBe("Open House");
    expect(formatPublicModeLabel("something_else")).toBe("Open House");
  });
});

describe("inferCaptureMode", () => {
  it("trusts explicit captureMode when present", () => {
    expect(
      inferCaptureMode({
        captureMode: "listing_inquiry",
        eventPublicMode: "open_house",
        signedInAt: null,
        eventEndTime: null,
      })
    ).toBe("listing_inquiry");

    expect(
      inferCaptureMode({
        captureMode: "open_house",
        eventPublicMode: "listing_inquiry",
        signedInAt: null,
        eventEndTime: null,
      })
    ).toBe("open_house");
  });

  it("infers listing_inquiry when sign-in is after event end", () => {
    const eventEnd = new Date("2025-06-15T16:00:00Z");
    const afterEnd = new Date("2025-06-15T18:00:00Z");

    expect(
      inferCaptureMode({
        captureMode: null,
        eventPublicMode: "open_house",
        signedInAt: afterEnd.toISOString(),
        eventEndTime: eventEnd.toISOString(),
      })
    ).toBe("listing_inquiry");
  });

  it("infers open_house when sign-in is before event end", () => {
    const eventEnd = new Date("2025-06-15T16:00:00Z");
    const duringEvent = new Date("2025-06-15T14:30:00Z");

    expect(
      inferCaptureMode({
        captureMode: null,
        eventPublicMode: "open_house",
        signedInAt: duringEvent.toISOString(),
        eventEndTime: eventEnd.toISOString(),
      })
    ).toBe("open_house");
  });

  it("falls back to event public mode when timestamps are missing", () => {
    expect(
      inferCaptureMode({
        captureMode: null,
        eventPublicMode: "listing_inquiry",
        signedInAt: null,
        eventEndTime: null,
      })
    ).toBe("listing_inquiry");

    expect(
      inferCaptureMode({
        captureMode: null,
        eventPublicMode: "open_house",
        signedInAt: null,
        eventEndTime: null,
      })
    ).toBe("open_house");
  });

  it("defaults to open_house for unknown event modes", () => {
    expect(
      inferCaptureMode({
        captureMode: null,
        eventPublicMode: "something_random",
        signedInAt: null,
        eventEndTime: null,
      })
    ).toBe("open_house");
  });

  it("handles invalid date strings gracefully", () => {
    expect(
      inferCaptureMode({
        captureMode: null,
        eventPublicMode: "open_house",
        signedInAt: "not-a-date",
        eventEndTime: "also-not-a-date",
      })
    ).toBe("open_house");
  });
});

describe("isPublicEventVisible", () => {
  it("hides draft and cancelled events", () => {
    expect(isPublicEventVisible("draft")).toBe(false);
    expect(isPublicEventVisible("cancelled")).toBe(false);
  });

  it("shows active and completed events", () => {
    expect(isPublicEventVisible("active")).toBe(true);
    expect(isPublicEventVisible("completed")).toBe(true);
  });

  it("treats null/undefined as visible", () => {
    expect(isPublicEventVisible(null)).toBe(true);
    expect(isPublicEventVisible(undefined)).toBe(true);
  });
});
