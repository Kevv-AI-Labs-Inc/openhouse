import { describe, expect, it } from "vitest";
import {
  isGoogleMailboxConnected,
  isMicrosoftMailboxConnected,
  getFollowUpModeLabel,
  formatSignInMethodLabel,
  resolveEffectiveFollowUpMode,
  type FollowUpEmailMode,
} from "@/lib/follow-up-email";

type TestFollowUpUser = Parameters<typeof resolveEffectiveFollowUpMode>[0];

describe("isGoogleMailboxConnected", () => {
  it("returns true when both token and send-as email are present", () => {
    expect(
      isGoogleMailboxConnected({
        gmailRefreshTokenEncrypted: "encrypted-token",
        gmailSendAsEmail: "agent@gmail.com",
        gmailSendingEnabled: true,
      })
    ).toBe(true);
  });

  it("returns false when token is missing", () => {
    expect(
      isGoogleMailboxConnected({
        gmailRefreshTokenEncrypted: null,
        gmailSendAsEmail: "agent@gmail.com",
        gmailSendingEnabled: true,
      })
    ).toBe(false);
  });

  it("returns false when send-as email is missing", () => {
    expect(
      isGoogleMailboxConnected({
        gmailRefreshTokenEncrypted: "token",
        gmailSendAsEmail: null,
        gmailSendingEnabled: true,
      })
    ).toBe(false);
  });
});

describe("isMicrosoftMailboxConnected", () => {
  it("returns true when both token and send-as email are present", () => {
    expect(
      isMicrosoftMailboxConnected({
        microsoftRefreshTokenEncrypted: "encrypted-token",
        microsoftSendAsEmail: "agent@outlook.com",
        microsoftSendingEnabled: true,
      })
    ).toBe(true);
  });

  it("returns false when token is missing", () => {
    expect(
      isMicrosoftMailboxConnected({
        microsoftRefreshTokenEncrypted: null,
        microsoftSendAsEmail: "agent@outlook.com",
        microsoftSendingEnabled: true,
      })
    ).toBe(false);
  });
});

describe("getFollowUpModeLabel", () => {
  it("returns correct labels for all modes", () => {
    expect(getFollowUpModeLabel("google")).toBe("Google mailbox");
    expect(getFollowUpModeLabel("microsoft")).toBe("Microsoft mailbox");
    expect(getFollowUpModeLabel("custom_domain")).toBe("Verified team domain");
    expect(getFollowUpModeLabel("draft")).toBe("Draft only");
  });
});

describe("formatSignInMethodLabel", () => {
  it("labels known providers", () => {
    expect(formatSignInMethodLabel("google")).toBe("Google OAuth");
    expect(formatSignInMethodLabel("microsoft-entra-id")).toBe("Microsoft OAuth");
  });

  it("defaults to OAuth for unknown or null", () => {
    expect(formatSignInMethodLabel(null)).toBe("OAuth");
    expect(formatSignInMethodLabel(undefined)).toBe("OAuth");
    expect(formatSignInMethodLabel("unknown")).toBe("OAuth");
  });
});

describe("resolveEffectiveFollowUpMode", () => {
  const baseUser = {
    email: "agent@example.com",
    subscriptionTier: "pro",
    followUpEmailMode: "draft",
    gmailRefreshTokenEncrypted: null,
    gmailSendAsEmail: null,
    gmailSendingEnabled: false,
    microsoftRefreshTokenEncrypted: null,
    microsoftSendAsEmail: null,
    microsoftSendingEnabled: false,
    customSendingDomain: null,
    customSendingDomainStatus: "not_started",
    customSendingFromEmail: null,
    customSendingFromName: null,
    customSendingReplyToEmail: null,
  } as const satisfies TestFollowUpUser;

  it("defaults to draft when followUpEmailMode is draft", () => {
    expect(resolveEffectiveFollowUpMode(baseUser, false)).toBe("draft");
  });

  it("resolves to google when google mailbox is connected", () => {
    const user = {
      ...baseUser,
      followUpEmailMode: "google" as const,
      gmailRefreshTokenEncrypted: "encrypted-token",
      gmailSendAsEmail: "agent@gmail.com",
      gmailSendingEnabled: true,
    };

    expect(resolveEffectiveFollowUpMode(user, false)).toBe("google");
  });

  it("falls back to draft when google mode selected but not connected", () => {
    const user = {
      ...baseUser,
      followUpEmailMode: "google" as const,
    };

    expect(resolveEffectiveFollowUpMode(user, false)).toBe("draft");
  });

  it("resolves to microsoft when microsoft mailbox is connected", () => {
    const user = {
      ...baseUser,
      followUpEmailMode: "microsoft" as const,
      microsoftRefreshTokenEncrypted: "encrypted-token",
      microsoftSendAsEmail: "agent@outlook.com",
      microsoftSendingEnabled: true,
    };

    expect(resolveEffectiveFollowUpMode(user, false)).toBe("microsoft");
  });

  it("falls back to draft when microsoft mode selected but not connected", () => {
    const user = {
      ...baseUser,
      followUpEmailMode: "microsoft" as const,
    };

    expect(resolveEffectiveFollowUpMode(user, false)).toBe("draft");
  });
});
