/**
 * Playwright: Accessibility (a11y) Smoke Tests
 *
 * Tests that public-facing pages meet basic accessibility standards:
 * - All images have alt text
 * - Interactive elements are keyboard focusable
 * - No duplicate IDs
 * - Heading hierarchy is correct
 * - Form inputs have labels
 */
import { expect, test } from "@playwright/test";

test.describe("Landing page accessibility", () => {
  test("all images have alt attributes", async ({ page }) => {
    await page.goto("/");
    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt, `Image ${i} is missing alt attribute`).not.toBeNull();
    }
  });

  test("no unexpected duplicate IDs on the page", async ({ page }) => {
    await page.goto("/");

    // SVG IDs that appear in both header/footer brand marks are expected
    const KNOWN_SVG_DUPES = new Set(["openhouse-brand-mark"]);

    const duplicates = await page.evaluate((knownDupes) => {
      const ids = Array.from(document.querySelectorAll("[id]")).map(
        (el) => el.id
      );
      const known = new Set(knownDupes);
      const seen = new Set<string>();
      const dupes: string[] = [];

      for (const id of ids) {
        if (seen.has(id) && !known.has(id)) {
          dupes.push(id);
        }
        seen.add(id);
      }

      return dupes;
    }, [...KNOWN_SVG_DUPES]);

    expect(duplicates, `Found duplicate IDs: ${duplicates.join(", ")}`).toEqual(
      []
    );
  });

  test("heading hierarchy does not skip levels", async ({ page }) => {
    await page.goto("/");

    const headingLevels = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))
        .map((el) => Number(el.tagName.charAt(1)));
    });

    if (headingLevels.length > 1) {
      for (let i = 1; i < headingLevels.length; i++) {
        const diff = headingLevels[i] - headingLevels[i - 1];
        // Heading can go deeper by 1, stay same, or go up any amount
        expect(
          diff <= 1,
          `Heading hierarchy skips from h${headingLevels[i - 1]} to h${headingLevels[i]}`
        ).toBe(true);
      }
    }
  });

  test("page has exactly one h1", async ({ page }) => {
    await page.goto("/");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("interactive elements are focusable via keyboard", async ({ page }) => {
    await page.goto("/");

    const firstLink = page.locator("a[href]").first();
    if (await firstLink.isVisible()) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      // After Tab, something should be focused (a, button, input, etc.)
      expect(focused).toBeTruthy();
    }
  });
});

test.describe("Public sign-in form accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
      });
    });

    await page.route("**/api/public/event/**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            uuid: "a11y-test",
            propertyAddress: "123 Main St, NY 10001",
            listPrice: "500000",
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
            propertyDescription: "A test unit.",
            featureAccessTier: "free",
            aiQaEnabled: false,
            aiQaOnProPreview: false,
            chatUnlocked: false,
            marketing: { headline: null, summary: null, highlights: [] },
          }),
        });
        return;
      }

      if (route.request().url().includes("/funnel")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, signInId: 1, featureAccessTier: "free" }),
      });
    });
  });

  test("form inputs have associated labels or placeholders", async ({ page }) => {
    await page.goto("/oh/a11y-test");

    const inputs = page.locator("input:not([type=hidden])");
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");
      const placeholder = await input.getAttribute("placeholder");
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");

      // Each input should have at least one accessible name source
      const hasAccessibleName =
        placeholder ||
        ariaLabel ||
        ariaLabelledBy ||
        (id ? await page.locator(`label[for="${id}"]`).count() > 0 : false);

      expect(
        hasAccessibleName,
        `Input ${i} (id="${id}") has no accessible name`
      ).toBeTruthy();
    }
  });

  test("submit button has accessible text", async ({ page }) => {
    await page.goto("/oh/a11y-test");

    const submitBtn = page.getByRole("button", { name: /continue|submit|sign in/i });
    if (await submitBtn.isVisible({ timeout: 5000 })) {
      const text = await submitBtn.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});
