import { getMailboxAuthOrigin } from "@/lib/site";
import { decryptSecretValue, encryptSecretValue } from "@/lib/secret-box";

const MICROSOFT_GRAPH_ME_URL =
  "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName";
const MICROSOFT_GRAPH_SEND_URL = "https://graph.microsoft.com/v1.0/me/sendMail";
const MICROSOFT_SCOPES = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.Send"];

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type MicrosoftUserInfo = {
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string;
};

export class MicrosoftIntegrationError extends Error {
  code:
    | "not_configured"
    | "reauth_required"
    | "quota_exceeded"
    | "invalid_sender"
    | "api_error";

  constructor(code: MicrosoftIntegrationError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function getMicrosoftClientId() {
  return (
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() ||
    process.env.MICROSOFT_CLIENT_ID?.trim() ||
    ""
  );
}

function getMicrosoftClientSecret() {
  return (
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim() ||
    process.env.MICROSOFT_CLIENT_SECRET?.trim() ||
    ""
  );
}

function getMicrosoftTenant() {
  if (process.env.MICROSOFT_TENANT_ID) {
    return process.env.MICROSOFT_TENANT_ID;
  }

  const issuer =
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ||
    process.env.MICROSOFT_ISSUER ||
    "https://login.microsoftonline.com/common/v2.0";

  const match = issuer.match(/login\.microsoftonline\.com\/([^/]+)/i);
  return match?.[1] || "common";
}

function getMicrosoftAuthorityBase() {
  return `https://login.microsoftonline.com/${getMicrosoftTenant()}`;
}

function getMicrosoftAuthorizeUrl() {
  return `${getMicrosoftAuthorityBase()}/oauth2/v2.0/authorize`;
}

function getMicrosoftTokenUrl() {
  return `${getMicrosoftAuthorityBase()}/oauth2/v2.0/token`;
}

export function isMicrosoftDirectSendAvailable() {
  return Boolean(getMicrosoftClientId() && getMicrosoftClientSecret());
}

export function getMicrosoftRedirectUri(originOverride?: string | null) {
  const origin = getMailboxAuthOrigin(originOverride);
  return new URL("/api/integrations/microsoft/callback", `${origin.replace(/\/+$/, "")}/`).toString();
}

export function createMicrosoftOAuthState(payload: {
  userId: number;
  returnTo: string;
  redirectUri?: string | null;
}) {
  return encodeURIComponent(encryptSecretValue(JSON.stringify(payload)));
}

export function parseMicrosoftOAuthState(state: string) {
  const decrypted = decryptSecretValue(decodeURIComponent(state));
  const parsed = JSON.parse(decrypted) as {
    userId: number;
    returnTo?: string;
    redirectUri?: string;
  };

  if (!parsed.userId) {
    throw new Error("Invalid Microsoft OAuth state");
  }

  return parsed;
}

export function buildMicrosoftConnectUrl(options: {
  state: string;
  loginHint?: string | null;
  redirectUri?: string | null;
}) {
  if (!isMicrosoftDirectSendAvailable()) {
    throw new MicrosoftIntegrationError(
      "not_configured",
      "Microsoft OAuth is not configured"
    );
  }

  const params = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    redirect_uri: getMicrosoftRedirectUri(options.redirectUri),
    response_type: "code",
    response_mode: "query",
    prompt: "consent",
    scope: MICROSOFT_SCOPES.join(" "),
    state: options.state,
  });

  if (options.loginHint) {
    params.set("login_hint", options.loginHint);
  }

  return `${getMicrosoftAuthorizeUrl()}?${params.toString()}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  throw new MicrosoftIntegrationError(
    "api_error",
    `Unexpected Microsoft response: ${await response.text()}`
  );
}

export async function exchangeMicrosoftCodeForTokens(
  code: string,
  redirectUriOverride?: string | null
) {
  if (!isMicrosoftDirectSendAvailable()) {
    throw new MicrosoftIntegrationError(
      "not_configured",
      "Microsoft OAuth is not configured"
    );
  }

  const response = await fetch(getMicrosoftTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getMicrosoftClientId(),
      client_secret: getMicrosoftClientSecret(),
      code,
      redirect_uri: getMicrosoftRedirectUri(redirectUriOverride),
      grant_type: "authorization_code",
      scope: MICROSOFT_SCOPES.join(" "),
    }),
  });

  const payload = await parseJsonResponse<MicrosoftTokenResponse>(response);

  if (!response.ok || !payload.access_token) {
    throw new MicrosoftIntegrationError(
      payload.error === "invalid_grant" ? "reauth_required" : "api_error",
      payload.error_description || "Failed to exchange Microsoft authorization code"
    );
  }

  return payload;
}

export async function refreshMicrosoftAccessToken(refreshTokenEncrypted: string) {
  if (!isMicrosoftDirectSendAvailable()) {
    throw new MicrosoftIntegrationError(
      "not_configured",
      "Microsoft OAuth is not configured"
    );
  }

  const refreshToken = decryptSecretValue(refreshTokenEncrypted);
  const response = await fetch(getMicrosoftTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getMicrosoftClientId(),
      client_secret: getMicrosoftClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: MICROSOFT_SCOPES.join(" "),
    }),
  });

  const payload = await parseJsonResponse<MicrosoftTokenResponse>(response);

  if (!response.ok || !payload.access_token) {
    throw new MicrosoftIntegrationError(
      payload.error === "invalid_grant" ? "reauth_required" : "api_error",
      payload.error_description || "Failed to refresh Microsoft access token"
    );
  }

  return payload.access_token;
}

export async function fetchMicrosoftUserInfo(accessToken: string) {
  const response = await fetch(MICROSOFT_GRAPH_ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await parseJsonResponse<MicrosoftUserInfo>(response);
  const email = payload.mail || payload.userPrincipalName;

  if (!response.ok || !email) {
    throw new MicrosoftIntegrationError(
      "api_error",
      "Failed to fetch Microsoft account info"
    );
  }

  return {
    email,
    name: payload.displayName || email,
  };
}

export function encryptMicrosoftRefreshToken(refreshToken: string) {
  return encryptSecretValue(refreshToken);
}

export async function revokeMicrosoftToken() {
  // Microsoft delegated refresh tokens do not expose a simple per-token revoke endpoint
  // that fits this lightweight integration. Local cleanup is sufficient here.
  return;
}

function classifyMicrosoftSendFailure(status: number, message: string) {
  if (status === 401) {
    return new MicrosoftIntegrationError(
      "reauth_required",
      "Microsoft authorization expired"
    );
  }

  if (status === 403 || status === 429) {
    return new MicrosoftIntegrationError(
      "quota_exceeded",
      message || "Microsoft sending quota exceeded"
    );
  }

  if (status === 400 && /from|sender|mailbox|permission/i.test(message)) {
    return new MicrosoftIntegrationError(
      "invalid_sender",
      message || "Invalid Microsoft sender identity"
    );
  }

  return new MicrosoftIntegrationError("api_error", message || "Microsoft send failed");
}

export async function sendViaMicrosoft(params: {
  refreshTokenEncrypted: string;
  senderEmail: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
}) {
  const accessToken = await refreshMicrosoftAccessToken(params.refreshTokenEncrypted);
  const response = await fetch(MICROSOFT_GRAPH_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: params.subject,
        body: {
          contentType: "Text",
          content: params.text,
        },
        toRecipients: [
          {
            emailAddress: {
              address: params.to,
            },
          },
        ],
        replyTo: [
          {
            emailAddress: {
              address: params.replyTo || params.senderEmail,
            },
          },
        ],
      },
      saveToSentItems: true,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw classifyMicrosoftSendFailure(response.status, payload);
  }

  return true;
}
