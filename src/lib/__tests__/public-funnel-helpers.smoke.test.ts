import { describe, expect, it } from "vitest";
import {
  getPublicFunnelVisitorCookieName,
  getPublicFunnelVisitorId,
  buildPublicFunnelVisitorCookie,
  getPublicFunnelStageCookieName,
  hasPublicFunnelStageCookie,
  buildPublicFunnelStageCookie,
  isTrustedPublicFunnelRequest,
} from "@/lib/public-funnel";

describe("cookie naming", () => {
  it("builds visitor cookie name from uuid", () => {
    expect(getPublicFunnelVisitorCookieName("abc-123")).toBe("oh-funnel-abc-123");
  });

  it("builds stage cookie name from uuid and stage", () => {
    expect(getPublicFunnelStageCookieName("abc-123", "page_view")).toBe(
      "oh-funnel-abc-123-page_view"
    );
    expect(getPublicFunnelStageCookieName("abc-123", "form_start")).toBe(
      "oh-funnel-abc-123-form_start"
    );
  });
});

describe("getPublicFunnelVisitorId", () => {
  it("returns the cookie value when present", () => {
    const store = { get: (name: string) => (name === "oh-funnel-evt-1" ? { value: "vis-42" } : undefined) };
    expect(getPublicFunnelVisitorId(store, "evt-1")).toBe("vis-42");
  });

  it("returns null when cookie is missing", () => {
    const store = { get: () => undefined };
    expect(getPublicFunnelVisitorId(store, "evt-1")).toBeNull();
  });
});

describe("hasPublicFunnelStageCookie", () => {
  it("returns true when stage cookie has a value", () => {
    const store = {
      get: (name: string) => (name === "oh-funnel-evt-1-page_view" ? { value: "1" } : undefined),
    };
    expect(hasPublicFunnelStageCookie(store, "evt-1", "page_view")).toBe(true);
  });

  it("returns false when stage cookie is missing", () => {
    const store = { get: () => undefined };
    expect(hasPublicFunnelStageCookie(store, "evt-1", "page_view")).toBe(false);
  });
});

describe("buildPublicFunnelVisitorCookie", () => {
  it("produces a correctly shaped cookie object", () => {
    const cookie = buildPublicFunnelVisitorCookie("uuid-1", "visitor-abc");

    expect(cookie.name).toBe("oh-funnel-uuid-1");
    expect(cookie.value).toBe("visitor-abc");
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/");
    expect(cookie.maxAge).toBeGreaterThan(0);
  });
});

describe("buildPublicFunnelStageCookie", () => {
  it("uses different TTLs per stage", () => {
    const pageViewCookie = buildPublicFunnelStageCookie("uuid-1", "page_view");
    const formStartCookie = buildPublicFunnelStageCookie("uuid-1", "form_start");

    expect(pageViewCookie.maxAge).toBe(600); // 10 minutes
    expect(formStartCookie.maxAge).toBe(300); // 5 minutes
    expect(pageViewCookie.value).toBe("1");
    expect(formStartCookie.value).toBe("1");
  });
});

describe("isTrustedPublicFunnelRequest", () => {
  it("trusts requests with matching origin header", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        originHeader: "https://app.example.com",
        refererHeader: null,
      })
    ).toBe(true);
  });

  it("rejects requests from a different origin", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        originHeader: "https://evil.com",
        refererHeader: null,
      })
    ).toBe(false);
  });

  it("allows cross-origin when site origin is whitelisted", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        siteOrigin: "https://cdn.example.com",
        originHeader: "https://cdn.example.com",
        refererHeader: null,
      })
    ).toBe(true);
  });

  it("trusts requests with no origin or referer headers (e.g., server-to-server)", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        originHeader: null,
        refererHeader: null,
      })
    ).toBe(true);
  });

  it("trusts via referer header when origin is absent", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        originHeader: null,
        refererHeader: "https://app.example.com/oh/some-event",
      })
    ).toBe(true);
  });

  it("rejects when referer origin does not match", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        originHeader: null,
        refererHeader: "https://attacker.com/fake-page",
      })
    ).toBe(false);
  });

  it("handles malformed URLs gracefully", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        originHeader: "not-a-url",
        refererHeader: null,
      })
    ).toBe(false);
  });
});
