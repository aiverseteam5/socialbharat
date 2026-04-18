# SocialBharat — Fix Plan

**Date:** 2026-04-18
**Author:** QA pass following `qa/ui-audit.md` + `qa/pre-launch-validation.md`
**Scope:** PLAN ONLY — no code changes. Sequenced so each step is independently verifiable.

---

## §0 — White page on localhost (P0, blocks everything)

### Root cause

There is **no `postcss.config.*` file** at the project root. `src/app/globals.css` starts with:

```
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Without a PostCSS config, Next.js serves those directives as literal text. I verified with `curl http://localhost:3000/_next/static/css/app/layout.css` — the response is ~3.4 KB containing four occurrences of the string `@tailwind`. Browsers see an invalid at-rule and drop every declaration → no background, no typography, no sidebar, no brand palette → white page.

### Why the gates didn't catch it

- `pnpm build` compiles routes and TypeScript regardless of whether CSS was processed — a broken Tailwind pipeline still produces a build.
- Playwright E2E checks use DOM selectors, not visual regression — tests pass while the page is visually empty.
- `tsc --noEmit` and ESLint never look at CSS.

### Fix

Create `postcss.config.mjs` in project root:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Both `tailwindcss@3.4.19` and `autoprefixer` are already in `package.json` — no install needed. Restart dev server after creating the file.

### Verification

1. `curl -s http://localhost:3000/_next/static/css/app/layout.css | grep -c '@tailwind'` → must be `0`.
2. The same CSS file should now contain rules like `.bg-brand-500{...}`, `.shadow-card{...}`, generated HSL variables.
3. Load `http://localhost:3000/dashboard` in a browser — dark sidebar, saffron accents, and metric cards must render.
4. Lock it in via Lighthouse CI (see §4) so any future regression fails the build.

---

## §1 — Broken navigation & unwired buttons (P1)

### 1a. Missing pages for linked routes

The sidebar and mobile nav link to three routes that have no `page.tsx`. Today they 404.

| Link source                          | Target                 | Decision                                                                                                                                                                                                                                                               |
| ------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sidebar.tsx:22`, `MobileNav.tsx:11` | `/publishing`          | **Create redirect page** at `src/app/(dashboard)/publishing/page.tsx` that `redirect('/publishing/calendar')`. Cheapest fix; keeps the nav entry meaningful as the "publishing hub".                                                                                   |
| `Sidebar.tsx:27`                     | `/dashboard/ai-studio` | **Remove the link.** AI Studio is not a shipped feature and is not in `specs/plan.md` for Phase 8. Remove the entry from `SIDEBAR_NAV_ITEMS` rather than stubbing a page nobody supports.                                                                              |
| `Sidebar.tsx:28`, `MobileNav.tsx:14` | `/settings`            | **Create index page** at `src/app/(dashboard)/settings/page.tsx` that renders a simple section grid (Team / Billing / Social accounts / Privacy) using the existing Card components. This is a real landing UX, not just a redirect, because users do browse settings. |

### 1b. Unwired buttons — six items

| File:line                          | Button               | Fix                                                                                                                                                                                  |
| ---------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Header.tsx:32-39`                 | Mobile hamburger     | Wire to a `Sheet` from shadcn wrapping the `Sidebar` contents. Toggle with `useState`.                                                                                               |
| `Header.tsx:47-58`                 | Notifications bell   | Either wire to `/inbox` (simplest) or remove until the notifications drawer is built. **Recommendation: remove for launch.** A decorative bell trains users that buttons don't work. |
| `drafts/page.tsx:86-88`            | Edit draft           | Wrap in `<Link href={`/publishing/compose?draftId=${post.id}`}>`. `PostComposer` already accepts a `draftId` query param — no new handler needed.                                    |
| `billing/page.tsx:307-311`         | Invoice PDF download | Change to `<a href={invoice.pdf_url} target="_blank" rel="noopener">`. The `pdf_url` field is already on the invoice row; the button just isn't reading it.                          |
| `social-accounts/page.tsx:143-145` | Setup WhatsApp       | Link to `/whatsapp` (the existing WhatsApp Business console page). That's where the connect-your-WABA flow already lives.                                                            |
| `pricing/page.tsx:250`             | Contact Sales        | `<a href="mailto:sales@socialbharat.in?subject=Enterprise plan enquiry">`. No form needed for MVP.                                                                                   |

### 1c. Pricing → signup plan passthrough

All plan CTAs on `/pricing` go to `/register` with no plan ID attached, so the user lands on signup and then has to pick a plan again on billing. Low effort, high polish.

- Change each plan CTA to `/register?plan=starter|growth|business`.
- In `register/page.tsx`, read the `plan` query param and stash it in a cookie on successful signup.
- After onboarding, `settings/billing` reads that cookie once and pre-selects the plan card.

### 1d. Execution order (2 days)

| Day      | Task                                                           |
| -------- | -------------------------------------------------------------- |
| Day 1 AM | §0 postcss fix; verify visuals                                 |
| Day 1 PM | §1a (3 routes), §1b items 3, 4, 5, 6                           |
| Day 2 AM | §1b mobile hamburger (Sheet wiring), remove notifications bell |
| Day 2 PM | §1c plan passthrough + smoke-test signup → billing flow        |

---

## §2 — Thin i18n coverage (P1)

### Current state

- 4 locales registered in `src/lib/i18n.ts`: en, hi, ta, te. **CLAUDE.md mandates 6** (add bn, mr).
- `getLocale()` at `src/lib/i18n.ts:34-36` is hardcoded to `return "en"`. This is a latent bug: the `LanguageSwitcher` component lets users pick a language but the selection is dropped on the next render. Today only about 6 of 22 pages pay into `t()` — and even those will only ever render English until `getLocale()` is fixed.
- Hardcoded strings on: `login`, `register`, `verify-otp`, `onboarding`, `inbox`, `media`, `whatsapp`, all four `settings/*` pages, `marketing` (home + pricing), `publishing/calendar|compose|drafts`.
- `analytics/page.tsx` hardcodes `const locale = "en"` passed to children, overriding any user preference.

### Fix — four phases

**Phase 2a (half day). Make locale switchable.**

1. Replace `getLocale()` with a real implementation that reads a `locale` cookie (fallback `accept-language` header, fallback `en`). Server components call `cookies().get('locale')`.
2. Add a server action `setLocale(code)` that sets the cookie and calls `revalidatePath('/')`.
3. Wire `LanguageSwitcher.tsx` to call that action instead of silently setting React state.
4. In `src/app/layout.tsx`, change `<html lang="en">` to `<html lang={await getLocale()}>`.
5. Register `bn.json` and `mr.json` locale files (copy `en.json` and mark for translation — ship empty strings rather than missing keys).

Gate: switching language in the header must change at least the dashboard page's visible strings. This alone unlocks value from the keys that already exist.

**Phase 2b (2 days). Extract hardcoded strings — surgical, not total.**

Don't try to i18n everything in one pass. Order by traffic:

1. `login`, `register`, `verify-otp` — first impression, phone-first users need Hindi here.
2. `onboarding` — blocks activation.
3. `settings/billing`, `settings/privacy` — compliance surface (DPDP copy, invoice labels).
4. `marketing` home + `pricing` — SEO/acquisition.
5. `inbox`, `media`, `whatsapp`, `publishing/*` — lower priority, internal power users.
6. `settings/team`, `settings/social-accounts` — last; admin flows.

For each page: grep visible strings, add to `en.json` under a sensible namespace (`auth.login.*`, `settings.billing.*`), replace with `t('...')`, and add the key (English text, marked `[translate]`) to hi/ta/te/bn/mr files so the other locales don't error.

**Phase 2c (half day). Tooling.**

- Add `scripts/check-i18n.ts` — walks all locale JSONs, ensures every key in `en.json` exists in every other locale. Run in CI.
- Add an ESLint rule (`eslint-plugin-i18next` or a lightweight custom rule) that warns on JSX text nodes longer than 2 characters that aren't wrapped in `t()`. Start as warn, upgrade to error once Phase 2b is complete.

**Phase 2d (ongoing).**

- Replace hardcoded `locale = "en"` in `analytics/page.tsx` with `await getLocale()`.
- Numbers and currency: audit every `toLocaleString()` call and pass `locale` explicitly. INR already works with `en-IN`; make sure Hindi shows `en-IN` not `hi-IN` for numbers (Indian users read `1,00,000` regardless of UI language — this is a documented local preference, not a translation issue).

### Verification

- Switch UI to Hindi → dashboard renders in Hindi; no `auth.login.title` literal strings visible.
- `pnpm run check-i18n` exits 0.
- `tsc --noEmit` still exits 0.

---

## §3 — Consistency & smooth page flow (P2)

### 3a. Loading states

Right now: `drafts` uses `<LoadingState>`, `listening` uses `Skeleton`, `whatsapp` uses `Skeleton x3`, `billing` uses `Loader2`, `media` and `social-accounts` use plain text ("Loading media…"). Pick one.

- **Standard:** `<Skeleton>` blocks that match the shape of the final content (card shells for card lists, table rows for tables). Reserve `Loader2` spinners for inline button states (submitting a form, firing a delete).
- Move `LoadingState` / `ErrorState` / `EmptyState` into `src/components/common/` (already partly there) and use them everywhere.
- Replace all plain-text "Loading…" strings.

### 3b. Error states

Several pages only call `logger.error` and render nothing, so users watch a spinner spin forever on a failed fetch. `billing/page.tsx` uses `alert()` which is worse.

- Every `useQuery` / fetch path must render `<ErrorState>` with a retry button on failure.
- Every mutation must surface errors via the existing `<Toaster />` (already in `layout.tsx`), not `alert()` or `confirm()`.
- Delete `alert(…)` and `confirm(…)` usage entirely; replace `confirm` with the existing `AlertDialog` from shadcn/ui.

### 3c. Navigation map

Add `specs/navigation-map.md` (a single table: route → who links to it → what links out from it) and keep it updated. That's the cheapest way to catch future "sidebar links to a deleted route" regressions without new tooling. Pair it with a CI job that runs `next build` and greps build output for `Export encountered errors` — dead links inside `<Link>` surface during static analysis.

### 3d. Root route behaviour

Today `/` always shows the marketing page, even for authenticated users. Cheap polish:

- In `src/app/(marketing)/page.tsx`, check for a session server-side at the top. If present, `redirect('/dashboard')`. Unauth'd users keep seeing the landing page.

### 3e. Fonts

`layout.tsx` uses `className="font-sans antialiased"` (system fonts). For Indic scripts this looks inconsistent across OSes — Windows especially falls back to poorly rendered Devanagari.

- Use `next/font/google` to load `Inter` (Latin) + `Noto Sans Devanagari` (Hindi/Marathi) + `Noto Sans Tamil` + `Noto Sans Telugu` + `Noto Sans Bengali`. Subset per-language in the font loader so we don't ship every script to every user.
- Apply via Tailwind's `fontFamily.sans` (extend with the appropriate Noto family per `html[lang]`).

### 3f. Root route redirect from auth layout

`requireAuth()` is only called in `(dashboard)/layout.tsx`. That means `/login` or `/register` are reachable even for authed users and show a stale form. Add a `redirectIfAuthed()` helper and call it in `(auth)/layout.tsx` — sends authed users back to `/dashboard`.

---

## §4 — Production-ready for Bharat — opinions

These are the ten things I'd insist on before calling this a "perfect prod-ready SaaS portal for India." They're ordered by impact, not effort.

### 4a. Feels-local, not translated-American

1. **Phone-first everywhere.** Login already leads with OTP — good. Extend: signup defaults to phone tab, not email. Store `+91` as the default country code. Validate `^\+91[6-9]\d{9}$` client-side before hitting MSG91.
2. **Vernacular by default, English as toggle.** Geo-IP from Vercel (`x-vercel-ip-country-region`) → guess locale: Delhi/UP/MP/Bihar → Hindi; Tamil Nadu → Tamil; Maharashtra → Marathi; Telangana/AP → Telugu; West Bengal → Bengali; else English. Users can still override. Even a rough guess is a signal that the product knows its audience.
3. **Indian number formatting.** `1,00,000` not `100,000`. This is already correct via `en-IN` locale — just make sure no component is passing `en-US` or none.
4. **Festival calendar surfaces on the dashboard.** `indian_festivals` table already exists. Dashboard should show "Diwali in 12 days — see suggested posts" as a card, not just be available inside the composer. That's the single most India-specific product moment you have.

### 4b. Trust signals that matter in India

5. **WhatsApp as the support channel**, not email. A floating `wa.me/91xxxxx` button on marketing + an in-app link under the user menu. Indian SMB buyers expect WhatsApp-first support and will bounce off "email us at support@".
6. **Made in India + DPDP Act compliance badges** in the footer, linked to a real one-page `/legal/dpdp` explainer. These are not fluff — Indian buyers explicitly filter for them, and DPDP compliance is legally required from 2026.
7. **Data residency disclosure.** The footer or `/legal/data-residency` page should state: "Your data is stored in AWS ap-south-1 (Mumbai)". CLAUDE.md already mandates this; surface it.
8. **GST-compliant invoices visible at purchase time.** Buyers expect to see GSTIN, HSN/SAC 998314, CGST/SGST split **before** they pay — not just on the downloaded PDF. Add the breakdown to the Razorpay checkout screen's "order summary" pane.

### 4c. Quality gates you don't have yet

9. **Lighthouse CI on every PR.** Runs against a deploy preview. Fail build if Perf < 85 or A11y < 95 on mobile. This is the single thing that would've caught the white-page regression.
10. **Playwright visual regression** (`toHaveScreenshot`) on five canonical pages: `/`, `/pricing`, `/login`, `/dashboard`, `/settings/billing`. Tiny overhead, catches CSS regressions immediately.

### 4d. Build-before-launch, not after

- **Preview deploys on every PR** via Vercel. The current `main`-only deployment is why visual regressions survive merge.
- **Sentry release tracking.** Tag releases with the commit SHA in `sentry-cli releases` so error reports link back to diffs.
- **PostHog funnels for the activation path**: `signup → verify OTP → complete onboarding → connect first account → schedule first post`. Measure drop-off; the drop-off cliff tells you where to invest next.

### 4e. Things to delete or defer

- **Delete** the notifications bell until the feature exists. Dead UI costs trust.
- **Delete** the AI Studio sidebar link until the feature exists.
- **Defer** bn/mr full translations to Phase 9 — register the files with empty (English) strings now so the infra is ready; don't block launch on translation QA for languages without a pilot user.

### 4f. One architectural observation

The codebase routes all API traffic through Next.js server handlers, which is fine at this scale. When you hit ~5k orgs, the inbox pages will want Supabase Realtime subscriptions instead of polling. That's already in `specs/plan.md` as Phase 9 — don't bring it forward. Don't prematurely split into microservices either; the monolith is paying off.

---

## Prioritised execution (single source of truth)

| #   | Priority | Item                                                           | Effort | Gate                                                      |
| --- | -------- | -------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| 1   | P0       | §0 postcss.config.mjs                                          | 15 min | `curl` shows no `@tailwind` literals; dashboard renders   |
| 2   | P1       | §1a create /settings, /publishing index, remove /ai-studio     | 1 h    | All sidebar links 200                                     |
| 3   | P1       | §1b wire 6 buttons, delete notifications bell                  | 3 h    | Click test all six                                        |
| 4   | P1       | §1c plan passthrough                                           | 1 h    | Pick plan → lands pre-selected in billing                 |
| 5   | P1       | §2a getLocale + cookie + LanguageSwitcher wiring + bn/mr files | 4 h    | Switching language changes visible copy                   |
| 6   | P1       | §3a standardised LoadingState / Skeleton                       | 2 h    | No `"Loading..."` plain text remains                      |
| 7   | P1       | §3b ErrorState + toast; delete `alert`/`confirm`               | 2 h    | Manual fault-injection shows toast + retry                |
| 8   | P2       | §2b extract strings (auth + onboarding + billing + privacy)    | 2 d    | `check-i18n` passes, Hindi manual walkthrough             |
| 9   | P2       | §3d root redirect for authed users; §3f redirectIfAuthed       | 30 min | Authed `/` → `/dashboard`; authed `/login` → `/dashboard` |
| 10  | P2       | §3e next/font Indic scripts                                    | 2 h    | Hindi renders correctly on Windows                        |
| 11  | P2       | §4a.4 Diwali/festival card on dashboard                        | 4 h    | Visible on /dashboard with next upcoming festival         |
| 12  | P2       | §4b.5 WhatsApp support button                                  | 1 h    | Tap opens wa.me chat                                      |
| 13  | P2       | §4b.6 Made-in-India + DPDP badges + /legal/dpdp page           | 3 h    | Footer shows badges; /legal/dpdp renders                  |
| 14  | P2       | §4b.8 GST breakdown in Razorpay checkout                       | 3 h    | Checkout modal shows CGST/SGST/HSN before pay             |
| 15  | P3       | §4c.9 Lighthouse CI                                            | 2 h    | PR fails when Perf < 85                                   |
| 16  | P3       | §4c.10 Playwright visual regression on 5 pages                 | 2 h    | Baseline screenshots committed; PR diffs surface          |
| 17  | P3       | §3c navigation-map.md                                          | 1 h    | Committed in `specs/`                                     |
| 18  | P4       | §2b extract strings for remaining pages                        | 3 d    | Full coverage                                             |

**Total before launch (P0+P1):** ~2 days.
**Total for "India-polished" (through P2):** ~1 week.
**P3–P4** can follow launch.

---

## Things I am NOT recommending

- **Do not** rewrite to Tailwind v4. v3.4 works, and v4 changes the config API in a way that would churn every theme token. Revisit post-launch.
- **Do not** add a CMS for marketing copy. Two pages (`/`, `/pricing`) don't need one; a CMS adds deploy complexity and another system to secure.
- **Do not** migrate to Redux/Jotai. Zustand is fine at this scale; the spec calls for it.
- **Do not** split into microfrontends or microservices. The monolith fits the team size and the complexity.
- **Do not** add Storybook for the ~30 components we have. Review in-app and via visual regression. Storybook's maintenance cost outweighs the benefit at this scale.
- **Do not** block launch on full bn/mr translations. Ship the infra; backfill translations from real user demand.

---

## Appendix — verification checklist for this plan

Before merging any of the above:

- [ ] `pnpm type-check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0 with ≥80% coverage on changed files
- [ ] `pnpm build` exits 0
- [ ] Manual: `curl http://localhost:3000/_next/static/css/app/layout.css | grep -c '@tailwind'` → 0
- [ ] Manual: click every sidebar and mobile-nav link; all return 200
- [ ] Manual: switch language to Hindi; dashboard + billing render in Hindi
- [ ] Manual: 375px / 768px / 1280px responsive pass on dashboard, inbox, billing, pricing
- [ ] Manual: authed user at `/` redirects to `/dashboard`
- [ ] Manual: Razorpay checkout shows GST breakdown
