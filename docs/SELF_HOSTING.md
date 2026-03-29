# Self-Hosting OpenHouse

OpenHouse can run as a fully self-hosted Next.js app. The fastest path is:

1. Copy `.env.example` to `.env.local`
2. Fill the minimum env vars
3. Push the schema with Drizzle
4. Start the app

```bash
npm install
cp .env.example .env.local
npx drizzle-kit push --config=drizzle.config.ts
npm run dev
```

## Minimum viable setup

For a local or internal deployment, configure at least:

```bash
DATABASE_URL=mysql://...
AUTH_SECRET=...
NEXTAUTH_URL=https://app.example.com
NEXT_PUBLIC_APP_URL=https://app.example.com
NEXT_PUBLIC_SITE_URL=https://app.example.com
AUTH_TRUST_HOST=true
PUBLIC_CHAT_COOKIE_SECRET=...
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
```

With only these values, you get:

- passwordless auth
- event creation and public sign-in links
- seller reports
- kiosk mode
- database-backed rate limiting

## Recommended production setup

For a production deployment, add the integrations that match the product surface you want to sell:

- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for magic links and system mail
- `AZURE_OPENAI_*` for AI Q&A, lead scoring, and follow-up generation
- `TAVILY_API_KEY` for public-web grounding in property Q&A
- `STRIPE_*` for self-serve billing
- Google and Microsoft auth vars for direct mailbox sending
- listing import vars for MLS, address, and flyer workflows

If you do not configure a given integration, OpenHouse should degrade gracefully instead of exposing the feature.

## Self-hosting boundaries

The open-source app includes the hosted-product workflows, but some organizations will still keep parts of their stack private:

- Kevv-side CRM ingestion
- brokerage-specific listing adapters
- proprietary analytics or lead-routing layers

The repository supports this by keeping external sync behind explicit environment variables and internal ops endpoints.

## Deployment notes

- Run `npx drizzle-kit push --config=drizzle.config.ts` before cutting traffic to a new deployment.
- Configure `INTERNAL_OPS_TOKEN` in every deployed environment so you can use runtime schema checks and worker endpoints.
- If you do not use Upstash Redis, OpenHouse falls back to a database-backed rate limiter.
- The kiosk supports offline sign-in after the device has loaded the page online at least once.

## Validation checklist

Before treating a self-hosted deployment as production-ready:

```bash
npm run lint
npm run test:smoke
npm run test:critical
npm run build
```

If you have database access from the app host:

```bash
npm run db:check
```

If you have Kevv sync configured:

```bash
npm run kevv:sync -- --limit=25
```
