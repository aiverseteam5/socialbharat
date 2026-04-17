# Phase 4 (Billing & Payments) — Independent Code Review

Branch reviewed: `develop` (commits: `8921f5d`, `281e81e`) vs `main`.
Reviewer: Claude (independent audit, no prior context on the build).
Date: 2026-04-17.

## Summary

- Total files reviewed: 17 (source+tests), plus `pnpm-lock.yaml`
- New API routes: 6 (`/api/billing/plans`, `/subscription`, `/checkout`, `/invoices`, `/webhook/razorpay`, `/webhook/stripe`)
- New DB migrations: **0** — all billing tables (`plan_limits`, `invoices`, `webhook_events`, billing columns on `organizations`) were already created in [supabase/migrations/00001_initial_schema.sql](supabase/migrations/00001_initial_schema.sql). Phase 4 added no schema changes.
- New tests: 3 files, 30 assertions (`gst.test.ts` 11, `plan-limits.test.ts` 12, `billing-webhook.test.ts` 7)
- New dependencies: none (pnpm-lock changes are unrelated `protobufjs` bump in PR #6)

## Gate Results

| Check         | Status                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type-check    | **FAIL** — 4 errors in [tests/lib/plan-limits.test.ts](tests/lib/plan-limits.test.ts) lines 265, 272, 279, 286 (`TS2367: comparison '3'/'1'/'30'/'10' vs '-1' has no overlap`)                                                                                                                                                                                              |
| test:coverage | 134 tests, 14 files pass. Reported 94.54% — but coverage scope in [vitest.config.ts:20-23](vitest.config.ts#L20-L23) only measures `src/lib/logger.ts` and `src/lib/webhooks/**`; **none of the new Phase 4 files (`gst.ts`, `razorpay.ts`, `invoice.ts`, `plan-limits.ts`) are in the coverage include list**. The headline coverage number is meaningless for this phase. |
| lint          | PASS (pre-existing `<img>` warning in `media/page.tsx` only)                                                                                                                                                                                                                                                                                                                |
| build         | PASS                                                                                                                                                                                                                                                                                                                                                                        |

---

## Critical Issues (blockers — must fix before merge)

### C1. Webhook handlers use the anon-key client instead of the service client — writes silently fail due to RLS

[src/app/api/billing/webhook/razorpay/route.ts:1](src/app/api/billing/webhook/razorpay/route.ts#L1) and [src/app/api/billing/webhook/stripe/route.ts:1](src/app/api/billing/webhook/stripe/route.ts#L1) import `createClient` from `@/lib/supabase/server`. That client is cookie-scoped and uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` ([src/lib/supabase/server.ts:9](src/lib/supabase/server.ts#L9)). Webhook calls from Razorpay/Stripe carry no user cookie, so every write runs as `anon`. The consequences:

- `webhook_events` has RLS enabled with **no policy** ([supabase/migrations/00001_initial_schema.sql:584](supabase/migrations/00001_initial_schema.sql#L584)) → INSERT/SELECT both blocked. Idempotency record never written; duplicate webhook deliveries will re-process every time.
- `organizations` UPDATE policy requires `get_user_role(id) IN ('owner','admin')` ([supabase/migrations/00001_initial_schema.sql:435-436](supabase/migrations/00001_initial_schema.sql#L435-L436)) → plan upgrade fails.
- `invoices` has only a SELECT policy, no INSERT policy ([supabase/migrations/00001_initial_schema.sql:532-534](supabase/migrations/00001_initial_schema.sql#L532-L534)) → invoice generation fails.
- `notifications` has only SELECT/UPDATE policies → payment-failed notification fails.
- The catch block at [src/app/api/billing/webhook/razorpay/route.ts:93-96](src/app/api/billing/webhook/razorpay/route.ts#L93-L96) returns 200 regardless, so the failure is never surfaced.

Established pattern (Phase 2/3): [src/lib/scheduler.ts:1,16](src/lib/scheduler.ts#L1) and [src/lib/inbox/message-processor.ts:1,50,179](src/lib/inbox/message-processor.ts#L1) both use `createServiceClient()` for background jobs / webhooks. Phase 4 diverged from this pattern.

**Net effect: a user who pays through Razorpay will never be upgraded, will never see an invoice, and their plan stays on `free`. This is the highest-priority bug.**

### C2. Price-unit mismatch between DB and payment/display layers

Seed data in [supabase/migrations/00001_initial_schema.sql:276-281](supabase/migrations/00001_initial_schema.sql#L276-L281) stores `price_monthly_inr`/`price_yearly_inr` as **rupees** (e.g. Starter = 499, Pro = 1499).

- [src/app/api/billing/checkout/route.ts:58-84,102](src/app/api/billing/checkout/route.ts#L58-L84) passes `baseAmount = plan.price_monthly_inr` (rupees) through `calculateGST(...)` (which treats the integer as paise — [src/lib/gst.ts:11-18](src/lib/gst.ts#L11-L18)) and then to `createOrder({ amount })`. Razorpay's `amount` field is in paise → customer is charged **₹4.99** instead of ₹499, and **₹14.99** instead of ₹1499.
- [src/components/common/IndianCurrencyDisplay.tsx:13-14](src/components/common/IndianCurrencyDisplay.tsx#L13-L14) divides by 100 before rendering. [src/app/(marketing)/pricing/page.tsx:124](<src/app/(marketing)/pricing/page.tsx#L124>) passes the raw rupee value → the pricing page advertises ₹4.99/month instead of ₹499/month.

Either the seed must change to paise (49900 / 149900) with downstream code staying as-is, or the code must convert rupees→paise. This is a financial-correctness blocker.

### C3. Razorpay webhook event-ID extraction is wrong for non-payment events

[src/app/api/billing/webhook/razorpay/route.ts:37](src/app/api/billing/webhook/razorpay/route.ts#L37):

```ts
const eventId = event.payload?.payment?.entity?.id || event.id;
```

For `subscription.activated` / `subscription.charged` / `subscription.cancelled`, `event.payload.payment` is undefined and Razorpay does not send a top-level `event.id` field on webhook envelopes — so `eventId` becomes `undefined`. The subsequent `.eq('event_id', undefined)` and `.insert({ event_id: undefined, ... })` will either collide (treating all subscription events as the same key) or break the NOT NULL / UNIQUE constraints on `webhook_events(provider,event_id)`. Combined with C1, this is latent but still a blocker.

### C4. Idempotency record is written BEFORE processing — failures become unrecoverable

Razorpay route [lines 56-63](src/app/api/billing/webhook/razorpay/route.ts#L56-L63) and Stripe route [lines 59-66](src/app/api/billing/webhook/stripe/route.ts#L59-L66) insert into `webhook_events` before the handler runs. If `handlePaymentCaptured` (or any handler) throws, the row is still present; the Razorpay retry is then short-circuited by the idempotency check at [lines 50-53](src/app/api/billing/webhook/razorpay/route.ts#L50-L53) / [lines 53-56](src/app/api/billing/webhook/stripe/route.ts#L53-L56) and the event is lost. The record should be written only on successful completion (or the processing should run inside a transaction that updates `processed_at` on success).

### C5. Catch-all always returns 200 — silent webhook failures

[src/app/api/billing/webhook/razorpay/route.ts:93-96](src/app/api/billing/webhook/razorpay/route.ts#L93-L96) and [src/app/api/billing/webhook/stripe/route.ts:92-95](src/app/api/billing/webhook/stripe/route.ts#L92-L95) swallow every error and respond `{ success: true }`. Razorpay/Stripe retries are defeated, observability is zero. In combination with C1/C4 there is no recovery path.

### C6. GST is computed at checkout but discarded at invoice time

Razorpay webhook [lines 127-137](src/app/api/billing/webhook/razorpay/route.ts#L127-L137) and Stripe [lines 130-140, 212-219](src/app/api/billing/webhook/stripe/route.ts#L130-L140) build a hard-coded `gstBreakdown` with `cgst: 0, sgst: 0, igst: 0` and pass that to `generateInvoice`. The CGST/SGST/IGST columns on every issued invoice will be zero regardless of the customer's state. This breaks the GST-compliance requirement in [CLAUDE.md](CLAUDE.md) ("All invoices must show GSTIN, HSN/SAC code, CGST/SGST or IGST breakdown").

### C7. DELETE /api/billing/subscription is an admitted stub

[src/app/api/billing/subscription/route.ts:170-179](src/app/api/billing/subscription/route.ts#L170-L179):

```ts
// Note: This would require Razorpay API integration
// For now, we'll just set the plan to expire at the current period end
```

The Razorpay subscription itself is never cancelled — the user will continue to be auto-charged while the local row says `free`. This is incomplete work that must not ship behind a customer-facing Cancel button.

### C8. Plan-gating utilities are never wired up

`checkPlanLimit`, `canAddSocialProfile`, `canAddUser`, `canCreatePost`, `canSchedulePost` are exported from [src/lib/plan-limits.ts](src/lib/plan-limits.ts) but `grep -r` shows **zero callers** in `src/`. The post-creation route ([src/app/api/posts/route.ts](src/app/api/posts/route.ts)), social-profile connection routes, member-invite routes, etc. all skip the gate. **A free-plan user can bypass every numeric/feature limit by calling the API directly.** CLAUDE.md requires server-side enforcement.

---

## Warnings (should fix, not blockers)

### W1. type-check failing

Four `TS2367` errors in [tests/lib/plan-limits.test.ts](tests/lib/plan-limits.test.ts) at lines 265, 272, 279, 286 because the literal `-1` is being compared to literal `3`/`1`/`30`/`10`. Trivial fix, but this is a hard gate in CLAUDE.md's Definition of Done.

### W2. `@ts-expect-error` suppression

[src/components/billing/RazorpayCheckout.tsx:89](src/components/billing/RazorpayCheckout.tsx#L89) suppresses the type error for the window-injected `Razorpay` global. CLAUDE.md hard rule: "No `@ts-ignore` or `as any` — fix the type error, don't suppress it." Declare the global in a `.d.ts` file.

### W3. `as any` in tests

[tests/lib/plan-limits.test.ts:23,72,111,160,184](tests/lib/plan-limits.test.ts#L23) — 5× `mockSupabase as any`. CLAUDE.md: "Zero `any` types."

### W4. `console.*` throughout production code paths

36 call sites across the billing source files (checkout/invoices/plans/subscription routes, both webhook routes, `razorpay.ts`, `invoice.ts`, billing page, pricing page). The project already has a structured logger at [src/lib/logger.ts](src/lib/logger.ts), which Phase 2/3 server code uses ([src/app/api/cron/publish/route.ts:3](src/app/api/cron/publish/route.ts#L3), [src/app/api/webhooks/meta/route.ts:9](src/app/api/webhooks/meta/route.ts#L9)). Phase 4 ignores it.

### W5. No Zod validation on GET query params

[src/app/api/billing/invoices/route.ts:32-34](src/app/api/billing/invoices/route.ts#L32-L34) uses raw `parseInt(searchParams.get('limit'))`. `parseInt('abc')` is `NaN`; the Supabase `.range(offset, offset + limit - 1)` then gets `NaN` and explodes at runtime. Should validate with Zod.

### W6. No RBAC check on billing actions

Every billing route resolves the user's org via `org_members.select('org_id').limit(1).single()` and allows the action regardless of role. Any member (including `editor` or `viewer`) can:

- trigger checkout and mutate `organizations.gst_number` / `billing_state` ([src/app/api/billing/checkout/route.ts:92-98](src/app/api/billing/checkout/route.ts#L92-L98)),
- change plan ([src/app/api/billing/subscription/route.ts:78-121](src/app/api/billing/subscription/route.ts#L78-L121)),
- cancel subscription ([src/app/api/billing/subscription/route.ts:135-198](src/app/api/billing/subscription/route.ts#L135-L198)).
  Existing Phase-2 routes and RLS policies gate writes on `get_user_role(org_id) IN ('owner','admin')`. Billing should match. (And note: once C1 is fixed, the RLS on `organizations` will block non-admins from updating the row, so today the lack of a check is masked by the broken client — but the moment the client is corrected, the policy will reject these writes silently unless the route explicitly checks role.)

### W7. Invoice number generation is not atomic

[src/lib/invoice.ts:43-64](src/lib/invoice.ts#L43-L64) reads the last `SB-YYYY-NNNN`, increments, and inserts. Two concurrent webhooks in the same year will both compute the same `sequence`, then the second insert will fail on the `UNIQUE(invoice_number)` constraint. Use a Postgres sequence or advisory lock.

### W8. HSN/SAC code 998314 never reaches the invoice

[src/lib/invoice.ts:7](src/lib/invoice.ts#L7) mentions it in a doc comment, but no column stores it and no rendered invoice shows it. CLAUDE.md explicitly requires GSTIN + HSN/SAC + tax breakdown. Today we don't produce PDFs at all (`pdf_url: null` hard-coded at line 101), so this may be fine for MVP but needs a follow-up ticket.

### W9. Checkout + invoice is not transactional

Checkout updates `organizations.gst_number` **before** creating the Razorpay order. If Razorpay rejects the order, the org row already has the new billing details. Similarly, the webhook handlers update `organizations` and write `invoices` as two separate statements. A partial failure leaves inconsistent state. Wrap in an RPC or accept that the org update is advisory.

### W10. Checkout picks the user's first org arbitrarily

Every billing route does `.eq('user_id', user.id).limit(1).single()`. A user in multiple orgs cannot choose. An explicit `orgId` in the request body (validated against membership) is the right shape.

### W11. Test files are mostly smoke tests that verify their own mocks

- [tests/api/billing-webhook.test.ts](tests/api/billing-webhook.test.ts) never imports or invokes the actual POST handler. "Signature verification" tests mock `verifyWebhookSignature` then assert the mock's return value. "Idempotency logic" tests a local `Set` in the test body, not the route. "Event types" tests only check property access on hand-built fixtures. **The route file has zero real test coverage.**
- [tests/lib/plan-limits.test.ts:201-288](tests/lib/plan-limits.test.ts#L201-L288) — the `checkNumericLimit` and helper-function blocks (`canAddSocialProfile`, `canAddUser`, `canCreatePost`, `canSchedulePost`, unlimited-limit case) **do not call the library at all**; they re-implement the logic inline and assert that the re-implementation matches the reviewer's expectation. Deletes would cause zero regressions.
- Only [tests/lib/gst.test.ts](tests/lib/gst.test.ts) is a real test — it exercises `calculateGST` / `paiseToRupees` / `rupeesToPaise` with valid and edge-case inputs.

### W12. Dual "missing org_id" checks

Stripe route has redundant `if (!metadata || !metadata.org_id)` then `const orgId = metadata.org_id; if (!orgId)` ([src/app/api/billing/webhook/stripe/route.ts:103-112, 155-164, 182-191, 234-243](src/app/api/billing/webhook/stripe/route.ts#L103-L112)). The second branch is dead code.

### W13. Secret-leak scan

Ran:

```
grep -rn "rzp_live|rzp_test|sk_live|sk_test|RAZORPAY_KEY_SECRET|STRIPE_SECRET|SERVICE_ROLE" .next/static/ src/ --include="*.tsx" --include="*.ts" --include="*.js" | grep -v "process\.env|\.env|\.example|\.test|\.spec|__test__|__mock__|\.md"
```

Output (after excluding `process.env` references):

```
src/lib/razorpay.ts:6: * RAZORPAY_KEY_SECRET must NEVER appear in any client-side file
```

Only a comment. **No leaked secrets found.**

---

## Observations (suggestions, not required)

- **Positive consistency:** kebab-case routes, PascalCase components, shadcn/ui usage, Zod schemas on body-accepting routes, `await createClient()` + `supabase.auth.getUser()` pattern — all match Phase 1-3 conventions.
- **GST calculator is solid.** [src/lib/gst.ts](src/lib/gst.ts) correctly implements CGST 9% + SGST 9% intra-state / IGST 18% inter-state with paise-integer math, case-insensitive state comparison, and env-configurable company state (`COMPANY_GST_STATE`, default Karnataka). The GST tests are the only meaningful unit tests added in Phase 4.
- **Razorpay webhook signature verification is correct** — HMAC-SHA256 with raw body at [src/lib/razorpay.ts:82-93](src/lib/razorpay.ts#L82-L93) and used at [src/app/api/billing/webhook/razorpay/route.ts:30](src/app/api/billing/webhook/razorpay/route.ts#L30). Stripe likewise delegates to `stripe.webhooks.constructEvent` at [src/app/api/billing/webhook/stripe/route.ts:34](src/app/api/billing/webhook/stripe/route.ts#L34). The verification itself is not the problem — it's what happens after.
- The pricing page "Save X%" label uses a custom `getYearlySavings` that computes `100 - (yearly/12/monthly)*100`. Works out to 20% for all current plans, but it'd be clearer to hard-code the label.
- The Razorpay client-side handler (`handler: async function ()`) never verifies the returned `razorpay_signature` client-side before closing the modal ([src/components/billing/RazorpayCheckout.tsx:69-73](src/components/billing/RazorpayCheckout.tsx#L69-L73)). This is acceptable (webhook is authoritative), but the UX shows "paid" optimistically; consider showing a "confirming…" state until the webhook lands.
- `vitest.config.ts` coverage `include` list should be updated to add the Phase 4 library files so the 80% gate actually means something.
- Coverage threshold was advertised as 80% but the files counted are two unrelated Phase-2 files → effectively no gate.

---

## Verdict

**REQUEST CHANGES.**

This is not a ship-ready Phase 4. The webhook handlers do not function (C1), the price unit is wrong end-to-end (C2), the idempotency/retry semantics are broken (C3, C4, C5), invoices record zero GST (C6), the Cancel button doesn't cancel (C7), plan limits are unenforced (C8), and the test suite does not exercise the webhook routes or the numeric-limit code (W11). The Definition-of-Done gate `pnpm type-check` also fails (W1).

**Minimum fix list before merge:**

1. Switch both webhook routes to `createServiceClient()` and verify inserts into `webhook_events`, `organizations`, `invoices`, `notifications` succeed. (C1)
2. Decide on price units; fix seed data or fix the code so Razorpay receives the correct paise amount and the UI displays correct rupees. (C2)
3. Fix Razorpay `eventId` extraction to cover subscription envelopes. (C3)
4. Move the `webhook_events` insert to after successful processing, or add a `status`/`processed_at` column and gate the idempotency check on it. (C4)
5. Return non-200 on unexpected errors so Razorpay/Stripe retry. (C5)
6. Carry the real `gstBreakdown` through checkout → Razorpay order notes → webhook → invoice (or recompute from `billing_state` in the webhook). (C6)
7. Either implement the Razorpay `subscriptions.cancel` call in DELETE /subscription or hide the Cancel button. (C7)
8. Wire `checkPlanLimit` / `canAdd*` into the existing API routes (posts, social-profiles connect, member-invite, etc.). (C8)
9. Fix the four type-check errors and remove `as any` from the tests. (W1, W3)
10. Replace smoke tests with real route-level tests that POST a signed Razorpay payload and assert DB state. (W11)

Once these land, re-run all four gates and re-review.
