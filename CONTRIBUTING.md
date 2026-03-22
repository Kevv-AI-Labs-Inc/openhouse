# Contributing to OpenHouse

OpenHouse is the official open-source codebase maintained by Kevv. We welcome focused contributions that improve stability, developer experience, docs, and broadly reusable product capabilities.

## Before You Start

- For bug fixes, open an issue first unless the fix is obviously small and self-contained.
- For larger features or workflow changes, start with a proposal so maintainers can confirm fit and scope.
- For security issues, do not open a public issue. Follow [SECURITY.md](./SECURITY.md).
- By contributing, you agree that your work will be released under the repository's Apache 2.0 license.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Sync the database schema:

```bash
npx drizzle-kit push --config=drizzle.config.ts
```

4. Start the app:

```bash
npm run dev
```

## Pull Request Expectations

- Keep changes scoped. Split unrelated work into separate PRs.
- Add or update tests when behavior changes.
- Keep docs and env examples in sync with code changes.
- Call out migrations, new environment variables, and breaking changes in the PR description.
- Do not include secrets, customer data, or internal operational details.

## Review Scope

- Maintainers prioritize fixes, documentation, reliability, and reusable platform improvements.
- Product-specific roadmap decisions remain with Kevv.
- Official customer support is only available for the Kevv-hosted product, not for self-hosted forks.

## Branding

Use of Kevv and OpenHouse names, logos, and domains is governed by [TRADEMARKS.md](./TRADEMARKS.md). If you publish a fork, make sure it is clearly identified as unofficial unless you have explicit written permission from Kevv.
