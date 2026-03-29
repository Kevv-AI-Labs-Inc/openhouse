import { afterEach, describe, expect, it } from "vitest";
import { siteConfig, getSiteUrl, absoluteUrl, getSupportMailto } from "@/lib/site";

describe("siteConfig", () => {
  it("has all required metadata fields", () => {
    expect(siteConfig.name).toBeTruthy();
    expect(siteConfig.legalName).toBeTruthy();
    expect(siteConfig.title).toBeTruthy();
    expect(siteConfig.description).toBeTruthy();
    expect(siteConfig.supportEmail).toBeTruthy();
  });

  it("has SEO keywords", () => {
    expect(siteConfig.keywords.length).toBeGreaterThan(0);
    expect(siteConfig.keywords.every((k) => typeof k === "string")).toBe(true);
  });

  it("serves US and CA markets", () => {
    expect(siteConfig.areaServed).toContain("US");
    expect(siteConfig.areaServed).toContain("CA");
  });
});

describe("getSiteUrl", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns localhost in test env without env vars", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.VERCEL_URL;

    const url = getSiteUrl();
    expect(url).toBe("http://localhost:3000");
  });

  it("uses NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://my-app.com/";

    const url = getSiteUrl();
    expect(url).toBe("https://my-app.com");
  });

  it("adds https:// when protocol is missing", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "my-app.com";

    const url = getSiteUrl();
    expect(url).toBe("https://my-app.com");
  });

  it("strips trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://my-app.com///";

    const url = getSiteUrl();
    expect(url).toBe("https://my-app.com");
  });
});

describe("absoluteUrl", () => {
  it("combines site URL with a pathname", () => {
    const url = absoluteUrl("/dashboard");
    expect(url).toMatch(/\/dashboard$/);
    expect(url).toMatch(/^https?:\/\//);
  });

  it("defaults to root when no pathname given", () => {
    const url = absoluteUrl();
    expect(url).toMatch(/\/$/);
  });
});

describe("getSupportMailto", () => {
  it("returns a mailto link without subject", () => {
    const link = getSupportMailto();
    expect(link).toMatch(/^mailto:/);
    expect(link).not.toContain("?subject=");
  });

  it("includes an encoded subject when provided", () => {
    const link = getSupportMailto("Help with billing");
    expect(link).toContain("?subject=Help%20with%20billing");
  });
});
