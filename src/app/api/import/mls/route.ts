import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importListingByMlsNumber } from "@/lib/listing-import";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const mlsNumber = typeof body.mlsNumber === "string" ? body.mlsNumber.trim() : "";

    if (!mlsNumber) {
      return NextResponse.json({ error: "MLS number is required" }, { status: 400 });
    }

    const draft = await importListingByMlsNumber(mlsNumber);
    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MLS import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
