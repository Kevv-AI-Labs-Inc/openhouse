import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildSellerReportEventById } from "@/lib/seller-report-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const event = await buildSellerReportEventById(Number(id), Number(session.user.id));

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(event);
}

