import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  hasInternalOpsTokenConfigured,
  internalOpsDisabledResponse,
  internalOpsUnauthorizedResponse,
  isInternalOpsAuthorized,
} from "@/lib/internal-ops";
import { syncPendingKevvSignIns } from "@/lib/kevv-sync";

export const runtime = "nodejs";

const bodySchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  includeFailed: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  if (!hasInternalOpsTokenConfigured()) {
    return internalOpsDisabledResponse();
  }

  if (!isInternalOpsAuthorized(request)) {
    return internalOpsUnauthorizedResponse();
  }

  try {
    const payload = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!payload.success) {
      return NextResponse.json({ error: "Invalid sync payload" }, { status: 400 });
    }

    const result = await syncPendingKevvSignIns(payload.data);
    return NextResponse.json(result, {
      status: result.failed > 0 ? 207 : 200,
    });
  } catch (error) {
    console.error("[KevvSync] Run failed:", error);
    return NextResponse.json(
      { error: "Failed to sync pending sign-ins" },
      { status: 500 }
    );
  }
}
