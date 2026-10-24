# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Mirembe Cleaning landing page + waitlist/hiring forms: React 19 + TypeScript + Vite + Tailwind v4 frontend, Node Vercel Functions in `api/`, Supabase (Postgres) persistence, Cloudflare Turnstile, Resend email, Google Sheets sync. `README.md` is the detailed spec for API contracts, outbox semantics, and launch procedures — read the relevant section before changing behavior.

## Commands

```sh
npm run lint                 # eslint .
npm run test                 # vitest run (jsdom, setup in src/test/setup.ts)
npx vitest run server/turnstile.test.ts      # single file
npx vitest run -t "name of test"             # single test by name
npm run typecheck:api        # tsc for api/, server/, scripts/ (tsconfig.api.json)
npm run build                # seo:generate → tsc -b → API typecheck → vite build
```

- Full local stack (frontend + `/api/*`): `node --env-file=.env.local "$(command -v vercel)" dev --listen 3000`, then open `http://localhost:3000`. `npm run dev` serves only Vite on :5173 with no API routes.
- `.env.local` comes from `.env.example`. Only `VITE_*` vars reach the browser; never prefix secrets with `VITE_`. Turnstile local test keys are listed in the README.
- `npm run sheets:admin -- --dry-run | --format | --apply --approved-backfill --exclude-file <file>` touches production Sheets/Supabase data. Only run `--format`/`--apply` with explicit owner approval.

## Architecture

**Prerendered + hydrated SPA.** `scripts/generate-seo.ts` (run by both `dev` and `build`) SSR-renders `src/App.tsx` through Vite's `ssrLoadModule` and **writes the root `index.html`** (committed) plus `public/robots.txt` and `public/sitemap.xml`, all derived from `src/config/business.ts` and `src/config/seo.ts`. `src/main.tsx` uses `hydrateRoot`, so components must render identically on server and client. Browser-only UI (Turnstile, consent, anything reading `window`) is gated with `useHydrated()` from `src/lib/useHydrated.ts` to avoid hydration mismatches. Edit the config files or the generator, not `index.html`, for metadata changes.

**Frontend.** `App` → `src/components/landing/LandingPage.tsx` (the extended landing page; styles in `src/landing.css` with CSS custom properties scoped to `.landing-page`). Forms: waitlist (`WaitlistModal`/`WaitlistForm`/`ZipCodeForm`) and hiring (`components/hiring/`). Network calls live in `src/services/*Service.ts`; data contracts/option values in `src/types/`. Analytics (`src/lib/analytics/`) load GA4/Meta tags only after consent; campaign attribution lives in sessionStorage.

**API layer.** Each file in `api/` is a thin Web `Request`/`Response` handler delegating to `server/`:
- `server/handler.ts` `handleSubmission()` is the shared pipeline: POST only → size-limited JSON (`server/http.ts`) → Turnstile verify (`server/turnstile.ts`, checks action + hostname in production) → strict zod schema (`server/validation.ts`, rejects unknown keys) → persist via `server/database.ts` → kick off email and Sheets workers with Vercel `waitUntil`.
- `server/database.ts` is the **only** place the privileged Supabase client is created. Error envelope is `{ ok: false, error: { code, message, fields } }`; status code conventions are in the README.
- `api/waitlist/zip.ts` authorizes ZIP updates with a signed 24h token from `server/zipToken.ts` (duplicates get no token).
- `server/` and `api/` use NodeNext ESM: relative imports must end in `.js`.

**Durable outboxes (DB-driven side effects).** Postgres insert triggers on `waitlist_subscribers` / `cleaning_applicants` (new `source = landing_page` rows) enqueue jobs in the same transaction: two email jobs (visitor confirmation + internal notice) and one Sheets job. Workers in `server/email/worker.ts` and `server/sheets/worker.ts` claim jobs via RPCs (`claim_email_jobs`/`complete_email_job`, `claim_sheet_jobs`/`complete_sheet_job`) using `FOR UPDATE SKIP LOCKED` leases. They run immediately via `waitUntil` and are recovered by daily `CRON_SECRET`-authenticated crons (`api/email-worker.ts`, `api/sheets-worker.ts`, scheduled in `vercel.json`). Resend gets the outbox key as an idempotency key; the Sheets worker dedupes by the Submission ID column before every append. Logs carry job IDs and error codes only, never PII.

**Database.** Migrations live in `supabase/migrations/` and are applied manually; they are already applied in production, so don't rerun them there. Tables are service-role only (RLS on, anon/authenticated privileges revoked). Load the `supabase` / `supabase-postgres-best-practices` skills before schema or SQL changes.

## Conventions

- Email templates (`server/email/templates.ts`) use `@react-email/render` with table markup, inline styles, a text wordmark, and plain-text alternatives.
- Business facts (contact address, offer copy, service areas) belong in `src/config/business.ts`, shared by the page, SEO output, and emails.
- `artifacts/` holds screenshot QA evidence for layout work; `docs/` has the SEO/discoverability launch guide and asset optimization notes.
