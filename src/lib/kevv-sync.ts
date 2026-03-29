import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { events, signIns, users } from "@/lib/db/schema";

type SyncableStatus = "pending" | "failed";

export type KevvSyncConfig = {
  enabled: boolean;
  baseUrl: string | null;
  path: string;
  token: string | null;
  timeoutMs: number;
};

type SyncRecord = {
  signIn: {
    id: number;
    eventId: number;
    fullName: string;
    email: string | null;
    phone: string | null;
    captureMode: string | null;
    hasAgent: boolean | null;
    isPreApproved: string | null;
    interestLevel: string | null;
    buyingTimeline: string | null;
    priceRange: string | null;
    customAnswers: Record<string, string> | null;
    leadScore: Record<string, unknown> | null;
    leadTier: string | null;
    aiRecommendation: string | null;
    followUpSent: boolean;
    followUpSentAt: Date | null;
    kevvContactId: number | null;
    crmSyncStatus: string | null;
    signedInAt: Date;
  };
  event: {
    id: number;
    uuid: string;
    propertyAddress: string;
    listPrice: string | null;
    publicMode: string;
    kevvAgentId: number | null;
    kevvCompanyId: number | null;
  };
  owner: {
    id: number;
    email: string;
    kevvAgentId: number | null;
    kevvCompanyId: number | null;
  };
};

export type KevvSyncPayload = {
  externalSignInId: number;
  externalEventId: number;
  eventUuid: string;
  source: "openhouse";
  captureMode: string | null;
  agentId: number | null;
  companyId: number | null;
  owner: {
    openhouseUserId: number;
    email: string;
  };
  contact: {
    fullName: string;
    email: string | null;
    phone: string | null;
  };
  intent: {
    hasAgent: boolean;
    isPreApproved: string | null;
    interestLevel: string | null;
    buyingTimeline: string | null;
    priceRange: string | null;
    customAnswers: Record<string, string> | null;
  };
  property: {
    address: string;
    listPrice: string | null;
    publicMode: string;
  };
  ai: {
    leadTier: string | null;
    leadScore: Record<string, unknown> | null;
    recommendation: string | null;
  };
  followUp: {
    sent: boolean;
    sentAt: string | null;
  };
  signedInAt: string;
};

export type KevvSyncAttemptResult = {
  signInId: number;
  status: "synced" | "failed" | "skipped";
  kevvContactId: number | null;
  error?: string;
};

export type KevvSyncRunResult = {
  ok: boolean;
  enabled: boolean;
  attempted: number;
  synced: number;
  failed: number;
  skipped: number;
  results: KevvSyncAttemptResult[];
};

function normalizeUrl(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getKevvSyncConfig(): KevvSyncConfig {
  const baseUrl = normalizeUrl(
    process.env.KEVV_SYNC_BASE_URL ||
      process.env.KEVV_BASE_URL ||
      process.env.APP_KEVV_URL ||
      null
  );
  const token = normalizeUrl(
    process.env.KEVV_SYNC_TOKEN ||
      process.env.KEVV_INTERNAL_API_TOKEN ||
      null
  );
  const path =
    normalizeUrl(process.env.KEVV_SYNC_PATH || null) ||
    "/api/internal/openhouse/signins";
  const timeoutMs = Number(process.env.KEVV_SYNC_TIMEOUT_MS || 8_000);

  return {
    enabled: Boolean(baseUrl && token),
    baseUrl,
    path,
    token,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8_000,
  };
}

export function buildKevvSyncPayload(record: SyncRecord): KevvSyncPayload {
  return {
    externalSignInId: record.signIn.id,
    externalEventId: record.event.id,
    eventUuid: record.event.uuid,
    source: "openhouse",
    captureMode: record.signIn.captureMode,
    agentId: record.event.kevvAgentId ?? record.owner.kevvAgentId ?? null,
    companyId: record.event.kevvCompanyId ?? record.owner.kevvCompanyId ?? null,
    owner: {
      openhouseUserId: record.owner.id,
      email: record.owner.email,
    },
    contact: {
      fullName: record.signIn.fullName,
      email: record.signIn.email,
      phone: record.signIn.phone,
    },
    intent: {
      hasAgent: Boolean(record.signIn.hasAgent),
      isPreApproved: record.signIn.isPreApproved,
      interestLevel: record.signIn.interestLevel,
      buyingTimeline: record.signIn.buyingTimeline,
      priceRange: record.signIn.priceRange,
      customAnswers: record.signIn.customAnswers,
    },
    property: {
      address: record.event.propertyAddress,
      listPrice: record.event.listPrice,
      publicMode: record.event.publicMode,
    },
    ai: {
      leadTier: record.signIn.leadTier,
      leadScore: record.signIn.leadScore,
      recommendation: record.signIn.aiRecommendation,
    },
    followUp: {
      sent: record.signIn.followUpSent,
      sentAt: record.signIn.followUpSentAt ? record.signIn.followUpSentAt.toISOString() : null,
    },
    signedInAt: record.signIn.signedInAt.toISOString(),
  };
}

function getPendingSyncStatus(currentStatus: string | null) {
  return currentStatus === "skipped" ? "skipped" : "pending";
}

export async function markSignInPendingKevvSync(signInId: number) {
  const db = getDb();
  const [record] = await db
    .select({
      crmSyncStatus: signIns.crmSyncStatus,
    })
    .from(signIns)
    .where(eq(signIns.id, signInId))
    .limit(1);

  if (!record) {
    return false;
  }

  await db
    .update(signIns)
    .set({
      crmSyncStatus: getPendingSyncStatus(record.crmSyncStatus),
    })
    .where(eq(signIns.id, signInId));

  return true;
}

async function loadSyncableRecords(limit: number, includeFailed: boolean): Promise<SyncRecord[]> {
  const db = getDb();
  const statuses: SyncableStatus[] = includeFailed ? ["pending", "failed"] : ["pending"];

  const rows = await db
    .select({
      signInId: signIns.id,
      signInEventId: signIns.eventId,
      signInFullName: signIns.fullName,
      signInEmail: signIns.email,
      signInPhone: signIns.phone,
      signInCaptureMode: signIns.captureMode,
      signInHasAgent: signIns.hasAgent,
      signInIsPreApproved: signIns.isPreApproved,
      signInInterestLevel: signIns.interestLevel,
      signInBuyingTimeline: signIns.buyingTimeline,
      signInPriceRange: signIns.priceRange,
      signInCustomAnswers: signIns.customAnswers,
      signInLeadScore: signIns.leadScore,
      signInLeadTier: signIns.leadTier,
      signInAiRecommendation: signIns.aiRecommendation,
      signInFollowUpSent: signIns.followUpSent,
      signInFollowUpSentAt: signIns.followUpSentAt,
      signInKevvContactId: signIns.kevvContactId,
      signInCrmSyncStatus: signIns.crmSyncStatus,
      signInSignedInAt: signIns.signedInAt,
      eventId: events.id,
      eventUuid: events.uuid,
      eventPropertyAddress: events.propertyAddress,
      eventListPrice: events.listPrice,
      eventPublicMode: events.publicMode,
      eventKevvAgentId: events.kevvAgentId,
      eventKevvCompanyId: events.kevvCompanyId,
      ownerId: users.id,
      ownerEmail: users.email,
      ownerKevvAgentId: users.kevvAgentId,
      ownerKevvCompanyId: users.kevvCompanyId,
    })
    .from(signIns)
    .innerJoin(events, eq(signIns.eventId, events.id))
    .innerJoin(users, eq(events.userId, users.id))
    .where(inArray(signIns.crmSyncStatus, statuses))
    .orderBy(asc(signIns.signedInAt))
    .limit(limit);

  return rows.map((row) => ({
    signIn: {
      id: row.signInId,
      eventId: row.signInEventId,
      fullName: row.signInFullName,
      email: row.signInEmail,
      phone: row.signInPhone,
      captureMode: row.signInCaptureMode,
      hasAgent: row.signInHasAgent,
      isPreApproved: row.signInIsPreApproved,
      interestLevel: row.signInInterestLevel,
      buyingTimeline: row.signInBuyingTimeline,
      priceRange: row.signInPriceRange,
      customAnswers: (row.signInCustomAnswers as Record<string, string> | null) ?? null,
      leadScore: (row.signInLeadScore as Record<string, unknown> | null) ?? null,
      leadTier: row.signInLeadTier,
      aiRecommendation: row.signInAiRecommendation,
      followUpSent: row.signInFollowUpSent,
      followUpSentAt: row.signInFollowUpSentAt,
      kevvContactId: row.signInKevvContactId,
      crmSyncStatus: row.signInCrmSyncStatus,
      signedInAt: row.signInSignedInAt,
    },
    event: {
      id: row.eventId,
      uuid: row.eventUuid,
      propertyAddress: row.eventPropertyAddress,
      listPrice: row.eventListPrice ? String(row.eventListPrice) : null,
      publicMode: row.eventPublicMode,
      kevvAgentId: row.eventKevvAgentId,
      kevvCompanyId: row.eventKevvCompanyId,
    },
    owner: {
      id: row.ownerId,
      email: row.ownerEmail,
      kevvAgentId: row.ownerKevvAgentId,
      kevvCompanyId: row.ownerKevvCompanyId,
    },
  }));
}

async function parseSyncResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as { kevvContactId?: number | null } | null;
  } catch {
    return null;
  }
}

export async function syncPendingKevvSignIns(params?: {
  limit?: number;
  includeFailed?: boolean;
}): Promise<KevvSyncRunResult> {
  const config = getKevvSyncConfig();
  if (!config.enabled || !config.baseUrl || !config.token) {
    return {
      ok: false,
      enabled: false,
      attempted: 0,
      synced: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };
  }

  const limit = params?.limit && params.limit > 0 ? Math.min(params.limit, 100) : 25;
  const includeFailed = params?.includeFailed ?? true;
  const records = await loadSyncableRecords(limit, includeFailed);
  const db = getDb();
  const endpoint = new URL(config.path, config.baseUrl).toString();
  const results: KevvSyncAttemptResult[] = [];

  for (const record of records) {
    const payload = buildKevvSyncPayload(record);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Kevv sync failed with ${response.status}${errorText ? `: ${errorText}` : ""}`
        );
      }

      const data = await parseSyncResponse(response);
      const kevvContactId =
        typeof data?.kevvContactId === "number"
          ? data.kevvContactId
          : record.signIn.kevvContactId;

      await db
        .update(signIns)
        .set({
          kevvContactId: kevvContactId ?? null,
          crmSyncStatus: "synced",
        })
        .where(eq(signIns.id, record.signIn.id));

      results.push({
        signInId: record.signIn.id,
        status: "synced",
        kevvContactId: kevvContactId ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Kevv sync error";
      await db
        .update(signIns)
        .set({
          crmSyncStatus: "failed",
        })
        .where(eq(signIns.id, record.signIn.id));

      results.push({
        signInId: record.signIn.id,
        status: "failed",
        kevvContactId: record.signIn.kevvContactId,
        error: message,
      });
    }
  }

  const synced = results.filter((result) => result.status === "synced").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const skipped = results.filter((result) => result.status === "skipped").length;

  return {
    ok: failed === 0,
    enabled: true,
    attempted: results.length,
    synced,
    failed,
    skipped,
    results,
  };
}
