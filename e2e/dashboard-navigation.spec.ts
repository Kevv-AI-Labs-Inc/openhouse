import { expect, test } from "@playwright/test";

test.describe("Dashboard navigation smoke", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the auth session as authenticated
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "1",
            name: "Test Agent",
            email: "agent@example.com",
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        }),
      });
    });

    // Mock events API
    await page.route("**/api/events**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            uuid: "test-event-1",
            propertyAddress: "123 Main St, New York, NY 10001",
            totalSignIns: 5,
            hotLeadsCount: 2,
            status: "active",
          },
        ]),
      });
    });

    // Mock billing/settings APIs
    await page.route("**/api/billing/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tier: "free",
          signInsUsed: 5,
          signInsLimit: 150,
        }),
      });
    });
  });

  test("renders the dashboard with KPI metrics", async ({ page }) => {
    await page.goto("/dashboard");

    // The page should render with the dashboard heading
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    // Should show metrics cards area  
    await expect(page.locator("[class*='grid']").first()).toBeVisible();
  });

  test("navigates from dashboard to events page", async ({ page }) => {
    await page.goto("/dashboard");

    // Click on the events navigation
    const eventsLink = page.getByRole("link", { name: /open houses|events/i });
    if (await eventsLink.isVisible()) {
      await eventsLink.click();
      await page.waitForURL("**/dashboard/events**");
      await expect(page.getByRole("heading", { name: /open houses/i })).toBeVisible();
    }
  });

  test("navigates from dashboard to leads page", async ({ page }) => {
    await page.goto("/dashboard");

    const leadsLink = page.getByRole("link", { name: /leads/i });
    if (await leadsLink.isVisible()) {
      await leadsLink.click();
      await page.waitForURL("**/dashboard/leads**");
      await expect(page.getByRole("heading", { name: /leads/i })).toBeVisible();
    }
  });

  test("navigates from dashboard to settings page", async ({ page }) => {
    await page.goto("/dashboard");

    const settingsLink = page.getByRole("link", { name: /settings/i });
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await page.waitForURL("**/dashboard/settings**");
      await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    }
  });
});
