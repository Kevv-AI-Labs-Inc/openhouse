type SendRelayEmailParams = {
  to: string;
  subject: string;
  text: string;
  fromEmail: string;
  fromName?: string | null;
  replyTo?: string | null;
};

type ResendDomainRecord = {
  record?: string;
  name?: string;
  type?: string;
  value?: string;
  status?: string;
};

type ResendDomain = {
  id?: string;
  name?: string;
  status?: string;
  records?: ResendDomainRecord[];
};

function getResendApiKey() {
  return process.env.RESEND_API_KEY || "";
}

function getSystemFromAddress() {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || null;
}

function getSystemReplyToAddress(replyTo?: string | null) {
  return replyTo || process.env.RESEND_REPLY_TO_EMAIL || null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toHtml(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function formatFromHeader(fromEmail: string, fromName?: string | null) {
  if (!fromName?.trim()) {
    return fromEmail;
  }

  return `${fromName.trim()} <${fromEmail}>`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  throw new Error(`Unexpected Resend response: ${await response.text()}`);
}

async function resendRequest<T>(path: string, init?: RequestInit) {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    throw new Error("Resend API key is not configured");
  }

  const response = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Resend request failed: ${payload}`);
  }

  return parseJsonResponse<T>(response);
}

export function isEmailRelayConfigured() {
  return Boolean(getResendApiKey());
}

export function isSystemEmailConfigured() {
  return Boolean(getResendApiKey() && getSystemFromAddress());
}

export async function sendSystemEmail(params: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
}) {
  const from = getSystemFromAddress();

  if (!from) {
    throw new Error("System email is not configured");
  }

  return resendRequest("/emails", {
    method: "POST",
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: toHtml(params.text),
      reply_to: getSystemReplyToAddress(params.replyTo) || undefined,
    }),
  });
}

export async function sendViaCustomDomainRelay(params: SendRelayEmailParams) {
  if (!isEmailRelayConfigured()) {
    throw new Error("Email relay is not configured");
  }

  return resendRequest("/emails", {
    method: "POST",
    body: JSON.stringify({
      from: formatFromHeader(params.fromEmail, params.fromName),
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: toHtml(params.text),
      reply_to: params.replyTo || undefined,
    }),
  });
}

export async function lookupRelayDomain(domain: string): Promise<ResendDomain | null> {
  if (!isEmailRelayConfigured()) {
    return null;
  }

  const payload = await resendRequest<{ data?: ResendDomain[] }>("/domains");
  const normalizedDomain = domain.trim().toLowerCase();
  const domains = Array.isArray(payload.data) ? payload.data : [];

  return (
    domains.find((item) => item.name?.trim().toLowerCase() === normalizedDomain) || null
  );
}

export function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function inferDomainStatus(value?: string | null) {
  const normalized = value?.trim().toLowerCase() || "";

  if (normalized === "verified") {
    return "verified" as const;
  }

  if (normalized === "pending") {
    return "pending" as const;
  }

  if (normalized === "failed") {
    return "failed" as const;
  }

  return "not_started" as const;
}

export type { ResendDomain, ResendDomainRecord };
