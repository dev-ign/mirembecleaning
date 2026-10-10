# Mirembe Cleaning waitlist

React, TypeScript, Vite, and Tailwind landing page with a three-stage desktop waitlist flow.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run lint`, `npm run test`, and `npm run build` to check code quality, waitlist behavior, and the production bundle.

## Waitlist flow

`src/services/waitlistService.ts` is an asynchronous in-memory mock. `createWaitlistEntry()` returns a typed record with a UUID, normalized email, `zip_code: null`, `source: 'landing_page'`, and an ISO timestamp. Once that call succeeds, the visitor is on the list. The optional ZIP form calls `updateWaitlistZip()` with the returned record ID and updates only that record's ZIP. The original email, source, and timestamp remain intact.

The mock keeps records only for the current page session. Refreshing the page clears them. `failNextWaitlistOperation('create' | 'update')` supports testing either error path. No email or ZIP is sent to a server yet, so this mock is **not a production signup system**.

On desktop, a successful ZIP update replaces the optional form with the compact confirmation from the Figma saved state. The form fades out before the confirmation enters; the main email success content stays mounted. Reduced-motion users see the confirmation immediately. A small **Edit ZIP** action reopens the form with the saved value, and **Cancel** returns to the confirmation without another update. Focus moves to the confirmation when the form is removed.

## Cleaning team applications

The hiring link opens a native modal dialog with a fixed header and Submit Application footer. Only the question area scrolls. Draft answers remain in React state when the dialog closes and reopens; a successful submission keeps its confirmation on reopen, preventing an accidental second application in the same session. Experience, travel distance, availability, and vehicle access use single-select radios. Languages use independent checkboxes, with a detail field when Other is selected. The phone field stores ten US digits (including normalized pasted `+1` numbers); email remains editable while typing and is validated on blur and submit.

`src/types/hiring.ts` defines the separate hiring data contract and option values. `src/services/hiringApplicationService.ts` validates and normalizes the data, then returns an asynchronous in-memory record with a UUID, source, and timestamp. The form holds its submitting state until that call resolves; after acceptance, it fades out and the same dialog resizes to the compact Figma confirmation. A failed call preserves all answers for retry. `failNextHiringApplication()` exercises the retry path. This mock clears on refresh and **does not collect real applications**. Replace it with a real, confirmed backend response before a public hiring launch so the confirmation never implies that an unpersisted application was received.

## Privacy and launch copy

The form describes launch and booking updates; the optional ZIP prompt explains its use for prioritizing availability. Set `VITE_PRIVACY_POLICY_URL` to a published privacy-policy URL to show the form link. Until it is set, no policy link is rendered. Before deployment, publish a policy that matches the actual data handling and outreach, configure the URL, and review the final waitlist wording and consent approach for the messages Mirembe will send. The current record shape contains no consent metadata; add it only if a defined requirement calls for it.

## Future Supabase integration

Replace the two exported service operations with calls to a secured server endpoint or Supabase Edge Function while keeping the UI contract in `src/types/waitlist.ts`. The server should validate input, generate IDs and timestamps, enforce a normalized-email uniqueness policy and rate limits, and authorize ZIP updates. Do not expose a service-role key or unrestricted table updates in the browser.

The hiring service should separately move behind a secured endpoint with server-side validation, spam protection, rate limits, restricted applicant access, and a retention policy. Keep applicant data separate from the customer waitlist and never expose privileged Supabase credentials in the browser.
# mirembecleaning
