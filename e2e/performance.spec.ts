/**
 * Playwright: Performance & Core Web Vitals Smoke Tests
 *
 * Validates that pages load within acceptable time budgets and
 * don't have critical performance regressions.
 */
import { expect, test } from "@playwright/test";

test.describe("Landing page performance", () => {
  test("page loads within 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(5000);
  });

  test("page has no console errors on load", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForTimeout(1000);

    // Filter out known non-critical errors (e.g. favicon, external resources)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("net::ERR_") &&
        !e.includes("Failed to load resource")
    );

    expect(
      criticalErrors,
      `Console errors found: ${criticalErrors.join("\n")}`
    ).toEqual([]);
  });

  test("no uncaught JavaScript exceptions", async ({ page }) => {
    const exceptions: string[] = [];

    page.on("pageerror", (error) => {
      exceptions.push(error.message);
    });

    await page.goto("/");
    await page.waitForTimeout(1000);

    expect(
      exceptions,
      `Uncaught exceptions: ${exceptions.join("\n")}`
    ).toEqual([]);
  });

  test("HTML response includes critical meta tags", async ({ page }) => {
    await page.goto("/");

    // Check viewport meta
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("width=device-width");

    // Check charset
    const charset = await page.locator("meta[charset]").count();
    const charsetHttp = await page.locator('meta[http-equiv="Content-Type"]').count();
    expect(charset + charsetHttp).toBeGreaterThan(0);
  });

  test("page does not load excessively large resources", async ({ page }) => {
    const largeResources: Array<{ url: string; size: number }> = [];

    page.on("response", async (response) => {
      try {
        const headers = response.headers();
        const size = parseInt(headers["content-length"] || "0", 10);
        // Flag anything over 2MB
        if (size > 2 * 1024 * 1024) {
          largeResources.push({ url: response.url(), size });
        }
      } catch {
        // Ignore response read errors
      }
    });

    await page.goto("/");
    await page.waitForTimeout(2000);

    expect(
      largeResources,
      `Oversized resources: ${largeResources.map((r) => `${r.url} (${Math.round(r.size / 1024)}KB)`).join(", ")}`
    ).toEqual([]);
  });
});

test.describe("Public sign-in page performance", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
      });
    });

    await page.route("**/api/public/event/**", async (route) => {
      const request = route.request();
      if (request.url().includes("/funnel")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;
      }
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            uuid: "perf-test",
            propertyAddress: "100 Perf Ave",
            listPrice: "600000",
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            publicMode: "open_house",
            status: "active",
            branding: null,
            complianceText: null,
            customFields: null,
            propertyType: "condo",
            bedrooms: 2,
            bathrooms: "1",
            sqft: 900,
            propertyPhotos: null,
            propertyDescription: null,
            featureAccessTier: "free",
            aiQaEnabled: false,
            aiQaOnProPreview: false,
            chatUnlocked: false,
            marketing: { headline: null, summary: null, highlights: [] },
          }),
        });
      }
    });
  });

  test("sign-in form is interactive within 3 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/oh/perf-test");

    const nameInput = page.getByPlaceholder("John Smith");
    await nameInput.waitFor({ state: "visible", timeout: 3000 });

    const tti = Date.now() - start;
    expect(tti).toBeLessThan(3000);
  });

  test("no JS exceptions on the public sign-in page", async ({ page }) => {
    const exceptions: string[] = [];

    page.on("pageerror", (error) => {
      exceptions.push(error.message);
    });

    await page.goto("/oh/perf-test");
    await page.waitForTimeout(1500);

    expect(exceptions).toEqual([]);
  });
});
