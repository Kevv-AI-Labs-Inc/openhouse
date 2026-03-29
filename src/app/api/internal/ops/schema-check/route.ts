import { NextRequest, NextResponse } from "next/server";
import {
  hasInternalOpsTokenConfigured,
  internalOpsDisabledResponse,
  internalOpsUnauthorizedResponse,
  isInternalOpsAuthorized,
} from "@/lib/internal-ops";
import { inspectRuntimeSchemaDrift } from "@/lib/schema-drift";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasInternalOpsTokenConfigured()) {
    return internalOpsDisabledResponse();
  }

  if (!isInternalOpsAuthorized(request)) {
    return internalOpsUnauthorizedResponse();
  }

  try {
    const report = await inspectRuntimeSchemaDrift();
    return NextResponse.json(report, {
      status: report.ok ? 200 : 503,
    });
  } catch (error) {
    console.error("[SchemaCheck] Failed:", error);
    return NextResponse.json(
      { error: "Failed to inspect runtime schema" },
      { status: 500 }
    );
  }
}
