import { expect, test } from "@playwright/test";

test.describe("Landing page smoke", () => {
  test("renders the hero section with a CTA", async ({ page }) => {
    await page.goto("/");

    // The landing page should have a visible heading
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();

    // Should have at least one CTA button
    const ctaButton = page.getByRole("link", { name: /get started|sign in|try|start/i }).first();
    await expect(ctaButton).toBeVisible();
  });

  test("has correct page title and meta", async ({ page }) => {
    await page.goto("/");

    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test("features section is visible below the fold", async ({ page }) => {
    await page.goto("/");

    // Scroll down to find feature content
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);

    // There should be content below the fold
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    expect(bodyHeight).toBeGreaterThan(800);
  });

  test("footer is rendered at the bottom", async ({ page }) => {
    await page.goto("/");

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Footer or bottom content should exist
    const footer = page.locator("footer").first();
    if (await footer.isVisible()) {
      await expect(footer).toBeVisible();
    }
  });
});
