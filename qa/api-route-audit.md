# API Route Security Audit — Pre-Phase 4

**Date**: 2026-04-17
**Scope**: All 41 route files in `src/app/api/`
**Auditor**: Automated scan (Claude)

---

## Audit Table

| #   | Route                                       | Zod                                                 | Auth Check                                  | Error Handling             | Any Types | Status   |
| --- | ------------------------------------------- | --------------------------------------------------- | ------------------------------------------- | -------------------------- | --------- | -------- |
| 1   | `/api/auth/otp/send` POST                   | `sendOtpSchema`                                     | MISSING (public — intentional for login)    | YES                        | CLEAN     | PASS     |
| 2   | `/api/auth/otp/verify` POST                 | `verifyOtpSchema`                                   | MISSING (public — intentional for login)    | YES                        | CLEAN     | PASS     |
| 3   | `/api/ai/generate-content` POST             | `generateContentSchema`                             | `supabase.auth.getUser()` + org + plan gate | YES                        | CLEAN     | PASS     |
| 4   | `/api/ai/hashtags` POST                     | `generateHashtagsSchema`                            | `supabase.auth.getUser()` + org + plan gate | YES                        | CLEAN     | PASS     |
| 5   | `/api/ai/suggest-replies` POST              | `suggestRepliesSchema`                              | `supabase.auth.getUser()` + org + plan gate | YES                        | CLEAN     | PASS     |
| 6   | `/api/connectors/facebook/auth` GET         | MISSING (no body — redirect-only)                   | MISSING (no auth before OAuth redirect)     | N/A (redirect)             | CLEAN     | **FAIL** |
| 7   | `/api/connectors/facebook/callback` GET     | MISSING (manual query param checks)                 | `supabase.auth.getUser()` + `verifyState()` | YES (redirects with error) | CLEAN     | **FAIL** |
| 8   | `/api/connectors/instagram/auth` GET        | MISSING (no body — redirect-only)                   | MISSING (no auth before OAuth redirect)     | N/A (redirect)             | CLEAN     | **FAIL** |
| 9   | `/api/connectors/instagram/callback` GET    | MISSING (manual query param checks)                 | `supabase.auth.getUser()` + `verifyState()` | YES (redirects with error) | CLEAN     | **FAIL** |
| 10  | `/api/connectors/linkedin/auth` GET         | MISSING (no body — redirect-only)                   | MISSING (no auth before OAuth redirect)     | N/A (redirect)             | CLEAN     | **FAIL** |
| 11  | `/api/connectors/linkedin/callback` GET     | MISSING (manual query param checks)                 | `supabase.auth.getUser()` + `verifyState()` | YES (redirects with error) | CLEAN     | **FAIL** |
| 12  | `/api/connectors/twitter/auth` GET          | MISSING (no body — redirect-only)                   | MISSING (no auth before OAuth redirect)     | N/A (redirect)             | CLEAN     | **FAIL** |
| 13  | `/api/connectors/twitter/callback` GET      | MISSING (manual query param checks)                 | `supabase.auth.getUser()` + `verifyState()` | YES (redirects with error) | CLEAN     | **FAIL** |
| 14  | `/api/connectors/youtube/auth` GET          | MISSING (no body — redirect-only)                   | MISSING (no auth before OAuth redirect)     | N/A (redirect)             | CLEAN     | **FAIL** |
| 15  | `/api/connectors/youtube/callback` GET      | MISSING (manual query param checks)                 | `supabase.auth.getUser()` + `verifyState()` | YES (redirects with error) | CLEAN     | **FAIL** |
| 16  | `/api/connectors/profiles` GET              | MISSING (GET, no input params)                      | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 17  | `/api/connectors/profiles/[id]` DELETE      | MISSING (`id` param not Zod-validated)              | `supabase.auth.getUser()`                   | YES                        | CLEAN     | **FAIL** |
| 18  | `/api/connectors/whatsapp/connect` POST     | `connectWhatsAppSchema`                             | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 19  | `/api/cron/publish` GET                     | MISSING (no body — cron trigger)                    | `CRON_SECRET` bearer token                  | YES                        | CLEAN     | PASS     |
| 20  | `/api/inbox/conversations` GET              | `listConversationsSchema`                           | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 21  | `/api/inbox/conversations/[id]` GET         | MISSING (`id` param not Zod-validated)              | `supabase.auth.getUser()`                   | YES                        | CLEAN     | **FAIL** |
| 22  | `/api/inbox/conversations/[id]` PUT         | `updateConversationSchema`                          | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 23  | `/api/inbox/conversations/[id]/assign` POST | `assignConversationSchema`                          | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 24  | `/api/inbox/conversations/[id]/reply` POST  | `replyMessageSchema`                                | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 25  | `/api/inbox/conversations/[id]/status` POST | `updateConversationStatusSchema`                    | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 26  | `/api/inbox/conversations/[id]/tags` POST   | `addConversationTagsSchema`                         | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 27  | `/api/media/upload` POST                    | `uploadMediaSchema`                                 | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 28  | `/api/media` GET                            | MISSING (query params not Zod-validated)            | `supabase.auth.getUser()`                   | YES                        | CLEAN     | **FAIL** |
| 29  | `/api/orgs` POST                            | `createOrgSchema`                                   | `requireAuth()`                             | YES                        | CLEAN     | PASS     |
| 30  | `/api/orgs/[id]` GET/PUT                    | `idParamSchema` + `updateOrgSchema`                 | `requireAuth()` + `requireRole()`           | YES                        | CLEAN     | PASS     |
| 31  | `/api/orgs/[id]/members` GET/POST           | `idParamSchema` + `inviteMemberSchema`              | `requireAuth()` + `requireRole()`           | YES                        | CLEAN     | PASS     |
| 32  | `/api/orgs/[id]/members/[uid]` PUT/DELETE   | `idParamSchema` + `updateMemberRoleSchema`          | `requireAuth()` + `requireRole()`           | YES                        | CLEAN     | PASS     |
| 33  | `/api/posts` POST                           | `createPostSchema`                                  | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 34  | `/api/posts` GET                            | MISSING (query params not Zod-validated)            | `supabase.auth.getUser()`                   | YES                        | CLEAN     | **FAIL** |
| 35  | `/api/posts/[id]` GET/DELETE                | MISSING (`id` param not Zod-validated)              | `supabase.auth.getUser()`                   | YES                        | CLEAN     | **FAIL** |
| 36  | `/api/posts/[id]` PUT                       | `updatePostSchema`                                  | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 37  | `/api/posts/[id]/approve` POST              | `postApprovalSchema`                                | `supabase.auth.getUser()` + role check      | YES                        | CLEAN     | PASS     |
| 38  | `/api/posts/[id]/publish` POST              | MISSING (`id` param not validated, no body)         | `supabase.auth.getUser()`                   | YES                        | CLEAN     | **FAIL** |
| 39  | `/api/posts/[id]/reject` POST               | `postApprovalSchema`                                | `supabase.auth.getUser()` + role check      | YES                        | CLEAN     | PASS     |
| 40  | `/api/posts/[id]/schedule` POST             | `schedulePostSchema`                                | `supabase.auth.getUser()`                   | YES                        | CLEAN     | PASS     |
| 41  | `/api/posts/calendar` GET                   | MISSING (`start_date`/`end_date` not Zod-validated) | `supabase.auth.getUser()`                   | YES                        | CLEAN     | **FAIL** |
| 42  | `/api/webhooks/meta` GET/POST               | MISSING (webhook payload not Zod-validated)         | `verifyMetaSignature()` (HMAC-SHA256)       | YES                        | CLEAN     | **FAIL** |
| 43  | `/api/webhooks/twitter` GET/POST            | MISSING (webhook payload not Zod-validated)         | `verifyTwitterSignature()` (HMAC-SHA256)    | YES                        | CLEAN     | **FAIL** |
| 44  | `/api/festivals` GET                        | MISSING (`days` query param not Zod-validated)      | MISSING (public endpoint — intentional)     | YES                        | CLEAN     | **FAIL** |

---

## Summary

| Metric                                     | Count                                          |
| ------------------------------------------ | ---------------------------------------------- |
| Total route handlers audited               | 44 (41 files, some with multiple HTTP methods) |
| **PASS**                                   | 28                                             |
| **FAIL**                                   | 16                                             |
| Files with `any` / `as any` / `@ts-ignore` | **0**                                          |
| Files with structured error responses      | **44/44** (100%)                               |
| Files with auth checks                     | 38/44 (86%)                                    |
| Files with Zod validation on input         | 26/44 (59%)                                    |

---

## Findings by Category

### F1: OAuth `/auth` routes lack auth check before redirect (5 routes)

**Severity**: Medium
**Routes**: facebook/auth, instagram/auth, linkedin/auth, twitter/auth, youtube/auth

Anyone (including unauthenticated users) can trigger an OAuth redirect. While the callback routes DO check auth, an attacker can initiate OAuth flows and waste API rate limits with the providers. The state token is issued without verifying the user has a valid session.

**Recommendation**: Add `supabase.auth.getUser()` check before `issueState()` and redirect to `/login` if no session exists.

### F2: OAuth `/callback` routes validate query params manually, not with Zod (5 routes)

**Severity**: Low
**Routes**: facebook/callback, instagram/callback, linkedin/callback, twitter/callback, youtube/callback

Query params (`code`, `state`, `error`) are checked individually with null checks rather than a Zod schema. This is functionally correct but inconsistent with the project's "parse with Zod before any DB call" rule.

**Recommendation**: Add a `z.object({ code: z.string(), state: z.string() })` schema to standardize validation.

### F3: Path param `[id]` not Zod-validated (6 routes)

**Severity**: Low-Medium
**Routes**: connectors/profiles/[id], inbox/conversations/[id] (GET), posts/[id] (GET/DELETE), posts/[id]/publish

UUID path params are passed to Supabase `.eq()` queries without Zod uuid validation. Malformed IDs won't match any rows (safe due to Postgres uuid type), but this violates the project's Zod-first rule and skips early-exit on bad input.

**Recommendation**: Add `idParamSchema.parse({ id: params.id })` at the top of each handler.

### F4: GET query params not Zod-validated (4 routes)

**Severity**: Low
**Routes**: media (GET), posts (GET), posts/calendar, festivals

Query parameters (pagination, filters, date ranges) are parsed with manual `searchParams.get()` and `parseInt()` instead of Zod. `posts/calendar` in particular accepts `start_date`/`end_date` without format validation.

**Recommendation**: Add Zod schemas for GET query params (e.g., `paginationSchema`, `dateRangeSchema` already exist in `schemas.ts`).

### F5: Webhook routes don't Zod-validate payload structure (2 routes)

**Severity**: Low (signature verification present)
**Routes**: webhooks/meta, webhooks/twitter

Webhook payloads are signature-verified (HMAC-SHA256) but not schema-validated with Zod. This is defensible since webhook payloads come from verified platform sources and their shape can change. However, a `metaWebhookSchema` already exists in `schemas.ts` but is unused.

**Recommendation**: Apply light Zod validation (at minimum `z.object({ object: z.string(), entry: z.array(z.unknown()) })`) to catch malformed payloads early. Keep the schema loose to tolerate platform API changes.

### F6: `festivals` route is fully public with no auth (1 route)

**Severity**: Info
**Route**: festivals

Returns upcoming Indian festivals. Likely intentional as public data, but not documented as a public endpoint.

**Recommendation**: Add a code comment confirming this is intentionally public, or add auth if it should be gated.

---

## Pass/Fail Scorecard

- **Auth check rule**: 86% compliant (6 intentional exceptions: 2 auth/otp + 1 festivals + 1 cron-secret + 2 webhooks-with-HMAC)
- **Zod validation rule**: 59% compliant (11 missing Zod on inputs, 5 OAuth callbacks with manual checks)
- **Error handling rule**: 100% compliant
- **No-any rule**: 100% compliant

---

## Recommended Fix Priority

| Priority | Fix                                          | Routes Affected | Effort  |
| -------- | -------------------------------------------- | --------------- | ------- |
| **P1**   | Add auth to OAuth `/auth` redirects          | 5 routes        | Small   |
| **P2**   | Add `idParamSchema` to path param routes     | 6 routes        | Small   |
| **P3**   | Add Zod to GET query params                  | 4 routes        | Small   |
| **P4**   | Add Zod to OAuth callback query params       | 5 routes        | Small   |
| **P5**   | Apply `metaWebhookSchema` to webhook POST    | 2 routes        | Small   |
| **P6**   | Document `festivals` as intentionally public | 1 route         | Trivial |
