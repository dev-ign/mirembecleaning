# Repository Agent Instructions

These instructions apply throughout this repository. Read [CLAUDE.md](CLAUDE.md) for architecture, API/security boundaries and conventions, and the relevant [README](README.md) section before changing behavior. Preserve unrelated guidance and existing working changes.

## Risk-Based Testing and Verification Policy

### Choose verification from change impact

Before running checks, identify:

1. The files changed for the current task and their direct consumers. Keep pre-existing working changes separate.
2. Whether runtime behavior, shared contracts, security/privacy/consent, database integrity or external communication can change.
3. Whether imports, routing, prerendering, SEO, generated output, dependencies or deployment are affected.
4. Whether this is ordinary development or a production release candidate.
5. The smallest check set that provides meaningful confidence.

Inspect → implement → verify the affected behavior → expand only for a concrete dependency, failure or risk → summarize. Completing a development task does not automatically require release verification.

### Verification levels

| Level | When to use | Required approach |
|---|---|---|
| **0 — Inspection only** | Markdown, comments, planning reports and non-executable text/typos that cannot affect runtime behavior. | Inspect content, links/paths, command accuracy and instruction consistency. No application tests, lint, typecheck, build, SEO or browser run unless executable examples/tooling or another concrete risk changed. |
| **1 — Focused** | Routine changes confined to a module/component. | Run its relevant tests and directly affected consumers, preferably in one invocation; use targeted lint/type validation where practical. If no relevant test exists, assess whether a small meaningful test is warranted. Do not automatically run the full suite. |
| **2 — Affected subsystem** | Multiple related modules, shared TypeScript contracts, request validation, consent, analytics dispatch, booking journey, permissions/authentication or database access. | Run the affected subsystem's tests together and appropriate lint/type checks. Include security/regression cases at the changed boundary. Add localization, SEO, browser or build checks only when dependencies justify them. |
| **3 — Release** | Production release candidates, substantial cross-cutting changes, significant security-sensitive refactors or build/deployment behavior changes. | Run applicable established release checks: full unit/integration suite, TypeScript, ESLint, isolated production build/SEO, relevant browser/E2E and security regressions. Prefer one final-candidate run instead of repeated release sequences during implementation. |

Explicit user-requested suites, security reviews, browser acceptance, full regressions or release checks must be performed unless unsafe or impossible; explain any blocker. CI, branch protection and deployment-required checks remain mandatory. No repository CI workflow was found when this policy was added; hosted requirements are not thereby proven absent.

### Focused test selection and commands

Tests use **Vitest**: jsdom by default, setup in `src/test/setup.ts`; server suites can select Node with a file annotation. Test locations are `src/test/`, `server/*.test.ts`, `server/email/` and `server/sheets/`. Choose actual affected files; this table is a starting map, not a mandatory bundle.

| Change | Relevant starting points |
|---|---|
| Analytics dispatch/optional loading | `ga4.test.ts`, `analytics.test.ts`, `measurementIntegrity.test.ts`, `optionalEvents.test.ts`; UI suites if interactions changed. |
| Consent/GPC | Relevant analytics/optional-event suites, `analyticsUi.test.tsx`, `ga4Ui.test.tsx`; attribution and booking consumers when affected. |
| Waitlist/attribution/validation | Relevant `waitlistService`, `WaitlistExperience`, `campaignAttribution`, `waitlistAttribution`/config suites and `server/api.test.ts`; include hiring/ZIP consumers if shared validation changes. |
| Booking | Relevant `booking`, `bookingConversions`, `zenmaid`, holiday campaign suites; locale/confirmation consumers if affected. |
| UI | The affected component suite and direct consumers; browser checks when actual browser behavior matters. |
| Localization/routes | Relevant `i18n`, `localeRoutes`, `confirmationLocale` and affected UI suites; SEO only when generated/indexable output can change. |
| Email/Sheets/database boundaries | Relevant API, worker, route, validation and mapping tests under `server/`; safe database-specific checks for schema/grant/RLS changes. |

Use installed tools; do not trigger a package download just to invoke a runner. Examples from the repository root:

```sh
./node_modules/.bin/vitest run src/test/ga4.test.ts src/test/optionalEvents.test.ts
./node_modules/.bin/vitest run src/test/waitlistAttribution.test.ts server/api.test.ts
./node_modules/.bin/eslint src/shared/campaignAttribution.ts server/validation.ts
```

Choose the applicable existing TypeScript project instead of inventing an incomplete per-file compiler setup:

```sh
./node_modules/.bin/tsc -p tsconfig.app.json --noEmit   # frontend/shared browser consumers
npm run typecheck:api                                # api/, server/, scripts/ Node consumers
./node_modules/.bin/tsc -p tsconfig.node.json --noEmit  # Vite/Vitest configuration
```

Shared browser/server contracts can require both app and API typechecks. These examples are available checks, **not a sequence to run for every edit**. The same applies to general command lists in README/CLAUDE guidance.

### Avoid duplicate work

- Batch related tests into one invocation. Do not run a full suite after every file or as a substitute for debugging a focused failure.
- Reuse passing results for unchanged code/dependencies/environment; rerun only when relevant changes, failures, unresolved concerns or required gates justify it.
- Do not routinely run both focused suites and an overlapping full suite. Escalate when the changed scope actually requires it.
- Investigate a failure before broadening scope. Do not repeatedly reproduce an unchanged known environment failure without checking whether its cause changed.
- After final release verification, new edits need focused checks and an explicit judgment about repeating release verification. Never claim the previously tested revision covers new untested changes.
- Do not reinstall available test tooling/browsers or generate more screenshots for an unchanged workflow.

### Browser verification

Use real browser verification when navigation, focus, responsive layout, consent interactions, multi-step forms, storage/cross-tab events, embeds or complex sequencing cannot be meaningfully verified by isolated tests. Do not omit such checks merely to save time. Pure utilities, static configuration, documentation and adequately isolated server validators do not automatically need a browser.

Prefer existing affected scenarios, synthetic data, cached tooling and blocked/mocked external services. Start with the smallest relevant scenario set; expand only for evidence of wider impact. No real production analytics, leads, bookings, email/SMS or payment calls without explicit live-test authorization and a controlled plan.

The existing `scripts/test-measurement-browser.py` is a **broad isolated measurement harness**, not a cheap browser-only check: it generates a production build, runs SEO verification and, by default, the full Vitest suite before its browser scenarios. `--skip-unit-tests` skips only that suite; it still builds and checks SEO. Do not launch it automatically for a small edit or as a shortcut to focused browser verification. Inspect its scope first, reuse suitable isolated scenarios when practical, and report broader work when the existing harness makes it necessary. Optional Python tooling pins are in `scripts/requirements-measurement-browser.txt`; no reinstall by default.

### Builds, SEO and the known generated-artifact mismatch

Build when dependencies, build/deployment configuration, generated output/SEO, material runtime import/export structure or release validation require it, or to investigate a concrete production-build issue. Run SEO checks for relevant routing/prerendering/metadata/canonical/sitemap changes and applicable releases. Do not build after every small function/component change or run SEO for an isolated analytics helper with no output dependency.

**Generation mutates source artifacts:** `npm run dev`, `npm run build` and `npm run seo:generate` invoke a generator that writes tracked HTML, robots, sitemap and Vercel route configuration. Never regenerate production metadata in the main checkout just to turn tests green. Use an isolated source copy when production generation is genuinely required, with safe test environment values and no inherited production credentials.

When release verification needs production metadata, build the isolated candidate first, then run the full suite and SEO checks against that same candidate once. Avoid an extra overlapping full-suite run before or after a harness that already executes it.

The development checkout may contain generated `noindex` HTML while `privacy.test.tsx`, `terms.test.tsx` and `seoBaseline.test.ts` expect production metadata. Prior runs observed three such failures in the original checkout and passes after isolated production generation. This is historical evidence, not permission to assume every future failure has that cause:

- Inspect the actual assertion, generation mode and relevant changes before classifying a failure.
- Do not repeatedly rerun an unchanged mismatch or label it a new production regression without evidence.
- Do not disable/delete tests, weaken assertions, hide failures or update protected source hashes solely to force a pass. A hash update for an authorized source change needs review and explanation.
- Report original-checkout failures separately from isolated production results, identifying what was and was not run now.

Available broader checks, selected only when warranted, are `npm test`, `npm run lint`, `npm run build`, `npm run test:seo` and `npm run test:http`. SEO verification consumes generated `dist/`; HTTP verification requires the intended safe local server (default port 5190). Do not substitute an arbitrary production URL or treat passing local checks as a deployment authorization.

### Non-negotiable safeguards

Efficiency does not reduce required verification for authentication/authorization, Supabase RLS and privileged access, secrets, consent/GPC, attribution privacy, customer information, waitlist persistence/duplicates, booking conversion integrity, payments/billing, email/SMS controls or deployment security. Run the relevant targeted security/regression checks; apply Level 3 for significant security-sensitive or cross-cutting refactors.

Migrations need schema/constraint/grant/RLS validation appropriate to the change in a safe environment. Follow existing database skills and approval boundaries. Mock or isolate external integrations unless live testing is explicitly authorized. Protected worker GET endpoints process jobs; they are not harmless production health checks. Preserve privacy defaults, credential boundaries and existing deployment safeguards. Never bypass CI, branch protection, required checks or explicit user verification instructions.

### Verification summary

Every implementation summary must briefly include:

- **Level and rationale:** selected 0–3 and the affected scope.
- **Executed:** commands/checks, scope and actual passed/failed results; identify the revision/state tested when relevant.
- **Not executed:** full suite/build/SEO/browser or other material checks intentionally omitted and why; group omissions concisely.
- **Known limitations/blockers:** environment failures, missing access and unverified live behavior; distinguish historical evidence from this task's results.

Do not claim skipped or blocked checks passed. For Level 0, state that content/paths/consistency were inspected and application verification was intentionally not run.
