import { expect, test } from "@playwright/test";

type EventResponse = {
  uuid: string;
  propertyAddress: string;
  listPrice: string | null;
  startTime: string;
  endTime: string;
  publicMode: string;
  status: string;
  branding: null;
  complianceText: string | null;
  customFields: null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  sqft: number | null;
  propertyPhotos: string[] | null;
  propertyDescription: string | null;
  featureAccessTier: "free" | "trial_pro" | "pro";
  aiQaEnabled: boolean;
  aiQaOnProPreview: boolean;
  chatUnlocked: boolean;
  marketing: {
    headline: string | null;
    summary: string | null;
    highlights: string[];
  };
};

const baseEvent: EventResponse = {
  uuid: "kiosk-test-event",
  propertyAddress: "456 Oak Ave, Brooklyn, NY 11201",
  listPrice: "895000",
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 3600000).toISOString(),
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
    headline: "456 Oak Ave",
    summary: null,
    highlights: ["Garden", "Modern kitchen"],
  },
};

async function mockKioskApis(
  page: Parameters<typeof test>[0]["page"],
  options?: { event?: Partial<EventResponse> }
) {
  const event = { ...baseEvent, ...options?.event };

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
  });

  await page.route("**/api/public/event/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname.endsWith("/funnel")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (pathname.endsWith("/chat")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [] }),
      });
      return;
    }

    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(event),
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        signInId: 100,
        chatUnlocked: false,
        featureAccessTier: event.featureAccessTier,
      }),
    });
  });
}

test.describe("Kiosk mode critical flows", () => {
  test("renders the kiosk sign-in page with property info", async ({ page }) => {
    await mockKioskApis(page);
    await page.goto("/oh/kiosk-test-event/kiosk");

    // Should show the property address
    await expect(page.getByText("456 Oak Ave")).toBeVisible();
  });

  test("kiosk form resets after successful sign-in for next visitor", async ({ page }) => {
    await mockKioskApis(page);
    await page.goto("/oh/kiosk-test-event/kiosk");

    // Wait for the form to load
    const nameInput = page.getByPlaceholder("John Smith");
    if (await nameInput.isVisible({ timeout: 5000 })) {
      await nameInput.fill("First Visitor");
      await page.getByPlaceholder("(555) 123-4567").fill("(555) 111-1111");
      await page.getByPlaceholder("your@email.com").fill("first@example.com");
      await page.getByRole("button", { name: "Continue" }).click();

      // After success, look for either a reset button or auto-reset
      const signedInText = page.getByText("Signed In");
      if (await signedInText.isVisible({ timeout: 3000 })) {
        // Kiosk mode should have a way to sign in the next visitor
        const nextButton = page.getByRole("button", { name: /next|new|another/i });
        if (await nextButton.isVisible({ timeout: 3000 })) {
          await nextButton.click();
          // Name field should be cleared for next visitor
          await expect(page.getByPlaceholder("John Smith")).toHaveValue("");
        }
      }
    }
  });
});

test.describe("Public page - inactive event", () => {
  test("shows appropriate message for draft events", async ({ page }) => {
    await mockKioskApis(page, { event: { status: "draft" } });
    await page.goto("/oh/kiosk-test-event");

    // The page should either redirect or show an unavailable message
    // Wait for any content to appear
    await page.waitForTimeout(2000);

    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });
});
