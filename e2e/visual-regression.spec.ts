/**
 * Playwright: Visual Regression Baseline Tests
 *
 * Captures screenshots of critical pages and compares against baselines.
 * On first run, creates the baseline snapshots. On subsequent runs, fails
 * if the UI has visually changed beyond the threshold.
 */
import { expect, test } from "@playwright/test";

test.describe("Visual regression: Landing page", () => {
  test("hero section matches baseline", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait for animations to settle
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("landing-hero.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe("Visual regression: Public sign-in", () => {
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
            uuid: "vr-test",
            propertyAddress: "500 Visual Regression Dr, Brooklyn, NY 11201",
            listPrice: "999000",
            startTime: new Date("2025-06-15T12:00:00Z").toISOString(),
            endTime: new Date("2025-06-15T14:00:00Z").toISOString(),
            publicMode: "open_house",
            status: "active",
            branding: null,
            complianceText: null,
            customFields: null,
            propertyType: "townhouse",
            bedrooms: 3,
            bathrooms: "2.5",
            sqft: 1800,
            propertyPhotos: null,
            propertyDescription: "Modern townhouse with garden.",
            featureAccessTier: "free",
            aiQaEnabled: false,
            aiQaOnProPreview: false,
            chatUnlocked: false,
            marketing: {
              headline: "500 Visual Regression Dr",
              summary: "Modern townhouse with garden.",
              highlights: ["Garden", "Modern kitchen"],
            },
          }),
        });
      }
    });
  });

  test("sign-in form matches baseline", async ({ page }) => {
    await page.goto("/oh/vr-test");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("signin-form.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.05,
    });
  });
});
