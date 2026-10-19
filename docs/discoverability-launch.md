# Discoverability and measurement launch guide

Updated 19 October 2026. This describes this branch, which has not been deployed.

## Audit and implementation

The live apex domain redirects with HTTP 308 to `https://www.mirembecleaning.com/`. The live `www` response is a 660-byte React shell with a title and description, but no H1, canonical, or JSON-LD. Its robots and sitemap URLs returned 404 during the audit. The repo already had two accessible forms, Turnstile, API validation, Supabase persistence, Resend outbox delivery, Google Sheets synchronization, and security headers; their submission paths were preserved.

`src/config/business.ts` records the confirmed public email `hello@mirembecleaning.com`, verified profile category, two exact service-area entries, six service names with their source, social profiles, and the prelaunch status. `src/config/seo.ts` provides homepage metadata and an `Organization` plus `WebSite` JSON-LD graph with stable IDs. The `Organization` includes the verified email. `Organization.areaServed` uses `City` objects for Boston, Massachusetts, and Newington, Connecticut. This does not claim statewide or surrounding-city coverage. The 24/7 profile listing and October 2026 opening month are recorded as profile claims, not appointment availability, and neither appears as opening-hours schema. No phone, street address, reviews, ratings, or prices are invented.

We retain `Organization` rather than `LocalBusiness`: Google's LocalBusiness rich-result format requires a physical `address`, and this service-area business has no public storefront address to publish. `HouseCleaning` is not an established Schema.org type. The six profile service names are recorded in the typed configuration, but no individual `Service` or offer markup is emitted from this prelaunch splash page while those details are not visible in its approved copy. A future service page can display the verified offerings and add matching `Service` markup without implying current booking. Valid schema does not guarantee a rich result. [Google LocalBusiness requirements](https://developers.google.com/search/docs/appearance/structured-data/local-business), [Schema.org Service](https://schema.org/Service), [Google structured data guidance](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

The production build runs `scripts/generate-seo.ts` in production mode to write `index.html`, `public/robots.txt`, and `public/sitemap.xml` from the same configuration; local development uses development mode so the initial HTML and client bundle read the same public environment settings. `publicRoutes` is the one sitemap route list. The script renders the actual homepage component into the HTML, including its H1, summary, waitlist form, and founder note. A stylesheet link in the document head lets these elements render with their final styles before JavaScript starts. React hydrates the same markup, keeping the DOM and entrance animation in place. This fixes the previous partial static shell being cleared and replaced during startup. The 1672 × 941 PNG remains the social image; the visually identical lossless WebP serves the hero. The header and Organization logo URL use the 448-pixel PNG exported from the original raster-wrapped SVG; the favicon uses a separate 64-pixel PNG. A lighter, approved branded 1200 × 630 share card remains a later asset task. [Reproduction and measurements](asset-optimization.md).

The canonical is `https://www.mirembecleaning.com/` because that is the live destination. The brief preferred the apex conditionally. If the business chooses apex, switch Vercel's domain redirect, then update `websiteUrl` and rebuild. Vercel says preview and outdated deployments automatically receive `x-robots-tag: noindex`; verify it on a real preview URL. [Vercel headers](https://vercel.com/docs/headers/response-headers), [domain redirects](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting).

The page and confirmation email no longer claim a January 2027 launch because the brief reports conflicting profile dates. The existing priority booking and $50 recurring-clean offer remain. Reintroduce a date only after confirmation across the website, emails, and profile.

## Google Business Profile alignment

The site now says **Mirembe Cleaning Company**, family-owned residential cleaning, prelaunch waitlist, and the two profile areas: Boston, MA, and Newington, CT. The title uses CT/MA as regional shorthand; the description and schema name only the verified entries. The Google Business Profile URL, exact Instagram URL, and exact Facebook URL are in `sameAs`. The profile details in this section were supplied by the business owner; the profile itself was not independently readable during the initial audit. The category is **House cleaning service**. Services are performed at customer locations; no public storefront address is represented.

The Google service list names standard cleaning, deep cleaning, moving-related cleaning, and office and workplace cleaning. Its business description additionally mentions recurring home cleaning and rental turnover cleaning. The profile shows an October 2026 opening month and 24/7 hours. Neither establishes that appointments can be booked now or that cleaning staff work around the clock. The website continues to collect waitlist registrations.

Owner follow-up:

1. Confirm whether booking is accepted and what the 24/7 listing means for actual appointment availability. Reconcile the profile's October 2026 opening month with the current waitlist state.
2. Confirm a business-controlled phone; the public contact email is confirmed as `hello@mirembecleaning.com`.
3. Review the Boston and Newington profile entries as coverage changes. Do not infer other locations; keep any private address hidden. [Google service-area guidance](https://support.google.com/business/answer/9157481).
4. Confirm actual service availability, scope, and offer terms before adding detailed service pages or `Service` schema.
5. Add authentic branded, team, and cleaning-result photos where rights permit. Check name, category, site URL, description, hours, and service areas together. [Google profile editing](https://support.google.com/business/answer/3039617).

## Keyword research and future content

| Intent | Working cluster | Publication rule |
| --- | --- | --- |
| Primary commercial | residential cleaning, house cleaning services, home cleaning services | Homepage supports this topic and waitlist intent. |
| Secondary commercial | professional house cleaners, local cleaning company | Use naturally in useful future copy. |
| Service-specific | standard, deep, moving-related, recurring home, rental turnover, office/workplace cleaning | Profile names are verified; publish dedicated pages after scope and availability are confirmed. |
| Local commercial | house cleaning in *verified city*, cleaners near *verified area* | Add only after coverage and useful local details are confirmed. |
| Informational | cleaning frequency, how to prepare, what a visit includes | Publish only with accurate team guidance. |

No search volume or competitiveness estimate is claimed. Validate demand, geographic relevance, and lead quality through Search Console, Bing, and future campaign data. Avoid mass-generated city pages. Potential later routes are `/services`, `/about`, `/contact`, `/faq`, and `/service-areas`, with unique content and route-specific metadata. Add only real canonical pages to `publicRoutes`. A CMS can wait until content operations justify it.

## Tracking specification

The provider-neutral `trackEvent` API accepts fixed names and an optional conversion ID used only in the browser for deduplication. It never sends IDs or form contact fields to providers. With IDs configured and consent allowed, GA4 receives page views and the events below. Meta receives `PageView` and one `Lead` for a newly created customer waitlist row only. Blocked tags cannot block form submission.

| Event | Trigger | GA4 | Meta |
| --- | --- | --- | --- |
| `page_view` | Tracking allowed on page load | Yes | `PageView` |
| `waitlist_form_start` | First email focus | Yes | No |
| `waitlist_form_submit` | Valid, verified request begins | Yes | No |
| `waitlist_signup_success` | Server creates a new waitlist row | Yes | `Lead` |
| `waitlist_signup_error` | Request rejects or fails | Yes | No |
| `hiring_cta_click` | Hiring dialog trigger clicked | Yes | No |
| `hiring_form_start` | First answer edit | Yes | No |
| `hiring_form_submit` | Valid, verified request begins | Yes | No |
| `hiring_application_success` | Server creates a new application, excluding a replay | Yes | No |
| `hiring_application_error` | Request rejects or fails | Yes | No |

Duplicate waitlist emails return no new ID, so they do not fire success. The hiring API marks an idempotent retry `replayed: true`; the UI excludes it from new conversion counts. A session set suppresses repeated success sends for the same ID. Backend reconciliation is still needed for financial-grade reporting.

After consent, the browser accepts capped, validated `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term`. It keeps first and last touches in session storage and sends them with GA4 events. Page location excludes unrelated query parameters. It does not collect click IDs or write attribution into Supabase or Sheets. A later additive migration could attach campaign data to new records after retention and consent requirements are defined.

Optional tags remain disabled without a real HTTPS `VITE_PRIVACY_POLICY_URL` and valid provider ID. Visitors can decline or allow, reopen **Tracking preferences**, and withdraw; withdrawal reloads without optional scripts. The site honors the browser's Global Privacy Control signal, and adding or changing a provider ID asks for consent again. The policy should disclose GA4, Meta Pixel, local/session storage, purpose, retention, and contact details after business/legal review. Turnstile is separate essential form protection. This is a technical consent gate, not a legal compliance determination.

## External account setup after deployment

1. **Google Search Console:** Create a Domain property for `mirembecleaning.com` (enter the domain without a protocol), copy Google's issued TXT record into Cloudflare DNS, wait for DNS to resolve, and click **Verify**. Inspect `https://www.mirembecleaning.com/`, run **Test live URL**, and request indexing if it is available. In **Sitemaps**, submit `https://www.mirembecleaning.com/sitemap.xml`; check the fetch result and Page Indexing report later. Confirm Google sees the `www` canonical and the apex redirect. Submission does not guarantee indexing. [Property verification](https://support.google.com/webmasters/answer/34592), [Sitemaps](https://support.google.com/webmasters/answer/7451001), [URL Inspection](https://support.google.com/webmasters/answer/9012289).
2. **Bing Webmaster Tools:** Add the `www` site or import the verified Google property; complete ownership checks, submit the same sitemap, and review URL Inspection and queries. [Add and verify](https://www2.bing.com/webmasters/help/add-and-verify-site-12184f8b), [Sitemaps](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed).
3. **GA4:** Create a property and Web data stream for the canonical domain; copy its `G-...` Measurement ID. Publish and review a real HTTPS privacy policy first. Set that URL as `VITE_PRIVACY_POLICY_URL` and the ID as `VITE_GA4_MEASUREMENT_ID` in Vercel Production, then redeploy because Vite embeds these at build time. After allowing tracking in a clean browser, verify `page_view` and one controlled new `waitlist_signup_success` in Realtime/DebugView. Mark signup success as the primary key event; keep hiring separate. The app rejects malformed IDs and placeholder policy URLs. [GA4 setup](https://support.google.com/analytics/answer/14183469).
4. **Google Ads:** Link the correct GA4 property, enable auto-tagging, and import `waitlist_signup_success` as the single primary customer conversion. Keep any direct Ads conversion secondary or absent to avoid duplicate bidding conversions. Test before campaigns. Optimize for qualified signup cost and geographic relevance, not clicks. [GA4 import](https://support.google.com/google-ads/answer/10632359).
5. **Meta:** In the business's Events Manager, create or select its website data source and obtain the numeric Pixel ID. Set `VITE_META_PIXEL_ID` only after policy and consent review. Deploy and verify one `PageView` and `Lead` for a new customer email; duplicate emails and hiring submissions must not send `Lead`. Avoid overlapping Event Setup Tool events. Add Conversions API later only with event-ID deduplication.
6. **Google Business Profile:** Resolve status/hours, add the verified phone and precise service areas, check the website link, and upload authentic photos. Hide a private address when customers are not served there. [Service areas](https://support.google.com/business/answer/9157481), [hours](https://support.google.com/business/answer/15300403).

## Database migration decision

**No new production database migration is required for the current SEO, analytics, rendering, and asset optimization release.** The three checked-in migrations add applicant fields, the transactional email outbox, and the Sheets outbox; none was created or modified for this release. The current submission store still writes the same waitlist and applicant fields, and the existing workers still call the same outbox functions. The only new campaign attribution is held in browser `sessionStorage` and sent with optional analytics events, not with Supabase inserts or Sheets rows. The business owner reports that both submissions, Turnstile, Resend, and Sheets already work in production.

This checkout is not linked to a Supabase CLI project and has no remote database password, so migration history and exact production schema were not independently inspected. If a different target database is selected for deployment, inspect its migration history and expected objects read-only before release; do not apply the historical SQL just because files are present. The relevant migration versions are `20261012020254`, `20261012234349`, and `20261013190831`. The expected objects include `cleaning_applicants.submission_key`, `email_outbox`, `sheets_sync_outbox`, and the existing `claim_*_jobs` and `complete_*_job` RPC functions. This verification concerns environment alignment, not a new migration dependency introduced by this release.

## Exact Vercel handoff steps — not executed

This checkout already has a `.vercel` project link. Before any deployment, confirm it points to the intended project and that its Production environment has the existing server-only Supabase, Turnstile, Resend, cron, and Google Sheets values. This release adds no database schema change or new required environment variable. The owner has verified the existing production integrations; check historical migrations read-only only if the deployment target differs or its schema is uncertain. Do not copy production secrets into browser-prefixed `VITE_` variables.

1. In the project directory, run `npm ci`, `npm run lint`, `npm test`, and `npm run build`. Review `dist/index.html`, `dist/robots.txt`, and `dist/sitemap.xml`.
2. Check Vercel Project Settings → Domains: `www.mirembecleaning.com` must be the production destination and the apex should redirect to it. Check Production environment variable names and values in the Vercel dashboard without disclosing secrets.
3. After release approval, run `vercel deploy` from the linked directory for a preview. Inspect the preview's page, forms, security headers, and logs; confirm its preview response is not indexable. Test submissions only with approved disposable addresses and existing test procedures.
4. After preview approval, run `vercel deploy --prod`. This assigns the Production domain when Vercel's normal auto-assignment is enabled. Verify the apex redirect and the three `www` URLs below, plus the final HTML title, description, canonical, H1, and JSON-LD. [Vercel CLI deployment guide](https://vercel.com/docs/projects/deploy-from-cli).

```text
https://www.mirembecleaning.com/
https://www.mirembecleaning.com/robots.txt
https://www.mirembecleaning.com/sitemap.xml
```

5. Confirm one new waitlist registration and one hiring application reach their existing database, email, and Sheets paths. Use a duplicate waitlist email and an idempotent hiring retry to confirm conversion deduplication. Keep optional marketing IDs unset until the policy and provider accounts are ready.

## Verification and release order

Local checks on this branch: `npm run build` (including application/API TypeScript), `npm run lint`, and `npm test` pass. Tests cover the generated search files, consent and event deduplication, existing forms, Turnstile, API validation, persistence behavior, Resend, and Sheets logic. A Vite production preview returned HTTP 200 for `/`, `/robots.txt`, and `/sitemap.xml` with HTML, plain text, and XML types. The generated HTML contains the complete homepage, prelaunch description, canonical `www` URL, verified email in JSON-LD, H1, two-city `areaServed`, three `sameAs` URLs, and no address or hours. The earlier JSON-LD snippet returned **0 errors and 0 warnings** in the [Schema Markup Validator](https://validator.schema.org/); the updated email and PNG logo URL have not been resubmitted there. Desktop, tablet, and mobile views were reviewed in the production preview. Mobile had no horizontal overflow; its founder note and hiring dialog opened. The preview showed no browser warnings or errors. An instrumented reload found the initial form in server-rendered HTML and did not detect removal of the initial page shell during hydration. With provider prerequisites absent, the preview loaded no GA4 or Meta scripts and showed no optional consent prompt. The new build has not been tested on deployed Vercel or with real provider IDs.

Release order: confirm the 24/7 hours, booking status, and policy; deploy code without marketing IDs; inspect live HTTP, canonical, robots, sitemap, schema, mobile layout, and both form flows; then configure optional analytics after policy review; use controlled new/duplicate leads to compare browser events with Supabase, Sheets, and Resend outcomes; connect Search Console, Bing, Google Ads, and Meta.

Asset review: `public/hero.png` is 1,801,315 bytes. The page serves a 1,198,222-byte lossless `public/hero.webp` (33.5% smaller), and a decoded pixel comparison found zero differences. The PNG remains the social image. The former 1,156,033-byte raster-wrapped logo SVG is retained as a source asset outside the production output; `public/icon.png` is 108,364 bytes (90.6% smaller) for the header and structured-data logo URL, while `public/favicon.png` is 7,189 bytes. Controlled local browser observations found the description paragraph was desktop LCP and the hero image was mobile LCP in both builds; no reliable LCP or CLS improvement can be inferred from loopback samples. Field metrics still need checking after release. See [asset methods and measurements](asset-optimization.md).

| Priority | Work | Dependency | Effort |
| --- | --- | --- | --- |
| 1 | Confirm booking status, 24/7 meaning, and policy | Business owner | Low to medium |
| 2 | Deploy and verify crawlability, forms, mobile, domain, and headers | Production access | Medium |
| 3 | Connect Search Console and Bing; watch branded/local queries | Verified domain | Low |
| 4 | Enable consented GA4 and validate new-lead counts; then Ads import | Reviewed policy and ID | Medium |
| 5 | Enable Meta only if campaigns are planned | Reviewed policy and Pixel ID | Low |
| 6 | Monitor field LCP/CLS and the optimized images after deployment | Production traffic | Low |
| 7 | Build useful service/location pages; consider durable attribution | Confirmed scope and coverage | High |
