# OpenHouse

OpenHouse is an AI-native open house operations platform for North American real estate teams. It includes Google and Microsoft sign-in, branded sign-in flows, seller-ready reporting, direct mailbox follow-up, and self-serve Pro billing.

This repository is the official open-source OpenHouse codebase maintained by Kevv.

The official hosted product, support, and brand experience remain operated by Kevv at [openhouse.kevv.ai](https://openhouse.kevv.ai) and [kevv.ai](https://kevv.ai).

## Open Source Status

- Source code is licensed under Apache 2.0. See [LICENSE](./LICENSE).
- Kevv trademarks, logos, product names, and official domains are not licensed under Apache 2.0. See [TRADEMARKS.md](./TRADEMARKS.md).
- Security issues should be reported privately. See [SECURITY.md](./SECURITY.md).
- Community contributions are welcome, but official product support is only provided for the Kevv-hosted service.
- Contribution and review expectations are documented in [CONTRIBUTING.md](./CONTRIBUTING.md).

Official product and brand properties remain operated by Kevv.

## Core Stack

- Next.js App Router
- NextAuth v5 with Google OAuth and Microsoft Entra ID
- MySQL + Drizzle ORM
- Azure OpenAI for scoring, follow-up generation, and property Q&A
- Stripe Checkout + Billing Portal for Pro subscriptions
- Resend for system email and Pro custom sending domains
- External listing data service for MLS and address-based property import

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and fill the values:

```bash
cp .env.example .env.local
```

3. Run database schema sync:

```bash
npx drizzle-kit push --config=drizzle.config.ts
```

4. Start the app:

```bash
npm run dev
```

## Required Environment Variables

### Base App

```bash
DATABASE_URL=mysql://...
AUTH_SECRET=...
NEXTAUTH_URL=https://app.example.com
NEXT_PUBLIC_APP_URL=https://app.example.com
NEXT_PUBLIC_SITE_URL=https://app.example.com
AUTH_TRUST_HOST=true
PUBLIC_CHAT_COOKIE_SECRET=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
```

### Google Auth

```bash
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
MAIL_TOKEN_ENCRYPTION_KEY=... # optional, otherwise AUTH_SECRET is used
```

Google Cloud OAuth redirect URIs:

```text
https://app.example.com/api/auth/callback/google
https://app.example.com/api/integrations/gmail/callback
```

### Microsoft Auth

Use the canonical Auth.js variables:

```bash
AUTH_MICROSOFT_ENTRA_ID_ID=...
AUTH_MICROSOFT_ENTRA_ID_SECRET=...
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant>/v2.0
```

If you want a multi-tenant setup, you can use:

```bash
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/common/v2.0
```

Microsoft redirect URIs:

```text
https://app.example.com/api/auth/callback/microsoft-entra-id
https://app.example.com/api/integrations/microsoft/callback
```

### Stripe Billing

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Stripe is server-driven in this app, so a publishable key is not currently required.

### AI

```bash
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://<resource>.cognitiveservices.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini
TAVILY_API_KEY=...
```

`TAVILY_API_KEY` is optional. When configured, OpenHouse property Q&A can pull live public web context for questions that are often missing from MLS feeds, such as school references, nearby transit, or neighborhood context. Structured MLS/flyer facts still take priority over web results.

Optional allowlists let you constrain public-web grounding to approved domains:

```bash
PROPERTY_QA_WEB_SEARCH_INCLUDE_DOMAINS=
PROPERTY_QA_SCHOOL_SEARCH_DOMAINS=
PROPERTY_QA_TRANSIT_SEARCH_DOMAINS=
PROPERTY_QA_TAX_SEARCH_DOMAINS=
PROPERTY_QA_NEIGHBORHOOD_SEARCH_DOMAINS=
ADDRESS_IMPORT_WEB_SEARCH_INCLUDE_DOMAINS=
```

Use these to keep public-web answers anchored to trusted sources such as official transit agencies, school directories, or tax/government sites.
`ADDRESS_IMPORT_WEB_SEARCH_INCLUDE_DOMAINS` can also be used to constrain address-import fallback candidates when your listing provider misses.

### Listing Import

OpenHouse can prefill a new event from a listing service using three flows:

- `Import by MLS #`
- `Import by Address`
- `Upload Flyer / PDF`

Configure the listing service adapter with:

```bash
LISTING_DATA_API_URL=https://your-listing-service.example.com
LISTING_DATA_API_KEY=...
```

Optional but recommended for realtime address suggestions before provider matching:

```bash
GOOGLE_MAPS_API_KEY=...
```

If you expose a direct provider endpoint instead of the default listing adapter, you can also use:

```bash
LISTING_PROVIDER_BASE_URL=https://provider.example.com
LISTING_PROVIDER_API_KEY=provider_key_xxx
```

When `LISTING_PROVIDER_BASE_URL` is present, the MLS import path defaults to:

```bash
/api/v1/listings/:mlsId
```

The default adapter expects:

- `GET /api/v1/listings/mls/:mlsId` for the legacy listing service
- `GET /api/v1/listings/:mlsId` when using the direct provider alias env
- `POST /api/v1/search`

If your service uses different paths, override them:

```bash
LISTING_DATA_MLS_LOOKUP_PATH=/custom/mls/:mlsId
LISTING_DATA_ADDRESS_SEARCH_PATH=/custom/search
```

The adapter sends both `X-API-Key` and `Authorization: Bearer ...` headers for compatibility with existing internal services.

### Email Relay

```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=OpenHouse <noreply@app.example.com>
RESEND_REPLY_TO_EMAIL=agent@example.com
```

Resend is no longer used as a shared fallback for client follow-up. It is used for:

- system email
- Pro custom sending domains that the brokerage verifies separately

If no owned sender is active, AI follow-up still generates a draft, but OpenHouse will not send the email.

### Direct Mailbox Sending

OpenHouse supports direct mailbox sending from:

- Google / Gmail / Google Workspace
- Microsoft Outlook / Microsoft 365

Mailbox permissions are separate from login and are granted inside `/dashboard/settings`.

Required env:

```bash
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
MAIL_TOKEN_ENCRYPTION_KEY=... # recommended
AUTH_MICROSOFT_ENTRA_ID_ID=...
AUTH_MICROSOFT_ENTRA_ID_SECRET=...
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/common/v2.0
```

Required redirect URIs:

```text
https://app.example.com/api/integrations/gmail/callback
https://app.example.com/api/integrations/microsoft/callback
```

Behavior:
- Agent signs in with Google or Microsoft
- Agent can separately connect a Google mailbox or Microsoft mailbox from Settings
- Follow-up delivery is explicitly set to one of:
  - `Google mailbox`
  - `Microsoft mailbox`
  - `Verified team domain`
  - `Draft only`
- If the selected sender fails, OpenHouse stores a draft instead of relaying through a shared platform sender

### Pro Custom Sending Domains

Pro users can save a brokerage/team domain such as `mail.brand.com` and use it for client follow-up through the platform relay.

Requirements:

- `RESEND_API_KEY` configured
- domain verified inside your Resend account
- `from` email belongs to that domain

OpenHouse stores the preferred sender identity, but the DNS verification still happens in Resend.

## Stripe Setup

1. In Stripe, create a product named `OpenHouse Pro`.
2. Add one recurring monthly price at `$29/month`.
3. Copy the resulting price ID into `STRIPE_PRO_PRICE_ID`.
4. Add the secret API key to `STRIPE_SECRET_KEY`.
5. Create a webhook endpoint:

```text
https://app.example.com/api/billing/webhook
```

6. Subscribe the webhook to these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
7. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
8. Deploy and test the upgrade flow from `/dashboard/settings`.

If multiple apps share the same Stripe account, give each app its own webhook endpoint, price ID, and metadata tag. OpenHouse tags Checkout and Subscription objects with `app=openhouse` and ignores webhook events that do not match the OpenHouse price or metadata.

## Commercial Behavior

- Free plan:
  - Unlimited events
  - 150 sign-ins / month
  - QR and kiosk capture
  - Basic reporting
- Pro plan:
  - Unlimited sign-ins
  - AI lead scoring
  - Unlimited property Q&A
  - AI follow-up generation
  - Google and Microsoft mailbox sending
  - Verified team sending domains
  - Detailed seller reporting

## Production Notes

- Google and Microsoft are both valid sign-in methods.
- Google and Microsoft mailbox connections are optional and separate from sign-in.
- Client follow-up no longer falls back to a shared platform sender.
- Pro custom domains are the only platform-relayed client email path.
- Stripe webhooks control subscription state and Pro entitlements.
- Public property Q&A and sign-in endpoints include baseline request throttling.
- AI features degrade safely if their environment variables are missing.
- Listing import gracefully degrades if `LISTING_DATA_API_URL` or `LISTING_DATA_API_KEY` is missing.
