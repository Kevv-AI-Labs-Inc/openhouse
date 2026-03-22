import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/site";
import { buildPublicListingMarketing } from "@/lib/public-listing-view";

export const dynamic = "force-dynamic";

type Params = Promise<{ uuid: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { uuid } = await params;

  const fallbackTitle = "Property Inquiry and Visitor Registration";
  const fallbackDescription =
    "Property inquiry and visitor registration page powered by OpenHouse for real estate listings.";

  try {
    const db = getDb();
    const [event] = await db
      .select({
        propertyAddress: events.propertyAddress,
        listPrice: events.listPrice,
        publicMode: events.publicMode,
        propertyType: events.propertyType,
        bedrooms: events.bedrooms,
        bathrooms: events.bathrooms,
        sqft: events.sqft,
        propertyDescription: events.propertyDescription,
        aiQaContext: events.aiQaContext,
        branding: events.branding,
        propertyPhotos: events.propertyPhotos,
      })
      .from(events)
      .where(eq(events.uuid, uuid))
      .limit(1);

    if (!event) {
      return {
        title: fallbackTitle,
        description: fallbackDescription,
        alternates: {
          canonical: absoluteUrl(`/oh/${uuid}`),
        },
        robots: {
          index: false,
          follow: false,
          nocache: true,
        },
      };
    }

    const readablePrice =
      event.listPrice && !Number.isNaN(Number(event.listPrice))
        ? `$${Number(event.listPrice).toLocaleString()}`
        : null;

    const marketing = buildPublicListingMarketing({
      propertyAddress: event.propertyAddress,
      propertyType: event.propertyType,
      bedrooms: event.bedrooms,
      bathrooms: event.bathrooms,
      sqft: event.sqft,
      propertyDescription: event.propertyDescription,
      aiQaContext: event.aiQaContext,
    });

    const experienceLabel =
      event.publicMode === "listing_inquiry"
        ? "Property Details and Agent Follow-Up"
        : "Open House Visitor Registration";
    const title = marketing.headline
      ? `${marketing.headline} | ${event.propertyAddress}`
      : `${event.propertyAddress} | ${experienceLabel}`;
    const description =
      marketing.summary ||
      (readablePrice
        ? `${event.propertyAddress} (${readablePrice}) ${event.publicMode === "listing_inquiry" ? "property details and inquiry" : "visitor registration"} page powered by OpenHouse.`
        : `${event.propertyAddress} ${event.publicMode === "listing_inquiry" ? "property details and inquiry" : "visitor registration"} page powered by OpenHouse.`);

    const socialImage =
      event.propertyPhotos?.[0] ||
      event.branding?.flyerImageUrl ||
      event.branding?.logoUrl ||
      absoluteUrl("/opengraph-image");

    return {
      title,
      description,
      alternates: {
        canonical: absoluteUrl(`/oh/${uuid}`),
      },
      openGraph: {
        title,
        description,
        type: "website",
        url: absoluteUrl(`/oh/${uuid}`),
        siteName: "OpenHouse",
        images: [{ url: socialImage, alt: title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [socialImage],
      },
      robots: {
        index: false,
        follow: false,
        nocache: true,
      },
    };
  } catch {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: {
        canonical: absoluteUrl(`/oh/${uuid}`),
      },
      robots: {
        index: false,
        follow: false,
        nocache: true,
      },
    };
  }
}

export default function PublicOpenHouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
