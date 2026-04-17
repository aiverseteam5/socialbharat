# Phase 4 — Final Verdict

Re-evaluation after `qa/phase4-fixes-applied.md`. All blockers from
`qa/phase4-independent-review.md` re-verified against the code as it
exists today.

## 8 Critical blockers

| #   | Blocker                                       | Status       | Evidence                                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Webhooks must use service-role client         | **RESOLVED** | `grep createClient\|createBrowserClient src/app/api/billing/webhook/` → no matches. Both `razorpay/route.ts:2` and `stripe/route.ts:3` import `createServiceClient` from `@/lib/supabase/service`.                                                                                                                                                                      |
| C2  | Prices stored in paise end-to-end             | **RESOLVED** | `supabase/migrations/00005_billing_fixes.sql:11-15` multiplies seed rows ×100 in place. Net values: free 0/0, starter 49900/479000, pro 149900/1439000, business 499900/4799000, enterprise 0/0. Checkout, invoice, and `IndianCurrencyDisplay` all treat the column as paise.                                                                                          |
| C3  | Razorpay eventId extracted per event type     | **RESOLVED** | `razorpay/route.ts:144-152` `extractEventId()` returns `payment?.entity?.id ?? subscription?.entity?.id ?? null`. Null → 400. No subscription event crashes.                                                                                                                                                                                                            |
| C4  | Idempotency: check → process → insert         | **RESOLVED** | `razorpay/route.ts:98-139` executes in this order: (1) `select` webhook_events `maybeSingle`, (2) if found return 200 duplicate, (3) `dispatchEvent()` in try/catch, (4) only on success `insert` the event_id. `stripe/route.ts` mirrors the same shape.                                                                                                               |
| C5  | Error status contract                         | **RESOLVED** | `razorpay/route.ts` returns 200 success/duplicate, 400 missing/invalid signature (lines 60-73) and missing entity id (line 89), 500 on secret-missing / storage error / handler throw (lines 52, 107, 121, 138).                                                                                                                                                        |
| C6  | GST via `calculateGST`, not hardcoded         | **RESOLVED** | `razorpay/route.ts:5` imports `calculateGST` from `@/lib/gst`; called at `handlePaymentCaptured` line 226 with `(gross, billingState ?? companyState, companyState)`. State and gstNumber arrive via order `notes`. No `cgst: 0, sgst: 0, igst: 0` literals in handler.                                                                                                 |
| C7  | DELETE subscription cancels in Razorpay first | **RESOLVED** | `src/app/api/billing/subscription/route.ts` DELETE calls `cancelSubscription()` from `@/lib/razorpay`; on error returns **502** and skips the DB update. RBAC gate (owner/admin) runs before the cancel call.                                                                                                                                                           |
| C8  | Plan-limit gates on mutating routes           | **RESOLVED** | `grep checkNumericLimit\|canAdd* src/app` returns 8 files: `api/posts/route.ts`, `api/orgs/[id]/members/route.ts`, `api/connectors/whatsapp/connect/route.ts`, and all 5 OAuth callbacks (facebook, instagram, twitter, linkedin, youtube). Posts route gates both `max_posts_per_month` and `max_scheduled_posts`; callbacks redirect with `error=plan_limit_reached`. |

## Gate results

| Gate                 | Result | Notes                                                                                                                                                                                                     |
| -------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm type-check`    | PASS   | tsc --noEmit exited 0                                                                                                                                                                                     |
| `pnpm test:coverage` | PASS   | 143/143 tests, 14 files. Coverage on scoped include (`logger.ts`, `webhooks/**`, `gst.ts`, `plan-limits.ts`): 97.8% stmts / 86.66% branches / 100% funcs / 97.8% lines. All above 80/70/80/80 thresholds. |
| `pnpm lint`          | PASS   | One pre-existing warning (`<img>` in `media/page.tsx:96`) — out of Phase 4 scope.                                                                                                                         |
| `pnpm build`         | PASS   | All routes compiled, static/dynamic classification correct.                                                                                                                                               |

## Secret scan

```
grep -rn 'rzp_live|rzp_test|sk_live|sk_test|RAZORPAY_KEY_SECRET|STRIPE_SECRET|SERVICE_ROLE' \
  .next/static/ src/ --include='*.tsx' --include='*.ts' --include='*.js' \
  | grep -v 'process\.env|\.env|\.example|\.test\.|\.spec\.|\.md'
```

Result: 2 hits, both documentation comments in `src/lib/razorpay.ts`
lines 7 and 66 referring to `RAZORPAY_KEY_SECRET` by name. **Zero hits
in `.next/static/`**. No embedded live/test keys, no service-role key
material leaked to client bundles.

## Verdict

**APPROVE FOR MERGE.**

All 8 critical blockers resolved. All four gates green. Client bundles
are secret-free. The only open items are the deferred non-Phase-4
warnings already documented in `qa/phase4-fixes-applied.md` (`<img>`
lint warning in media page, pre-existing `console.*` / `as any` in
unrelated test files, `next lint` deprecation — all orthogonal).
