import {
  buildPublicFunnelStageCookie,
  getPublicFunnelStageCookieName,
  isTrustedPublicFunnelRequest,
} from "@/lib/public-funnel";

describe("public funnel smoke", () => {
  it("builds stage cookies with short anti-abuse ttl", () => {
    const cookie = buildPublicFunnelStageCookie("event-123", "form_start");

    expect(cookie.name).toBe(getPublicFunnelStageCookieName("event-123", "form_start"));
    expect(cookie.maxAge).toBe(60 * 5);
  });

  it("allows same-origin tracking and rejects foreign origins", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        siteOrigin: "https://app.example.com",
        originHeader: "https://app.example.com",
        refererHeader: "https://app.example.com/oh/abc",
      })
    ).toBe(true);

    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        siteOrigin: "https://app.example.com",
        originHeader: "https://evil.example",
        refererHeader: "https://evil.example/phish",
      })
    ).toBe(false);
  });
});
