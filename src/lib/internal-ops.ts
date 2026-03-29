import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getInternalOpsToken() {
  return (
    process.env.INTERNAL_OPS_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

export function hasInternalOpsTokenConfigured() {
  return Boolean(getInternalOpsToken());
}

export function isInternalOpsAuthorized(request: Request) {
  const configuredToken = getInternalOpsToken();
  if (!configuredToken) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return safeCompare(authorization.slice("Bearer ".length).trim(), configuredToken);
  }

  const headerToken = request.headers.get("x-ops-token")?.trim();
  if (headerToken) {
    return safeCompare(headerToken, configuredToken);
  }

  return false;
}

export function internalOpsUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function internalOpsDisabledResponse() {
  return NextResponse.json(
    { error: "INTERNAL_OPS_TOKEN or CRON_SECRET is not configured" },
    { status: 503 }
  );
}
