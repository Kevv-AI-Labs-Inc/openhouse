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
  uuid: "test-open-house",
  propertyAddress: "123 Main St, New York, NY 10001",
  listPrice: "1250000",
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  publicMode: "open_house",
  status: "active",
  branding: null,
  complianceText: null,
  customFields: null,
  propertyType: "condo",
  bedrooms: 2,
  bathrooms: "2",
  sqft: 1200,
  propertyPhotos: null,
  propertyDescription: "Bright corner home with open views.",
  featureAccessTier: "pro",
  aiQaEnabled: false,
  aiQaOnProPreview: false,
  chatUnlocked: false,
  marketing: {
    headline: "123 Main St",
    summary: null,
    highlights: ["Open layout", "Corner unit"],
  },
};

async function mockPublicEventApi(page: Parameters<typeof test>[0]["page"], options?: {
  event?: Partial<EventResponse>;
  onSubmit?: (payload: Record<string, unknown>) => void;
  submitResponse?: { status: number; body: Record<string, unknown> };
}) {
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

    const payload = request.postDataJSON() as Record<string, unknown>;
    options?.onSubmit?.(payload);
    const response = options?.submitResponse ?? {
      status: 201,
      body: {
        success: true,
        signInId: 55,
        chatUnlocked: Boolean(event.aiQaEnabled),
        featureAccessTier: event.featureAccessTier,
      },
    };
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    });
  });
}

test("submits the public sign-in form and shows the success state", async ({ page }) => {
  let submittedPayload: Record<string, unknown> | null = null;
  await mockPublicEventApi(page, {
    onSubmit: (payload) => {
      submittedPayload = payload;
    },
  });

  await page.goto("/oh/test-open-house");
  await expect(page.getByText("Sign In", { exact: true })).toBeVisible();

  await page.getByPlaceholder("John Smith").fill("Taylor Buyer");
  await page.getByPlaceholder("(555) 123-4567").fill("(555) 123-4567");
  await page.getByPlaceholder("your@email.com").fill("taylor@example.com");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("You're Signed In")).toBeVisible();
  expect(submittedPayload).toMatchObject({
    fullName: "Taylor Buyer",
    phone: "(555) 123-4567",
    email: "taylor@example.com",
  });
});

test("auto-redirects into AI Q&A when chat is unlocked", async ({ page }) => {
  await mockPublicEventApi(page, {
    event: {
      aiQaEnabled: true,
      chatUnlocked: true,
    },
    submitResponse: {
      status: 201,
      body: {
        success: true,
        signInId: 77,
        chatUnlocked: true,
        featureAccessTier: "pro",
      },
    },
  });

  await page.goto("/oh/test-open-house");
  await expect(page.getByText("Sign In", { exact: true })).toBeVisible();

  await page.getByPlaceholder("John Smith").fill("Taylor Buyer");
  await page.getByPlaceholder("(555) 123-4567").fill("(555) 123-4567");
  await page.getByPlaceholder("your@email.com").fill("taylor@example.com");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Opening AI Property Q&A automatically...")).toBeVisible();
  await page.waitForURL("**/oh/test-open-house/chat");
  await expect(page.getByText("AI Property Q&A")).toBeVisible();
});

test("surfaces server-side errors without leaving the form", async ({ page }) => {
  await mockPublicEventApi(page, {
    submitResponse: {
      status: 429,
      body: {
        error: "Too many sign-in attempts. Please try again shortly.",
      },
    },
  });

  await page.goto("/oh/test-open-house");
  await expect(page.getByText("Sign In", { exact: true })).toBeVisible();

  await page.getByPlaceholder("John Smith").fill("Taylor Buyer");
  await page.getByPlaceholder("(555) 123-4567").fill("(555) 123-4567");
  await page.getByPlaceholder("your@email.com").fill("taylor@example.com");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Too many sign-in attempts. Please try again shortly.")).toBeVisible();
  await expect(page.getByText("You're Signed In")).not.toBeVisible();
});
