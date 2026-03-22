import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isGooglePlacesConfigured, resolveGoogleAddress } from "@/lib/google-places";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGooglePlacesConfigured()) {
    return NextResponse.json({ error: "Google Places is not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken.trim() : undefined;

    if (!placeId) {
      return NextResponse.json({ error: "Google Places placeId is required" }, { status: 400 });
    }

    const address = await resolveGoogleAddress(placeId, sessionToken);
    return NextResponse.json({ address });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address resolution failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

