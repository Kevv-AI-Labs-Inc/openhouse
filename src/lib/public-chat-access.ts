import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { publicChatAccessGrants } from "@/lib/db/schema";

const COOKIE_PREFIX = "oh-chat-access";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const COOKIE_VERSION = "v2";
const TOKEN_BYTES = 32;

type CookieStore = {
  get: (name: string) => { value?: string } | undefined;
};

type Db = ReturnType<typeof getDb>;

export type ResolvedPublicChatAccess = {
  grantId: number;
  signInId: number;
  expiresAt: Date;
};

function getPublicChatCookieSecret() {
  const secret = process.env.PUBLIC_CHAT_COOKIE_SECRET || process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("PUBLIC_CHAT_COOKIE_SECRET or AUTH_SECRET is required");
  }

  return secret;
}

function signPublicChatToken(uuid: string, token: string) {
  return createHmac("sha256", getPublicChatCookieSecret())
    .update(`${uuid}:${token}`)
    .digest("hex");
}

function isValidSignature(expected: string, provided: string) {
  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function hashPublicChatAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getPublicChatAccessCookieName(uuid: string) {
  return `${COOKIE_PREFIX}-${uuid}`;
}

export function buildPublicChatAccessCookieValue(uuid: string, token: string) {
  return `${COOKIE_VERSION}:${token}:${signPublicChatToken(uuid, token)}`;
}

export function parsePublicChatAccessCookieValue(uuid: string, rawValue?: string | null) {
  if (!rawValue) {
    return null;
  }

  const [version, token, signature] = rawValue.split(":");

  if (version !== COOKIE_VERSION || !token || !signature) {
    return null;
  }

  const expectedSignature = signPublicChatToken(uuid, token);

  if (!isValidSignature(expectedSignature, signature)) {
    return null;
  }

  return { token };
}

function getPublicChatCookieToken(cookieStore: CookieStore, uuid: string) {
  const rawValue = cookieStore.get(getPublicChatAccessCookieName(uuid))?.value;

  return parsePublicChatAccessCookieValue(uuid, rawValue);
}

export async function issuePublicChatAccessGrant(
  db: Db,
  params: { uuid: string; eventId: number; signInId: number }
) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000);

  const [result] = await db.insert(publicChatAccessGrants).values({
    eventId: params.eventId,
    signInId: params.signInId,
    tokenHash: hashPublicChatAccessToken(token),
    expiresAt,
  });

  return {
    grantId: Number(result.insertId),
    cookie: {
      name: getPublicChatAccessCookieName(params.uuid),
      value: buildPublicChatAccessCookieValue(params.uuid, token),
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
    },
    expiresAt,
  };
}

export async function resolvePublicChatAccessGrant(
  db: Db,
  params: { cookieStore: CookieStore; uuid: string; eventId: number }
): Promise<ResolvedPublicChatAccess | null> {
  const access = getPublicChatCookieToken(params.cookieStore, params.uuid);

  if (!access) {
    return null;
  }

  try {
    const [grant] = await db
      .select({
        id: publicChatAccessGrants.id,
        signInId: publicChatAccessGrants.signInId,
        expiresAt: publicChatAccessGrants.expiresAt,
      })
      .from(publicChatAccessGrants)
      .where(
        and(
          eq(publicChatAccessGrants.eventId, params.eventId),
          eq(publicChatAccessGrants.tokenHash, hashPublicChatAccessToken(access.token)),
          gt(publicChatAccessGrants.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!grant) {
      return null;
    }

    void db
      .update(publicChatAccessGrants)
      .set({ lastUsedAt: new Date() })
      .where(eq(publicChatAccessGrants.id, grant.id))
      .catch(() => {});

    return {
      grantId: grant.id,
      signInId: grant.signInId,
      expiresAt: new Date(grant.expiresAt),
    };
  } catch (error) {
    console.error("[PublicChatAccess] Grant lookup failed:", error);
    return null;
  }
}
