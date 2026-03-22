import {
  formatAuthProviderLabel,
  getEnabledAuthProviders,
  isGoogleAuthConfigured,
  isMicrosoftAuthConfigured,
} from "@/lib/auth-provider-config";

describe("auth smoke", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("treats blank oauth env values as not configured", () => {
    process.env.AUTH_GOOGLE_ID = "   ";
    process.env.AUTH_GOOGLE_SECRET = "secret";
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "";
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET = "   ";

    expect(isGoogleAuthConfigured()).toBe(false);
    expect(isMicrosoftAuthConfigured()).toBe(false);
    expect(getEnabledAuthProviders()).toEqual([]);
  });

  it("returns enabled providers and user-facing labels", () => {
    process.env.AUTH_GOOGLE_ID = "google-id";
    process.env.AUTH_GOOGLE_SECRET = "google-secret";
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "ms-id";
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET = "ms-secret";

    expect(getEnabledAuthProviders()).toEqual(["google", "microsoft-entra-id"]);
    expect(formatAuthProviderLabel("google")).toBe("Google");
    expect(formatAuthProviderLabel("microsoft-entra-id")).toBe("Microsoft");
    expect(formatAuthProviderLabel("magic-link")).toBe("Email sign-in link");
  });
});
