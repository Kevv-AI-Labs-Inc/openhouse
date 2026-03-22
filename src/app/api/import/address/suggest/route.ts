import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isGooglePlacesConfigured, suggestGoogleAddresses } from "@/lib/google-places";

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
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken.trim() : "";

    if (query.length < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    if (!sessionToken) {
      return NextResponse.json({ error: "Google Places session token is required" }, { status: 400 });
    }

    const suggestions = await suggestGoogleAddresses(query, sessionToken);
    return NextResponse.json({ suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address suggestions failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

