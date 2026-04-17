# Phase 6 Social Listening — QA Review

**Date:** 2026-04-17  
**Reviewer:** Claude Sonnet 4.6 (independent review)  
**Branch:** `phase-6/social-listening` (work is uncommitted — all Phase 6 files are untracked/unstaged)

---

## Files Added / Changed

### New files (untracked)

| File                                                  | Purpose                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `src/app/api/listening/queries/route.ts`              | POST create query / GET list queries                         |
| `src/app/api/listening/queries/[id]/route.ts`         | GET / PUT / DELETE single query                              |
| `src/app/api/listening/queries/[id]/results/route.ts` | GET paginated mentions for a query                           |
| `src/app/api/listening/trends/route.ts`               | GET aggregated time-series, keywords, sentiment distribution |
| `src/app/api/ai/sentiment/route.ts`                   | POST single-text sentiment analysis (OpenAI)                 |
| `src/app/api/cron/crawl-mentions/route.ts`            | Vercel cron handler (CRON_SECRET protected)                  |
| `src/app/(dashboard)/listening/page.tsx`              | Listening dashboard UI                                       |
| `src/app/(dashboard)/listening/queries/[id]/page.tsx` | Query detail / mentions feed UI                              |
| `src/lib/listening/crawler.ts`                        | Twitter + Instagram mention crawl + sentiment enrichment     |
| `src/lib/listening/alerts.ts`                         | Crisis alert thresholds (sentiment spike, volume spike)      |
| `tests/api/sentiment.test.ts`                         | 6 tests for POST /api/ai/sentiment                           |
| `tests/lib/listening/alerts.test.ts`                  | 5 tests for checkQueryAlerts                                 |

### Modified files (unstaged)

| File                              | Change                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| `package.json` / `pnpm-lock.yaml` | Added `openai@^6.34.0`                                        |
| `src/types/schemas.ts`            | Added `createListeningQuerySchema`, `sentimentAnalysisSchema` |
| `src/i18n/en.json` / `hi.json`    | Added `listening.*` translation keys                          |
| `vercel.json`                     | **No change** — `crawl-mentions` cron NOT added (see C-3)     |
| `CLAUDE.md`                       | Minor additions                                               |

---

## Gate Results

| Gate                 | Result   | Notes                                                               |
| -------------------- | -------- | ------------------------------------------------------------------- |
| `pnpm type-check`    | **PASS** | Zero errors                                                         |
| `pnpm test:coverage` | **PASS** | 171 tests / 18 files — 11 new tests added                           |
| `pnpm lint`          | **PASS** | Same pre-existing `<img>` warning in `media/page.tsx` — not Phase 6 |
| `pnpm build`         | **PASS** | All 5 listening API routes + 2 pages + sentiment route compiled     |

> **Note on coverage table:** The coverage report shows only `src/lib/*.ts` (same 4 files as Phase 5 — 97.8% stmt, 86.7% branch). `src/lib/listening/crawler.ts` and `src/lib/listening/alerts.ts` are **absent from the coverage table** — vitest's include path likely covers `src/lib/*.ts` only, not `src/lib/**/*.ts`. The actual coverage of Phase 6 lib files is not being measured.

---

## Step 3 — API Route Audit

| Route                                     | Zod Validation                                 | Auth Check           | Supabase Client                    | Plan Gating                        |
| ----------------------------------------- | ---------------------------------------------- | -------------------- | ---------------------------------- | ---------------------------------- |
| POST `/api/listening/queries`             | YES — `createListeningQuerySchema` ✓           | YES ✓                | `createClient()` ✓                 | YES — `social_listening` checked ✓ |
| GET `/api/listening/queries`              | N/A                                            | YES ✓                | `createClient()` ✓                 | **MISSING**                        |
| GET `/api/listening/queries/[id]`         | YES — `idSchema.parse({id})` ✓                 | YES ✓                | `createClient()` ✓                 | **MISSING**                        |
| PUT `/api/listening/queries/[id]`         | YES — `createListeningQuerySchema.partial()` ✓ | YES ✓                | `createClient()` ✓                 | **MISSING**                        |
| DELETE `/api/listening/queries/[id]`      | YES — `idSchema.parse({id})` ✓                 | YES ✓                | `createClient()` ✓                 | **MISSING**                        |
| GET `/api/listening/queries/[id]/results` | YES — `resultsQuerySchema` + `idSchema` ✓      | YES ✓                | `createClient()` ✓                 | **MISSING**                        |
| GET `/api/listening/trends`               | YES — `trendsQuerySchema` ✓                    | YES ✓                | `createClient()` ✓                 | YES — `social_listening` checked ✓ |
| POST `/api/ai/sentiment`                  | YES — `sentimentAnalysisSchema` ✓              | YES ✓                | `createClient()` ✓                 | NONE (intentional?)                |
| GET `/api/cron/crawl-mentions`            | N/A                                            | Bearer CRON_SECRET ✓ | Delegates to crawler — **see C-1** | N/A                                |

### Cron-specific checks

| Check                                                      | Result                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| Cron handler uses `createServiceClient`?                   | NO — delegates to `crawler.ts` which uses `createClient()` **(CRITICAL)** |
| `alerts.ts` (called from cron) uses `createServiceClient`? | NO — uses `createClient()` **(CRITICAL)**                                 |
| Idempotent?                                                | YES — deduplication via `platform_post_id + platform` set before insert   |
| `crawl-mentions` in `vercel.json`?                         | **NO — MISSING** (CRITICAL — cron will never fire)                        |

---

## Issues Found

### CRITICAL

#### C-1: `crawler.ts` uses `createClient()` instead of `createServiceClient()` — cron will silently fail all DB operations

**File:** [src/lib/listening/crawler.ts:1](src/lib/listening/crawler.ts#L1) and [src/lib/listening/crawler.ts:202](src/lib/listening/crawler.ts#L202)

`createClient()` reads the session from HTTP cookies (Next.js request context). A Vercel cron invocation has no user session — so `createClient()` returns an anon-key client. RLS policies enforce org membership, which means:

- `SELECT * FROM listening_queries WHERE is_active = true` → 0 rows (RLS denies anon)
- `INSERT INTO listening_mentions` → blocked by RLS
- The crawl function returns `{ queried: 0, mentionsSaved: 0, errors: [] }` — silently, no error

The cron appears to succeed (HTTP 200) but does nothing. Keyword monitoring is completely broken at the data layer.

**Fix required:**

```ts
// crawler.ts — replace both createClient() calls:
import { createServiceClient } from "@/lib/supabase/service";
// const supabase = await createClient();   ← remove
const supabase = createServiceClient(); // ← no await, no request context
```

#### C-2: `alerts.ts` uses `createClient()` instead of `createServiceClient()` — alert checks are silently suppressed

**File:** [src/lib/listening/alerts.ts:1](src/lib/listening/alerts.ts#L1), [src/lib/listening/alerts.ts:16](src/lib/listening/alerts.ts#L16), [src/lib/listening/alerts.ts:40](src/lib/listening/alerts.ts#L40)

Same root cause as C-1. `checkAlertThresholds()` is called immediately after `crawlAllActiveQueries()` in the cron. With anon-key access, `SELECT FROM listening_queries` returns empty — `checkAlertThresholds` short-circuits and returns `[]`. No crisis alerts will ever fire.

**Fix required:** Same as C-1 — replace `createClient()` with `createServiceClient()` in `alerts.ts`.

> **Note on test gap:** The tests for `alerts.ts` mock `createClient` and pass a controlled fake client, so they pass despite this bug. The tests do not verify which client factory is imported — they would pass even with the wrong client.

#### C-3: `vercel.json` missing `crawl-mentions` cron schedule — cron will never run

**File:** [vercel.json](vercel.json)

The `crawl-mentions` cron route is built and deployed but absent from `vercel.json`. Vercel only invokes routes listed in the `crons` array. The current config only has `publish` and `collect-metrics`. Keyword monitoring will never execute in production.

**Fix required:**

```json
{
  "path": "/api/cron/crawl-mentions",
  "schedule": "*/15 * * * *"
}
```

(Matches the comment in `crawl-mentions/route.ts:8`: "runs every 15 minutes for pro+ orgs".)

---

### WARNING

#### W-1: Plan gating missing on read/update/delete query routes

**Files:** `queries/route.ts (GET)`, `queries/[id]/route.ts (GET/PUT/DELETE)`, `queries/[id]/results/route.ts (GET)`

`POST /api/listening/queries` and `GET /api/listening/trends` correctly check `social_listening`. But once a query is created, all subsequent operations (reading, updating, deleting, fetching results) bypass the plan check. A user who downgrades from Pro to Free can still:

- Read all their monitoring queries and mention data
- Update query keywords
- Fetch paginated mentions

This may be intentional for data portability, but it must be an explicit design decision — not an omission. If it is intentional, add a comment. If not, add `checkPlanLimit` to the read routes (or at least PUT).

#### W-2: `DELETE /api/listening/queries/[id]` returns `{ success: true }` when no row is matched

**File:** [src/app/api/listening/queries/[id]/route.ts:147-157](src/app/api/listening/queries/%5Bid%5D/route.ts#L147)

The soft-delete does `.update({ is_active: false }).eq("id", queryId).eq("org_id", orgMember.org_id)`. If the row doesn't exist, is already inactive, or belongs to a different org (double-counted), Supabase returns `{ error: null, data: [] }` — no error, zero rows updated. The route then returns `{ success: true }` with HTTP 200, misleading the caller.

**Fix:** Use `.select().single()` after the update to confirm a row was actually modified, or check the returned `data` array length.

#### W-3: `crawler.ts` has zero test coverage

**Missing file:** `tests/lib/listening/crawler.test.ts`

The crawler is the most complex Phase 6 component: it calls two external APIs (Twitter v2, Instagram Graph), deduplicates against existing DB records, runs parallel sentiment analysis, and bulk-inserts. It has no tests at all. CLAUDE.md: _"Write tests alongside new features, never after."_

Required at minimum:

- Deduplication logic (new vs. existing mentions)
- Error isolation (one platform failure doesn't abort the other)
- `crawlAllActiveQueries` iterates all queries and aggregates results

---

### OBSERVATION

#### O-1: English-only stop words in keyword frequency extraction

**File:** [src/app/api/listening/trends/route.ts:126](src/app/api/listening/trends/route.ts#L126)

The `stopWords` set contains English words only. Hindi/Hinglish content (the primary use case for an India-first product) will produce noisy `top_keywords` — common Hindi words like "है", "में", "की", "के", "एक" will appear as trending keywords. Consider adding a Hindi stop-word set or a language-aware stemmer.

#### O-2: No rate limiting on `POST /api/ai/sentiment`

**File:** [src/app/api/ai/sentiment/route.ts](src/app/api/ai/sentiment/route.ts)

Every call makes a live OpenAI API request (`gpt-4o-mini`). There is no per-user or per-org rate limit. A client could call this endpoint in a tight loop and run up OpenAI costs. Consider adding a per-org limit (e.g., 1,000 calls/day) enforced via a counter in `org_limits` or Redis.

#### O-3: Instagram Graph API uses version v18.0

**File:** [src/lib/listening/crawler.ts:153,163](src/lib/listening/crawler.ts#L153)

Meta's current stable version is v21.0+. v18.0 reaches end-of-life according to Meta's 2-year rolling deprecation cycle. Update to `v21.0` before production launch.

#### O-4: Trends endpoint loads all mentions into server memory

**File:** [src/app/api/listening/trends/route.ts:79-84](src/app/api/listening/trends/route.ts#L79)

The trends query fetches up to 90 days of mentions across all active queries for an org with no server-side aggregation or limit. For a Pro org with 5 active queries and moderate volume, this could load tens of thousands of rows into memory for in-process counting. Consider pushing the time-series aggregation into a Postgres query (GROUP BY day, sentiment_label) to avoid the N×row memory footprint.

#### O-5: Test mock gap — `alerts.ts` tests use `createClient` mock, masking C-2

The five alert tests mock `createClient` and pass a controlled fake. They do not assert which Supabase factory is used, so they would pass regardless of whether the code uses `createClient` or `createServiceClient`. This is why C-2 was not caught by the test suite. Tests should assert the correct client factory is imported, or (simpler) test via `createServiceClient` mock.

#### O-6: New `openai` dependency version pin

`package.json` adds `"openai": "^6.34.0"`. This is a major-version bump from the OpenAI SDK v4 used elsewhere in the codebase (if any). Verify no version conflict with other packages that depend on an older openai SDK.

---

## Step 4 — Quick Checks

| Check                                             | Result                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `as any` / `@ts-ignore` in non-test files         | **CLEAN** — none found                                                                                      |
| `console.log` in non-test files                   | **CLEAN** — none found                                                                                      |
| New dependencies                                  | `openai@^6.34.0` — new top-level dep                                                                        |
| Pattern consistency (error handling, client, Zod) | **CONSISTENT** with Phases 1–5 on user-facing routes; **INCONSISTENT** on cron/lib (C-1, C-2)               |
| i18n                                              | **COMPLIANT** — `en.json` and `hi.json` have full `listening.*` key set; UI components use translation keys |
| Secret scan                                       | **CLEAN** — no hardcoded secrets                                                                            |

---

## Verdict

**REQUEST CHANGES**

Three criticals must be resolved before merge:

| #   | Issue                                                                  | Impact                                      |
| --- | ---------------------------------------------------------------------- | ------------------------------------------- |
| C-1 | `crawler.ts` uses `createClient()` — RLS blocks all cron DB operations | Monitoring produces zero data in production |
| C-2 | `alerts.ts` uses `createClient()` — same root cause                    | Crisis alerts never fire                    |
| C-3 | `vercel.json` missing `crawl-mentions` cron entry                      | Cron never executes                         |

C-1 and C-2 are a two-line fix each (swap import). C-3 is a four-line `vercel.json` addition. All three must land together or the feature is fully non-functional in production despite passing all gate checks.

W-3 (no crawler tests) should also be addressed in this PR — it is the only new lib file with no coverage.

---

_Gate summary: type-check ✓ | test ✓ (171/171) | lint ✓ | build ✓_  
_Blocker count: 3 CRITICAL, 3 WARNING, 6 OBSERVATION_
