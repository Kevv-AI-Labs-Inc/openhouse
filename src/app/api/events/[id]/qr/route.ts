/**
 * QR Code generation API
 * GET /api/events/[id]/qr — Generate QR code as data URL for event sign-in URL
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import QRCode from "qrcode";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    const [event] = await db
        .select()
        .from(events)
        .where(
            and(
                eq(events.id, Number(id)),
                eq(events.userId, Number(session.user.id))
            )
        )
        .limit(1);

    if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const signInUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/oh/${event.uuid}`;

    const qrDataUrl = await QRCode.toDataURL(signInUrl, {
        width: 512,
        margin: 2,
        color: {
            dark: "#10b981",
            light: "#000000",
        },
    });

    return NextResponse.json({
        qrDataUrl,
        signInUrl,
        eventUuid: event.uuid,
    });
}
