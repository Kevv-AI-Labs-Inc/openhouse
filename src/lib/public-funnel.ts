const COOKIE_PREFIX = "oh-funnel";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const STAGE_COOKIE_TTL_SECONDS: Record<PublicFunnelStage, number> = {
  page_view: 60 * 10,
  form_start: 60 * 5,
};

export type PublicFunnelStage = "page_view" | "form_start";

export function getPublicFunnelVisitorCookieName(uuid: string) {
  return `${COOKIE_PREFIX}-${uuid}`;
}

export function getPublicFunnelVisitorId(
  cookieStore: { get: (name: string) => { value?: string } | undefined },
  uuid: string
) {
  return cookieStore.get(getPublicFunnelVisitorCookieName(uuid))?.value ?? null;
}

export function buildPublicFunnelVisitorCookie(uuid: string, visitorId: string) {
  return {
    name: getPublicFunnelVisitorCookieName(uuid),
    value: visitorId,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  };
}

export function getPublicFunnelStageCookieName(uuid: string, stage: PublicFunnelStage) {
  return `${COOKIE_PREFIX}-${uuid}-${stage}`;
}

export function hasPublicFunnelStageCookie(
  cookieStore: { get: (name: string) => { value?: string } | undefined },
  uuid: string,
  stage: PublicFunnelStage
) {
  return Boolean(cookieStore.get(getPublicFunnelStageCookieName(uuid, stage))?.value);
}

export function buildPublicFunnelStageCookie(uuid: string, stage: PublicFunnelStage) {
  return {
    name: getPublicFunnelStageCookieName(uuid, stage),
    value: "1",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: STAGE_COOKIE_TTL_SECONDS[stage],
    path: "/",
  };
}

export function isTrustedPublicFunnelRequest(params: {
  requestOrigin: string;
  siteOrigin?: string | null;
  originHeader?: string | null;
  refererHeader?: string | null;
}) {
  const allowedOrigins = new Set([params.requestOrigin]);

  if (params.siteOrigin) {
    allowedOrigins.add(params.siteOrigin);
  }

  const candidates = [params.originHeader, params.refererHeader].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  if (candidates.length === 0) {
    return true;
  }

  return candidates.every((value) => {
    try {
      return allowedOrigins.has(new URL(value).origin);
    } catch {
      return false;
    }
  });
}
