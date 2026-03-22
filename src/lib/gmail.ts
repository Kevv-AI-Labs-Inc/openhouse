import { getMailboxAuthOrigin } from "@/lib/site";
import { decryptSecretValue, encryptSecretValue } from "@/lib/secret-box";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

type GmailUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
};

export class GmailIntegrationError extends Error {
  code:
    | "not_configured"
    | "reauth_required"
    | "quota_exceeded"
    | "invalid_sender"
    | "api_error";

  constructor(
    code: GmailIntegrationError["code"],
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

function getGoogleClientId() {
  return process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "";
}

function getGoogleClientSecret() {
  return process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
}

export function isGmailDirectSendAvailable() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export function getGmailRedirectUri(originOverride?: string | null) {
  const origin = getMailboxAuthOrigin(originOverride);
  return new URL("/api/integrations/gmail/callback", `${origin.replace(/\/+$/, "")}/`).toString();
}

function encodeBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createGmailOAuthState(payload: { userId: number; returnTo: string }) {
  return encodeURIComponent(encryptSecretValue(JSON.stringify(payload)));
}

export function parseGmailOAuthState(state: string) {
  const decrypted = decryptSecretValue(decodeURIComponent(state));
  const parsed = JSON.parse(decrypted) as { userId: number; returnTo?: string };

  if (!parsed.userId) {
    throw new Error("Invalid Gmail OAuth state");
  }

  return parsed;
}

export function buildGmailConnectUrl(options: {
  state: string;
  loginHint?: string | null;
  originOverride?: string | null;
}) {
  const clientId = getGoogleClientId();

  if (!clientId) {
    throw new GmailIntegrationError("not_configured", "Google OAuth is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGmailRedirectUri(options.originOverride),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: `openid email profile ${GMAIL_SEND_SCOPE}`,
    state: options.state,
  });

  if (options.loginHint) {
    params.set("login_hint", options.loginHint);
  }

  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  throw new GmailIntegrationError(
    "api_error",
    `Unexpected Google response: ${await response.text()}`
  );
}

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGmailCodeForTokens(code: string, originOverride?: string | null) {
  if (!isGmailDirectSendAvailable()) {
    throw new GmailIntegrationError("not_configured", "Google OAuth is not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getGmailRedirectUri(originOverride),
      grant_type: "authorization_code",
    }),
  });

  const payload = await parseJsonResponse<GoogleTokenResponse>(response);

  if (!response.ok || !payload.access_token) {
    throw new GmailIntegrationError(
      payload.error === "invalid_grant" ? "reauth_required" : "api_error",
      payload.error_description || "Failed to exchange Gmail authorization code"
    );
  }

  return payload;
}

export async function refreshGmailAccessToken(refreshTokenEncrypted: string) {
  if (!isGmailDirectSendAvailable()) {
    throw new GmailIntegrationError("not_configured", "Google OAuth is not configured");
  }

  const refreshToken = decryptSecretValue(refreshTokenEncrypted);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = await parseJsonResponse<GoogleTokenResponse>(response);

  if (!response.ok || !payload.access_token) {
    throw new GmailIntegrationError(
      payload.error === "invalid_grant" ? "reauth_required" : "api_error",
      payload.error_description || "Failed to refresh Gmail access token"
    );
  }

  return payload.access_token;
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await parseJsonResponse<GmailUserInfo>(response);

  if (!response.ok || !payload.email) {
    throw new GmailIntegrationError("api_error", "Failed to fetch Google user info");
  }

  return payload;
}

export function encryptGmailRefreshToken(refreshToken: string) {
  return encryptSecretValue(refreshToken);
}

export async function revokeGoogleToken(refreshTokenEncrypted: string) {
  try {
    const refreshToken = decryptSecretValue(refreshTokenEncrypted);
    await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch {
    // Local cleanup still matters even if remote revoke fails.
  }
}

function buildMimeMessage(params: {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
}) {
  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];

  if (params.replyTo) {
    lines.push(`Reply-To: ${params.replyTo}`);
  }

  lines.push("", params.text);

  return encodeBase64Url(lines.join("\r\n"));
}

function classifyGmailSendFailure(status: number, message: string) {
  if (status === 401) {
    return new GmailIntegrationError("reauth_required", "Gmail authorization expired");
  }

  if (status === 403 || status === 429) {
    return new GmailIntegrationError("quota_exceeded", message || "Gmail sending quota exceeded");
  }

  if (status === 400 && /from header|sendas|alias|invalid argument/i.test(message)) {
    return new GmailIntegrationError("invalid_sender", message || "Invalid Gmail sender identity");
  }

  return new GmailIntegrationError("api_error", message || "Gmail send failed");
}

export async function sendViaGmail(params: {
  refreshTokenEncrypted: string;
  senderEmail: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
}) {
  const accessToken = await refreshGmailAccessToken(params.refreshTokenEncrypted);
  const raw = buildMimeMessage({
    from: params.senderEmail,
    to: params.to,
    subject: params.subject,
    text: params.text,
    replyTo: params.replyTo || params.senderEmail,
  });

  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw classifyGmailSendFailure(response.status, payload);
  }

  return response.json();
}
