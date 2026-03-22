import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importListingFromFlyer } from "@/lib/listing-import";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A flyer file is required" }, { status: 400 });
    }

    const draft = await importListingFromFlyer(
      file.name,
      file.type,
      Buffer.from(await file.arrayBuffer())
    );

    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Flyer import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
