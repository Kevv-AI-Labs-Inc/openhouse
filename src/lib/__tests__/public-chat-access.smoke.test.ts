import {
  buildPublicChatAccessCookieValue,
  parsePublicChatAccessCookieValue,
} from "@/lib/public-chat-access";

describe("public chat access smoke", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUTH_SECRET: "test-auth-secret",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("signs and parses the public chat access cookie", () => {
    const value = buildPublicChatAccessCookieValue("evt-123", "grant-token");
    const parsed = parsePublicChatAccessCookieValue("evt-123", value);

    expect(parsed?.token).toBe("grant-token");
  });

  it("rejects tampered public chat access cookies", () => {
    const value = buildPublicChatAccessCookieValue("evt-123", "grant-token");
    const tampered = `${value}broken`;

    expect(parsePublicChatAccessCookieValue("evt-123", tampered)).toBeNull();
  });
});
