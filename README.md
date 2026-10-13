# Mirembe Cleaning waitlist

React, TypeScript, Vite, and Tailwind landing page with waitlist and cleaning team forms backed by Vercel Functions and Supabase.

## Run locally

```sh
npm install
node --env-file=.env.local "$(command -v vercel)" dev --listen 3000
```

Create an ignored `.env.local` from `.env.example` with the Mirembe project's `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VITE_TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY`. Link the Vercel CLI to the existing project, then open `http://localhost:3000` for the complete frontend and API flow. `npm run dev` serves only Vite on `localhost:5173`; it does not serve `/api/*`. `vercel dev` reads Vercel's pulled environment settings; the `node --env-file` invocation above also passes local `.env.local` values to the functions. Never use `VITE_` for either secret. Run `npm run lint`, `npm run test`, and `npm run build` for local checks.

For local Turnstile testing, Cloudflare provides the public site key `1x00000000000000000000AA` and matching server test secret `1x0000000000000000000000000000000AA`. Put those in `.env.local` only; use the real widget keys in Vercel production. The test pair still calls Cloudflare Siteverify and cannot validate production tokens. The always-pass test secret can accept arbitrary nonempty test input; use Cloudflare's failing test secret for negative-path checks. Cloudflare's dummy verification response may omit the action or return `test`; the server accepts that response only with the official test secret outside production. Production continues to require the matching action and approved hostname, and fails closed if its secret is absent. The widget uses `interaction-only` appearance, so it only becomes visible when Cloudflare needs visitor interaction. Managed mode itself is set in the Cloudflare widget dashboard. Tokens are single-use and reset after failed submissions.

## Waitlist flow

`src/services/waitlistService.ts` submits email and a fresh Turnstile token to `POST /api/waitlist`. The server verifies the token with Cloudflare, validates and normalizes the email, then inserts it into `public.waitlist_subscribers` with server-controlled `source: landing_page`. A successful insert returns `201` with the row ID, creation time, and a signed ZIP update token. A duplicate email returns a generic `200` acknowledgment without changing the existing row or revealing its status. The success screen appears only after one of these responses. Network or database failures leave the form available for retry.

The optional ZIP form calls `POST /api/waitlist/zip` after registration, so an email registration succeeds independently of the ZIP step. The endpoint accepts a 5-digit US ZIP or ZIP+4, uses the signed token to identify the new registration, and updates only `zip_code`. Tokens expire after 24 hours. Duplicate registrations do not receive a ZIP token; their optional ZIP attempt shows an unavailable message because an email address alone cannot authorize a lead update. The table must have nullable `zip_code VARCHAR(10)` for this step.

On desktop, a successful ZIP update replaces the optional form with the compact confirmation from the Figma saved state. The form fades out before the confirmation enters; the main email success content stays mounted. Reduced-motion users see the confirmation immediately. A small **Edit ZIP** action reopens the form with the saved value, and **Cancel** returns to the confirmation without another update. Focus moves to the confirmation when the form is removed.

## Cleaning team applications

The hiring link opens a native modal dialog with a fixed header and Submit Application footer. Only the question area scrolls. Draft answers remain in React state when the dialog closes and reopens; a successful submission keeps its confirmation on reopen, preventing an accidental second application in the same session. Experience, travel distance, availability, and vehicle access use single-select radios. Languages use independent checkboxes, with a detail field when Other is selected. The phone field stores ten US digits (including normalized pasted `+1` numbers); email remains editable while typing and is validated on blur and submit.

`src/types/hiring.ts` defines the hiring data contract and option values. `src/services/hiringApplicationService.ts` validates and normalizes the form, then submits it with a fresh Turnstile token to `POST /api/applicants`. The server verifies the token before writing to `public.cleaning_applicants`; only a confirmed `201` displays the acceptance screen. The form holds its loading state until the response arrives, preserves all answers on failure, and keeps the original confirmation animation and modal behavior. The database extension is saved in [`supabase/migrations/20261012020254_add_cleaning_applicant_fields.sql`](supabase/migrations/20261012020254_add_cleaning_applicant_fields.sql) for manual execution. It adds `languages TEXT[]` and leaves added columns nullable for compatibility with older records. The later email migration adds a nullable unique `submission_key` so a network retry of the same form attempt can return the original saved application without creating another record or email jobs.

The applicant API maps `first_name` and `last_name` to their own columns and to the existing required `full_name` column. `has_vehicle` maps to `has_personal_vehicle`; the other form fields map to columns with the same names. `languages` is stored as a text array, and `other_language` is stored only when `other` is selected. The server assigns `status: new` and `source: landing_page`; visitors cannot submit either value, notes, identifiers, or timestamps. Applicants may reapply with the same email.

## Privacy and launch copy

The form describes launch and booking updates; the optional ZIP prompt explains its use for prioritizing availability. Set `VITE_PRIVACY_POLICY_URL` to a published privacy-policy URL to show the form link. Until it is set, no policy link is rendered. Before deployment, publish a policy that matches the actual data handling and outreach, configure the URL, and review the final waitlist wording and consent approach for the messages Mirembe will send. The current record shape contains no consent metadata; add it only if a defined requirement calls for it.

## Vercel API

The root `api/` directory contains Node.js Vercel Functions with Web `Request`/`Response` handlers for both forms.

`HiringApplicationForm.handleSubmit()` calls `submitHiringApplication()` with the twelve fields below. The client requires all applicant answers; `other_language` is required only with the `other` choice. The existing UI accepts CT or MA, a Yes/No vehicle answer, one experience/travel/availability option, at least one language, a valid email, and a ten-digit US phone number. Server limits add maximum text lengths and reject unknown keys. The API has its own typecheck config.

| Route | JSON body | Limits and normalization |
| --- | --- | --- |
| `POST /api/waitlist` | `email`, `turnstileToken` | 4 KiB request limit; required email, trimmed and lowercased, maximum 254 characters. The server will assign the source. |
| `POST /api/waitlist/zip` | `registration_token`, `zip_code` | 2 KiB request limit; signed, time-limited token; five digits or ZIP+4. Only `zip_code` can be changed. |
| `POST /api/applicants` | `submission_key`, `first_name`, `last_name`, `email`, `phone`, `city`, `state`, `has_vehicle`, `cleaning_experience`, `languages`, `other_language`, `travel_distance`, `preferred_availability`, `turnstileToken` | 12 KiB request limit; per-attempt UUID for safe retries; required fields and strict option values from the form; names up to 80 characters, city up to 100, other language up to 80, ten US phone digits after normalization, at least one unique language, and required other-language text when `other` is selected. |

Applicant option values are `state: CT | MA`, `has_vehicle: boolean`, `cleaning_experience: none | under_1_year | 1_to_3_years | 3_plus_years`, `languages: english | spanish | haitian_creole | portuguese | other`, `travel_distance: under_5_miles | 10_miles | 20_miles | over_25_miles`, and `preferred_availability: full_time | part_time | both`. Text fields are trimmed, email is lowercased, and `other_language` becomes `null` unless `other` is selected.

All routes require `Content-Type: application/json`, reject unknown fields and malformed JSON, and return `{ "ok": false, "error": { "code": "...", "message": "...", "fields": ["..."] } }` for invalid data. Responses use `400` for invalid requests and failed Turnstile validation, `405` for other methods, `413` for oversized bodies, `503` for missing or unavailable persistence or verification, and `500` for unexpected failures. Waitlist and applicant submissions return `201` only after an insert; duplicate waitlist emails receive `200`. ZIP updates return `200` only after the row update succeeds. The privileged Supabase client is created only in `server/database.ts` with session persistence, token refresh, and URL session detection disabled. Turnstile verification lives in `server/turnstile.ts`; production also checks the widget action and Mirembe hostname.

To exercise Vercel routing locally, run the command under **Run locally**, then send a request without a token to `http://localhost:3000/api/waitlist`. It must return `400` without creating a row. Use the browser widget and local test keys for successful test submissions; remove synthetic registrations after testing.

```sh
curl -i -X POST http://localhost:3000/api/waitlist -H 'Content-Type: application/json' -d '{"email":"mirembe-local-test@example.com"}'
```

## Before production deployment

Turnstile is enforced server-side for both public submissions. A durable, shared rate limit is still recommended at the Cloudflare edge for `POST /api/waitlist` and `POST /api/applicants`; do not use an in-memory limit in Vercel Functions because instances do not share state. Review traffic and set a threshold before adding rules. No Cloudflare rate-limit rules are created by this change.

`vercel.json` adds `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `X-Frame-Options`. Vercel already serves HSTS on the production domain, so this change leaves its stronger existing setting intact. A CSP needs a separate report-only rollout that explicitly permits `https://challenges.cloudflare.com` for Turnstile script and frame resources; a restrictive enforced CSP has not been added. New waitlist registrations receive `201` and a ZIP token while duplicates receive `200`, so the response can reveal whether an email was registered; a verified-email flow is needed if strict non-enumeration is required. Confirm RLS is still enabled and anonymous/authenticated table privileges remain revoked on both tables in the target Supabase project. Configure the server-only Supabase and Turnstile variables in Vercel, publish a matching privacy policy, and define applicant access, retention, and hiring review practices before launch. No deployment is performed by this local integration work.

## Transactional email outbox

The migration [`supabase/migrations/20261012234349_add_transactional_email_outbox.sql`](supabase/migrations/20261012234349_add_transactional_email_outbox.sql) creates a service-role-only outbox. Insert triggers on the two existing submission tables add two jobs per **new** `landing_page` row in the same database transaction: a visitor confirmation and an internal notification. A waitlist uniqueness conflict creates no row or jobs. Hiring continues to allow a new application with the same email; each actual application ID gets its own two jobs. A retry of one hiring attempt reuses its UUID and returns the original application ID without creating jobs. Editing an answer starts a new attempt. The outbox copies only the contact fields needed for the notices. The existing Turnstile checks, user-facing responses, and form design remain in place.

After a successful insert, Vercel `waitUntil` starts processing the two jobs for that row without holding the visitor's response. The authenticated `GET /api/email-worker` cron processes up to 50 due jobs daily at 09:00 UTC as a recovery path, with a 45-second loop budget and 60-second function limit. On Vercel Hobby, a cron may run anywhere in the scheduled hour and cannot run more than once per day; a failed immediate run can therefore delay delivery until the next day. Each job is claimed with `FOR UPDATE SKIP LOCKED` and a two-minute lease. Temporary failures become eligible after 2, 4, 8, and 16 minutes, but the daily recovery run may retry them later; all retries stop after five claims. Permanent provider errors stop immediately. The outbox records a safe error code and Resend message ID, without logging recipient or applicant details.

Resend receives the stable outbox key as its idempotency key. Its duplicate suppression lasts 24 hours, so a send that succeeds while its database completion update fails can still be duplicated if the job is retried after that window. The lease and key reduce this risk but cannot guarantee exactly once delivery across two systems. Review `failed` rows manually; do not blindly reset them to `pending` without checking the Resend message history.

The customer templates use React Email's renderer and simple table markup with inline styles, a text wordmark, and plain-text alternatives. The website's logo SVG embeds a large PNG, so it is unsuitable for email. Both customer messages link to `mailto:hello@mirembecleaning.com`; no Reply-To header is set. The landing page currently states January 2027, priority booking, and $50 off the first recurring clean, matching the approved waitlist email.

### Required manual setup before deployment

1. Review and apply the outbox migration in the production Supabase SQL Editor **before** deploying this code. Confirm the prior applicant-fields migration is already applied. The migration targets the existing `public.waitlist_subscribers` and `public.cleaning_applicants` tables; it does not backfill older rows.
2. In Vercel Production, keep the existing `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_CAREERS_EMAIL`. Add `MIREMBE_NOTIFICATION_EMAIL=mirembecleaning@gmail.com` and a random `CRON_SECRET` of at least 16 characters. All five are server-only; do not prefix them with `VITE_`. Confirm `SUPABASE_SECRET_KEY` has service-role access to the new outbox table and RPC functions.
3. After deployment, confirm the Vercel cron appears for `/api/email-worker` and the project plan supports the desired recovery cadence. The daily schedule works on Hobby; a more frequent schedule requires Pro or another authorized scheduler.
4. When authorized to run controlled production tests, use approved test addresses to submit one new waitlist entry and one new hiring application. Check that each creates two outbox rows, both visitor messages and both internal notifications reach their intended inboxes, Resend IDs are stored, and the existing success screens still appear. Repeat the waitlist address and confirm no additional jobs. Preview both templates at narrow mobile width and in the email clients used by the business.
