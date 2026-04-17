# Phase 5 Analytics & Reporting — QA Review

**Date:** 2026-04-17  
**Reviewer:** Claude Sonnet 4.6 (independent review)  
**Branch:** `phase-5/Analytics` (work is uncommitted — all Phase 5 files are untracked/unstaged)

---

## Files Added / Changed

### New files (untracked)

| File                                                   | Purpose                                                 |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `src/app/api/analytics/overview/route.ts`              | GET overview metrics with period-over-period comparison |
| `src/app/api/analytics/profiles/[id]/metrics/route.ts` | GET time-series metrics for a single profile            |
| `src/app/api/analytics/posts/route.ts`                 | GET paginated post-level metrics                        |
| `src/app/api/analytics/reports/route.ts`               | POST save report / GET list reports                     |
| `src/app/api/analytics/reports/[id]/export/route.ts`   | GET export report as CSV / JSON / HTML                  |
| `src/app/api/cron/collect-metrics/route.ts`            | Vercel cron handler (daily metrics sync)                |
| `src/app/(dashboard)/analytics/reports/page.tsx`       | Reports UI page                                         |
| `src/components/analytics/MetricCard.tsx`              | Metric card component                                   |
| `src/components/analytics/ChartContainer.tsx`          | Chart wrapper component                                 |
| `src/components/analytics/OverviewDashboard.tsx`       | Main analytics dashboard                                |
| `src/components/analytics/ReportBuilder.tsx`           | Report builder UI                                       |
| `src/lib/analytics-range.ts`                           | Date range resolver + previousPeriod helper             |
| `src/lib/metrics-collector.ts`                         | Daily metrics collection logic                          |
| `supabase/migrations/00006_analytics_reports.sql`      | `analytics_reports` table + RLS                         |
| `tests/api/analytics.test.ts`                          | Tests for analytics-range and schemas                   |
| `tests/lib/metrics-collector.test.ts`                  | Tests for metrics-collector                             |

### Modified files (unstaged)

| File                                     | Change                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `src/app/(dashboard)/analytics/page.tsx` | Swapped placeholder for `<OverviewDashboard />`                           |
| `src/types/database.ts`                  | Added analytics-related types                                             |
| `src/types/schemas.ts`                   | Added `saveReportSchema`, `analyticsQuerySchema`, `ANALYTICS_METRIC_KEYS` |
| `vercel.json`                            | Added `collect-metrics` cron at `0 2 * * *` UTC (7:30 AM IST)             |

---

## Gate Results

| Gate                 | Result   | Notes                                                                                                                                    |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm type-check`    | **PASS** | Zero errors                                                                                                                              |
| `pnpm test:coverage` | **PASS** | 160 tests / 16 files, 97.8% stmt, 86.7% branch                                                                                           |
| `pnpm lint`          | **PASS** | One pre-existing `<img>` warning in `media/page.tsx` — not Phase 5                                                                       |
| `pnpm build`         | **PASS** | All 5 analytics API routes + 2 pages compiled. Note: requires `rm -rf .next` first due to Windows symlink issue with stale `.next` cache |

---

## Step 3 — API Route Audit

| Route                                      | Zod Validation                                      | Auth Check           | Supabase Client           | RBAC                                |
| ------------------------------------------ | --------------------------------------------------- | -------------------- | ------------------------- | ----------------------------------- |
| GET `/api/analytics/overview`              | **MISSING** — query params hand-parsed              | YES                  | `createClient()` ✓        | Any org member                      |
| GET `/api/analytics/profiles/[id]/metrics` | **MISSING** — UUID regex + `resolveDateRange()`     | YES                  | `createClient()` ✓        | Any org member (RLS enforces)       |
| GET `/api/analytics/posts`                 | **MISSING** — query params hand-parsed              | YES                  | `createClient()` ✓        | Any org member                      |
| POST `/api/analytics/reports`              | YES — `saveReportSchema.parse(body)` ✓              | YES                  | `createClient()` ✓        | owner/admin/editor (explicit check) |
| GET `/api/analytics/reports`               | N/A (no body; limit clamped)                        | YES                  | `createClient()` ✓        | Any org member                      |
| GET `/api/analytics/reports/[id]/export`   | **PARTIAL** — UUID regex; format validated manually | YES                  | `createClient()` ✓        | Any org member (RLS enforces)       |
| GET `/api/cron/collect-metrics`            | N/A — cron, no user body                            | Bearer CRON_SECRET ✓ | `createServiceClient()` ✓ | Server-only cron                    |

### Cron-specific checks

- **Uses `createServiceClient`?** YES — `metrics-collector.ts:1` imports `createServiceClient`. Cron route itself delegates to the collector.
- **Idempotent?** YES — `profile_metrics` upsert uses `onConflict: "social_profile_id,metric_date"` (`metrics-collector.ts:99`). Re-running overwrites with the same data. Safe.

---

## Issues Found

### CRITICAL

#### C-1: Plan gate missing on `POST /api/analytics/reports` (billing bypass)

**File:** [src/app/api/analytics/reports/route.ts](src/app/api/analytics/reports/route.ts#L34)

`plan_limits.custom_reports` exists in the database and in `plan-limits.ts` (the `Feature` type lists `'custom_reports'`). But `POST /api/analytics/reports` never calls `checkPlanLimit(orgId, 'custom_reports')`. Any Free-plan user with an editor role can create unlimited saved reports, bypassing the billing gate entirely.

**Fix required:**

```ts
// After resolving orgMember, before the profile ownership check:
const allowed = await checkPlanLimit(orgMember.org_id, "custom_reports");
if (!allowed) {
  return NextResponse.json(
    { error: "Custom reports require a Pro plan or higher" },
    { status: 403 },
  );
}
```

---

### WARNING

#### W-1: GET analytics routes bypass Zod query param validation

**Files:** `overview/route.ts`, `posts/route.ts`, `profiles/[id]/metrics/route.ts`

CLAUDE.md states: _"Every API route: parse body/params with Zod schema before any DB call."_ The `analyticsQuerySchema` was added to `schemas.ts` specifically for this purpose but is not used in any GET route. Instead, routes call `resolveDateRange()` directly (which has its own regex guard) and use raw `parseInt()` for pagination params.

This is inconsistent with project patterns and leaves validation untestable at the route level. `analyticsQuerySchema` should be parsed from `searchParams` before calling `resolveDateRange`.

#### W-2: All analytics UI components lack i18n support

**Files:** `src/components/analytics/*.tsx`, `src/app/(dashboard)/analytics/reports/page.tsx`

CLAUDE.md: _"All user-facing text must support i18n (use translation keys, not hardcoded strings)."_ Every string in the analytics components is hardcoded in English — "Followers", "Impressions", "Build a report", "Report name", "Save report", "Preview", etc. No `useTranslation` hook is used anywhere in Phase 5.

This is a systemic omission across all new components.

#### W-3: `CRON_SECRET` missing from CLAUDE.md environment variable list

**File:** `CLAUDE.md` (env vars section), used in `src/app/api/cron/collect-metrics/route.ts:11`

`CRON_SECRET` is documented in `.env.example` (line 79) and used by both cron routes. It is not listed in the CLAUDE.md required env var table. A new developer following CLAUDE.md alone would not know to provision it, causing the cron to return 500 on every run.

---

### OBSERVATION

#### O-1: `as unknown as T` casts for Supabase join types

**Files:** `overview/route.ts:174`, `posts/route.ts:83`

```ts
const topPosts = (postMetricsRows ?? []) as unknown as PostMetricsRow[];
```

This is a known Supabase TypeScript limitation when using `!inner` joins — the inferred type doesn't match the local interface. The double cast through `unknown` is the standard workaround and does not violate the `no as any` rule. Acceptable, but worth a comment explaining why.

#### O-2: `resolveDateRange` uses UTC "today" — potential IST off-by-one

**File:** [src/lib/analytics-range.ts:20](src/lib/analytics-range.ts#L20)

`new Date().toISOString().slice(0, 10)` gives today in UTC. Between midnight and 05:30 IST, this returns "yesterday" from an Indian user's perspective. The default 30-day window's end date will be one day behind. The cron is scheduled at 02:00 UTC (07:30 IST) to collect yesterday's data, so the metrics pipeline itself is fine. The impact is purely cosmetic (the overview's default date range endpoint shows UTC date). Low severity but worth noting for IST-first product.

#### O-3: Analytics page bundle size is 117 kB

**Route:** `/analytics` — 117 kB first load JS (vs ~4–8 kB for other dashboard pages)

This is significantly larger than any other page in the build. The `OverviewDashboard` likely imports a charting library eagerly. Consider `next/dynamic` with `ssr: false` for chart components to reduce initial load.

#### O-4: Export route relies solely on RLS for org boundary enforcement

**File:** [src/app/api/analytics/reports/[id]/export/route.ts:63](src/app/api/analytics/reports/%5Bid%5D/export/route.ts#L63)

The export route fetches the report by ID and then fetches metrics for its stored `profile_ids` without re-validating that those profiles still belong to the user's org. If RLS is correct (which it is — `analytics_reports_select` uses `get_user_org_ids()`), this is safe. But unlike `POST /api/analytics/reports` which has explicit defense-in-depth profile ownership verification, export has none. If the RLS function ever regresses, a user could export another org's report. Low probability, but no defense-in-depth.

#### O-5: No new dependencies added

Confirmed via `git diff main -- package.json` (no diff). Phase 5 is built entirely on existing dependencies.

#### O-6: Idempotency confirmed by test

`tests/lib/metrics-collector.test.ts` verifies upsert behavior and error isolation. The test confirms that a platform API error on one profile does not fail the entire run — it is counted as `failed` and processing continues. Good resilience pattern.

---

## Step 7 — Secret Scan

```
grep -rn "sk_live|sk_test|rzp_live|SERVICE_ROLE" src/ --include="*.ts" --include="*.tsx" | grep -v "process.env|.env|.example|.test.|.spec.|.md"
```

**Result: CLEAN** — No hardcoded secrets found.

---

## Verdict

**REQUEST CHANGES**

One critical issue must be resolved before merge:

- **C-1** (billing bypass): `POST /api/analytics/reports` must call `checkPlanLimit(orgId, 'custom_reports')` and return 403 for Free-plan orgs. The infrastructure (plan-limits helper, DB column) already exists — the call was simply omitted.

Two warnings should be addressed in this PR or tracked as immediate follow-up:

- **W-1**: Apply `analyticsQuerySchema.parse()` to GET route query params for consistency with project patterns.
- **W-2**: Add i18n translation keys to all Phase 5 UI strings (consistent with rest of codebase).

All other items (O-1 through O-6) are low-severity observations that can be addressed in subsequent iterations.

---

_Gate summary: type-check ✓ | test ✓ (160/160, 97.8% coverage) | lint ✓ | build ✓_  
_Blocker count: 1 CRITICAL, 2 WARNING, 6 OBSERVATION_
