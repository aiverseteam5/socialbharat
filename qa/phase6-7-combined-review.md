# Phase 6+7 Combined Review — Social Listening & UI Polish

**Date:** 2026-04-18  
**Reviewer:** Claude Sonnet 4.6 (independent review)  
**Baseline:** tag `v0.4.0` (end of Phase 5)  
**HEAD:** `0b5ae4e` (phase7/ui — merged to main)  
**Scope:** 72 files changed, 8,796 insertions, 275 deletions

---

## Step 1 — Files Changed Since v0.4.0

### Phase 6 — Social Listening (new API routes, lib, tests)

| File                                                  | Type                                                    |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `src/app/api/listening/queries/route.ts`              | POST create / GET list                                  |
| `src/app/api/listening/queries/[id]/route.ts`         | GET / PUT / DELETE                                      |
| `src/app/api/listening/queries/[id]/results/route.ts` | GET paginated mentions                                  |
| `src/app/api/listening/trends/route.ts`               | GET aggregated trends                                   |
| `src/app/api/ai/sentiment/route.ts`                   | POST sentiment analysis                                 |
| `src/app/api/cron/crawl-mentions/route.ts`            | Vercel cron handler                                     |
| `src/lib/listening/crawler.ts`                        | Twitter + Instagram crawl                               |
| `src/lib/listening/alerts.ts`                         | Crisis alert thresholds                                 |
| `tests/api/sentiment.test.ts` (6 tests)               | Sentiment route                                         |
| `tests/lib/listening/alerts.test.ts` (5 tests)        | Alert logic                                             |
| `tests/lib/listening/crawler.test.ts` (10 tests)      | Crawler logic                                           |
| `supabase/migrations/00001_initial_schema.sql`        | `listening_queries` + `listening_mentions` tables + RLS |
| `vercel.json`                                         | Added `crawl-mentions` cron at `*/15 * * * *`           |
| `package.json`                                        | Added `openai@^6.34.0`                                  |

### Phase 7 — UI Polish, i18n, Error States (new pages, components, e2e)

| File                                                   | Type                         |
| ------------------------------------------------------ | ---------------------------- |
| `src/app/error.tsx`                                    | Global error boundary        |
| `src/app/not-found.tsx`                                | 404 page                     |
| `src/app/(dashboard)/*/loading.tsx` (×8)               | Suspense skeletons           |
| `src/components/common/EmptyState.tsx`                 | Reusable empty state         |
| `src/components/common/ErrorState.tsx`                 | Reusable error card          |
| `src/components/common/LoadingState.tsx`               | Skeleton grid                |
| `src/components/common/LanguageSwitcher.tsx`           | Locale picker                |
| `src/components/layout/Header.tsx`                     | Polished + language switcher |
| `src/components/layout/Sidebar.tsx`                    | Polished dark sidebar        |
| `src/components/layout/MobileNav.tsx`                  | Bottom tab bar               |
| `src/app/(dashboard)/listening/page.tsx`               | Full listening UI (i18n)     |
| `src/app/(dashboard)/listening/queries/[id]/page.tsx`  | Query detail UI              |
| `src/app/(dashboard)/dashboard/page.tsx`               | Dashboard welcome            |
| `src/app/(dashboard)/publishing/compose/page.tsx`      | Dynamic imports              |
| `src/app/(dashboard)/publishing/drafts/page.tsx`       | Dynamic imports              |
| `src/components/analytics/*.tsx` (×4)                  | Analytics components (i18n)  |
| `src/i18n/en.json` / `hi.json` / `ta.json` / `te.json` | 270 keys each                |
| `src/lib/i18n.ts`                                      | Updated locale helpers       |
| `tailwind.config.ts`                                   | Brand colour tokens          |
| `e2e/*.spec.ts` (×4)                                   | Playwright E2E tests         |

---

## Step 2 — Gate Results

| Gate                 | Result   | Detail                                                                                       |
| -------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `pnpm type-check`    | **PASS** | Zero errors                                                                                  |
| `pnpm test:coverage` | **PASS** | 181 tests / 19 files, all passing                                                            |
| `pnpm lint`          | **PASS** | Pre-existing `<img>` warning in `media/page.tsx` only                                        |
| `pnpm build`         | **PASS** | All routes compiled; analytics page 1.55 kB (was 117 kB — Phase 7 dynamic imports fixed O-3) |

> **Coverage caveat:** Table shows only `src/lib/*.ts` (97.8% stmt, 86.7% branch). `src/lib/listening/crawler.ts` and `src/lib/listening/alerts.ts` are not in the coverage report — vitest `include` path covers `src/lib/*.ts` but not `src/lib/**/*.ts`. See O-1.

---

## Step 3 — CLAUDE.md Rule Check

### Phase 6 blockers resolved from previous review ✓

| Prior issue                             | Status                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| C-1: `crawler.ts` used `createClient()` | **FIXED** — `createServiceClient()` confirmed at lines 227, 316 |
| C-2: `alerts.ts` used `createClient()`  | **FIXED** — `createServiceClient()` confirmed at lines 16, 40   |
| C-3: `vercel.json` missing cron entry   | **FIXED** — `*/15 * * * *` entry present                        |
| W-1: Plan gating on read routes         | **FIXED** — `checkPlanLimit` on all 5 listening routes          |
| W-2: DELETE returned success on no-op   | **FIXED** — `.select("id")` + `updated.length === 0` → 404      |
| W-3: No crawler tests                   | **FIXED** — 10 tests in `crawler.test.ts`                       |

---

### CRITICAL

#### C-1: `listening_queries` missing UPDATE RLS policy — PUT and soft-DELETE always fail for all users

**File:** `supabase/migrations/00001_initial_schema.sql:544-549`

The migration enables RLS on `listening_queries` and defines only two policies:

```sql
CREATE POLICY listening_queries_select ... FOR SELECT ...
CREATE POLICY listening_queries_insert ... FOR INSERT ...
```

There is **no `FOR UPDATE` policy**. In PostgreSQL, when RLS is enabled and no UPDATE policy exists, all UPDATE operations from non-superuser roles are denied.

Both `PUT /api/listening/queries/[id]` and `DELETE /api/listening/queries/[id]` (soft-delete via `UPDATE is_active = false`) use `createClient()` with a user JWT. RLS denies these UPDATEs. Supabase returns `{ data: [], error: null }` — no SQL error, but zero rows affected. The DELETE handler correctly interprets this as a 404 (`"Query not found"`). The PUT handler returns a 404 too.

**Impact:** Query editing and deactivation are silently broken for every user in production. Both routes return 404 despite the query existing.

**Fix required** (add to migration or a new migration file):

```sql
CREATE POLICY listening_queries_update ON listening_queries FOR UPDATE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin')
  );
```

---

### WARNING

#### W-1: Hardcoded English strings in Phase 7 layout, error, and page components

**Rule:** CLAUDE.md — _"All user-facing text must support i18n (use translation keys, not hardcoded strings)."_

The Phase 7 i18n work is strong for analytics and listening pages, but several core components ship with hardcoded English:

| File                                     | Line    | Hardcoded string                                                                        |
| ---------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `src/app/error.tsx`                      | 30      | `"Something went wrong"`                                                                |
| `src/app/error.tsx`                      | 32      | `"An unexpected error occurred. Our team has been notified."`                           |
| `src/app/error.tsx`                      | 35      | `"Try Again"`                                                                           |
| `src/app/not-found.tsx`                  | 12      | `"Page not found"`                                                                      |
| `src/app/not-found.tsx`                  | 14      | `"The page you're looking for doesn't exist or has been moved."`                        |
| `src/app/not-found.tsx`                  | 18      | `"Back to Dashboard"`                                                                   |
| `src/components/common/ErrorState.tsx`   | 11      | default `"Something went wrong. Please try again."`                                     |
| `src/components/common/ErrorState.tsx`   | 19      | `"Unable to load content"`                                                              |
| `src/components/common/ErrorState.tsx`   | 23      | `"Try Again"`                                                                           |
| `src/components/layout/Sidebar.tsx`      | 19-28   | All 9 nav item names                                                                    |
| `src/components/layout/MobileNav.tsx`    | 9-13    | All 5 tab labels                                                                        |
| `src/components/layout/Header.tsx`       | 94, 100 | `"Settings"`, `"Sign out"`                                                              |
| `src/app/(dashboard)/dashboard/page.tsx` | ~24-42  | `"Compose"`, `"Connect"`, `"Analytics"` card titles + descriptions + `"View Analytics"` |

> **Note on `error.tsx`:** Next.js error boundaries (`error.tsx`) render before context providers mount, which means `useTranslation` hooks are unavailable. This is a legitimate technical constraint — the strings here may need to be duplicated per locale or left in English with a comment. The other files have no such constraint.

#### W-2: `listening_mentions` has no INSERT or UPDATE RLS policy

**File:** `supabase/migrations/00001_initial_schema.sql:551-555`

`listening_mentions` has only a SELECT policy. INSERT works today because `crawler.ts` uses `createServiceClient()` which bypasses RLS. However, this is a silent dependency on the service role — if any future code path tries to insert a mention from a user-context client, it will be silently blocked. The table pattern is also inconsistent with every other table in the schema (which have explicit INSERT policies). Recommend adding:

```sql
-- Service-role-only inserts (only the cron writes mentions)
-- No user INSERT policy needed, but document the intent:
COMMENT ON TABLE listening_mentions IS 'Written exclusively by the crawl-mentions cron via service role. No user INSERT policy is intentional.';
```

Or add a proper INSERT policy restricted to the service role if Supabase supports it.

---

### OBSERVATION

#### O-1: `src/lib/listening/` excluded from coverage report

The vitest coverage config collects only `src/lib/*.ts`, not `src/lib/**/*.ts`. `crawler.ts` and `alerts.ts` have tests that pass (10 + 5), but their actual line/branch coverage numbers aren't in the table. Update `vitest.config.ts` to `include: ['src/lib/**/*.ts']` for accurate reporting.

#### O-2: Phase 7 dynamic imports dramatically improved bundle sizes

`/analytics` page: 117 kB → 1.55 kB. `publishing/compose`: heavy components now lazy-loaded with `next/dynamic`. This is a good Phase 7 win worth tracking.

#### O-3: `error.tsx` uses duck-typed Sentry integration

`src/app/error.tsx:15-21` accesses `window.Sentry` via a manual type cast. This is fragile — if the Sentry script loads asynchronously, `"Sentry" in window` may be false at render time. Prefer the official `@sentry/nextjs` package which integrates with Next.js error boundaries directly.

#### O-4: `listening_queries` RLS INSERT policy restricts to owner/admin only

`listening_queries_insert` uses `get_user_role(org_id) IN ('owner', 'admin')`. The API route also restricts creation to owner/admin (explicit check). This is consistent. However, the RLS for `listening_mentions_select` joins through `listening_queries` which adds a subquery per row — may need a GIN index on `listening_queries.org_id` for large mention sets.

#### O-5: `src/i18n/ta.json` and `te.json` added with full 270-key coverage

All four locale files (en, hi, ta, te) have identical key counts with no missing translations. Key parity: 100%. Good work.

#### O-6: E2E tests added but no Playwright config visible in diff

`e2e/*.spec.ts` (×4) added in Phase 7. No `playwright.config.ts` change visible in the diff against v0.4.0 — this may mean config was added earlier or tests run against the existing setup. Not blocking, but worth confirming CI runs the E2E suite.

---

## Step 4 — Security Quick Scan

| Check                                    | Result                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `createClient()` in `src/lib/listening/` | **CLEAN** — both files use `createServiceClient()`                                           |
| `console.log/error/warn` in source       | **CLEAN** — zero hits                                                                        |
| `: any` / `as any` in source             | **CLEAN** — zero hits                                                                        |
| `@ts-ignore` / `@ts-expect-error`        | **CLEAN** — zero hits                                                                        |
| `TODO` / `FIXME` / `HACK`                | **CLEAN** — zero hits                                                                        |
| Hardcoded secrets                        | **CLEAN** — zero hits                                                                        |
| Raw SQL strings                          | **CLEAN** — one `supabase.rpc("next_invoice_number")` which is a typed RPC call, not raw SQL |

---

## Step 5 — i18n Coverage Summary

| Locale    | Keys | Parity with EN |
| --------- | ---- | -------------- |
| `en.json` | 270  | baseline       |
| `hi.json` | 270  | ✓ 0 missing    |
| `ta.json` | 270  | ✓ 0 missing    |
| `te.json` | 270  | ✓ 0 missing    |

**Schema parity: 100%** — No missing keys across all four locales.

**Components using `t()` / `getLocale()` correctly:**  
Analytics components, listening pages, dashboard page (partially), publishing pages.

**Components with hardcoded strings (W-1 above):**  
`error.tsx` (legitimate constraint), `not-found.tsx`, `ErrorState.tsx`, `Sidebar.tsx`, `MobileNav.tsx`, `Header.tsx`, `dashboard/page.tsx` (partial — some strings use `t()`, others don't).

---

## Violations Table

| File                                           | Line       | Issue                                                                                 | Severity     |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- | ------------ |
| `supabase/migrations/00001_initial_schema.sql` | 544-549    | No UPDATE policy on `listening_queries` — PUT and DELETE always return 404            | **CRITICAL** |
| `src/app/error.tsx`                            | 30, 32, 35 | Hardcoded English (legitimate constraint — renders before providers)                  | WARNING\*    |
| `src/app/not-found.tsx`                        | 12, 14, 18 | Hardcoded English — no `t()`                                                          | WARNING      |
| `src/components/common/ErrorState.tsx`         | 11, 19, 23 | Hardcoded English — no `t()`                                                          | WARNING      |
| `src/components/layout/Sidebar.tsx`            | 19-28      | 9 nav labels hardcoded English — no `t()`                                             | WARNING      |
| `src/components/layout/MobileNav.tsx`          | 9-13       | 5 tab labels hardcoded English — no `t()`                                             | WARNING      |
| `src/components/layout/Header.tsx`             | 94, 100    | "Settings", "Sign out" hardcoded English                                              | WARNING      |
| `src/app/(dashboard)/dashboard/page.tsx`       | ~24-42     | Card titles + descriptions + CTA hardcoded English (mixed with `t()` calls)           | WARNING      |
| `supabase/migrations/00001_initial_schema.sql` | 551-555    | `listening_mentions` INSERT not governed by explicit RLS policy — intent undocumented | WARNING      |

\*`error.tsx`: The Next.js error boundary renders before any React context provider (including i18n), so `useTranslation` cannot be used here. Strings may remain English or a separate locale-agnostic fallback is acceptable — but must be documented.

---

## Verdict

**REQUEST CHANGES**

**One critical blocks merge:**

**C-1** — The missing UPDATE RLS policy on `listening_queries` silently breaks both `PUT /api/listening/queries/[id]` and `DELETE /api/listening/queries/[id]` for all users. The feature appears to work (all tests pass, build succeeds) but fails in production because RLS denies the UPDATE. The fix is a four-line migration addition. All existing tests mock the Supabase client, so this class of RLS policy gap requires manual verification against a live DB.

**Recommended path to APPROVE:**

1. Add UPDATE policy for `listening_queries` (fix can be a new migration file or inline addition)
2. Address W-1 i18n strings in `not-found.tsx`, `ErrorState.tsx`, `Sidebar.tsx`, `MobileNav.tsx`, `Header.tsx`, `dashboard/page.tsx` — document `error.tsx` exception
3. Optionally: add a comment or policy on `listening_mentions` INSERT intent (W-2)

---

_Gate summary: type-check ✓ | test ✓ (181/181) | lint ✓ | build ✓ (analytics bundle -98%)_  
_Blocker count: 1 CRITICAL, 2 WARNING (systemic i18n + RLS), 6 OBSERVATION_
