import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { SellerReportView } from "@/components/seller-report-view";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/site";
import { buildSellerReportEventByUuid } from "@/lib/seller-report-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string }>;
}): Promise<Metadata> {
  const { uuid } = await params;
  const db = getDb();

  const [event] = await db
    .select({
      propertyAddress: events.propertyAddress,
      listPrice: events.listPrice,
    })
    .from(events)
    .where(eq(events.uuid, uuid))
    .limit(1);

  if (!event) {
    return {
      title: "Shared Seller Report",
      description: "Private seller-summary page powered by OpenHouse.",
      robots: {
        index: false,
        follow: false,
        nocache: true,
      },
    };
  }

  const price =
    event.listPrice && !Number.isNaN(Number(event.listPrice))
      ? `$${Number(event.listPrice).toLocaleString()}`
      : null;

  return {
    title: `${event.propertyAddress} | Shared Seller Report`,
    description: price
      ? `Shared seller summary for ${event.propertyAddress} (${price}) powered by OpenHouse.`
      : `Shared seller summary for ${event.propertyAddress} powered by OpenHouse.`,
    alternates: {
      canonical: absoluteUrl(`/seller-report/${uuid}`),
    },
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

export default async function PublicSellerReportPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const event = await buildSellerReportEventByUuid(uuid);

  if (!event) {
    notFound();
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  const shareUrl = appUrl ? `${appUrl}/seller-report/${event.uuid}` : undefined;

  return <SellerReportView event={event} isPublic shareUrl={shareUrl} />;
}
