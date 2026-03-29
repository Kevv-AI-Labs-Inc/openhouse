import { afterEach, describe, expect, it } from "vitest";
import { encryptSecretValue, decryptSecretValue } from "@/lib/secret-box";

describe("secret-box encryption", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function ensureKey() {
    process.env.AUTH_SECRET = "test-secret-key-for-encryption-tests";
  }

  it("round-trips: encrypt then decrypt returns original value", () => {
    ensureKey();
    const original = "my-refresh-token-abc123";

    const encrypted = encryptSecretValue(original);
    const decrypted = decryptSecretValue(encrypted);

    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    ensureKey();
    const plaintext = "same-value";

    const a = encryptSecretValue(plaintext);
    const b = encryptSecretValue(plaintext);

    expect(a).not.toBe(b);
  });

  it("encrypted output has the expected 3-part format", () => {
    ensureKey();
    const encrypted = encryptSecretValue("test");

    const parts = encrypted.split(".");
    expect(parts).toHaveLength(3);
    // Each part should be non-empty base64url
    parts.forEach((part) => {
      expect(part.length).toBeGreaterThan(0);
    });
  });

  it("throws on malformed encrypted payload", () => {
    ensureKey();

    expect(() => decryptSecretValue("not-valid")).toThrow("Malformed encrypted payload");
    expect(() => decryptSecretValue("a.b")).toThrow("Malformed encrypted payload");
    expect(() => decryptSecretValue("")).toThrow("Malformed encrypted payload");
  });

  it("throws when no encryption key is configured", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.MAIL_TOKEN_ENCRYPTION_KEY;
    delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;

    expect(() => encryptSecretValue("test")).toThrow();
  });

  it("handles long values", () => {
    ensureKey();
    const longValue = "x".repeat(10000);

    const encrypted = encryptSecretValue(longValue);
    const decrypted = decryptSecretValue(encrypted);

    expect(decrypted).toBe(longValue);
  });

  it("handles unicode content", () => {
    ensureKey();
    const unicode = "日本語テスト 🎉 émojis & spëcial chars";

    const encrypted = encryptSecretValue(unicode);
    const decrypted = decryptSecretValue(encrypted);

    expect(decrypted).toBe(unicode);
  });
});
