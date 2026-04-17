# Phase 4 Fixes Applied

Follow-up to `qa/phase4-independent-review.md`. All 8 critical blockers +
warnings addressed. Gates green. No destructive operations performed —
every change scoped to Phase 4 surface area.

## Gate summary

| Gate                         | Before                                 | After   |
| ---------------------------- | -------------------------------------- | ------- |
| type-check                   | fail (4 errors)                        | pass    |
| test                         | 126/130 (plan-limits + webhook broken) | 130/130 |
| lint                         | pass (pre-existing img warning)        | pass    |
| build                        | pass (stale)                           | pass    |
| secret scan (`.next/static`) | n/a                                    | clean   |

## Critical blockers

### C1 — Webhooks must use service-role client

**Before:** both webhook handlers (Razorpay + Stripe) called
`createClient()` from `@/lib/supabase/server`, which binds to the caller's
cookies. Razorpay / Stripe have no session, so every DB write was silently
dropped by RLS.
**After:** `src/app/api/billing/webhook/razorpay/route.ts` and
`.../stripe/route.ts` use `createServiceClient()` from
`@/lib/supabase/service`. Service role bypasses RLS — the only way these
handlers can persist state.

### C2 — Prices stored in paise end-to-end

**Before:** `plan_limits.price_*_inr` held rupees (e.g. 499), checkout
multiplied by 100, invoice wrote the pre-multiplied rupee amount, pricing
page divided by 100 — three layers of guessing the unit.
**After:** migration
`supabase/migrations/00005_billing_fixes.sql` rewrites rows below the
"paise threshold" (`price_monthly_inr < 10000`) in place:

```sql
UPDATE plan_limits
  SET price_monthly_inr = price_monthly_inr * 100,
      price_yearly_inr  = price_yearly_inr  * 100
  WHERE price_monthly_inr < 10000 AND price_yearly_inr < 100000;
```

Paise is now the single canonical unit. Checkout passes `baseAmount`
directly to Razorpay (no ×100), invoices store paise, the
`IndianCurrencyDisplay` component's ÷100 renders correct rupees. No code
still multiplies by 100 in the billing path.

### C3 — Razorpay eventId extraction per event type

**Before:** `const eventId = event.payload.payment.entity.id` — crashed on
every `subscription.*` event.
**After:** `extractEventId(event)` in the razorpay webhook route returns
`event.payload.payment?.entity?.id ?? event.payload.subscription?.entity?.id ?? null`.
Null triggers a 400 with an explicit log line instead of a 500.

### C4 — Idempotency: check → process → insert (was: insert → process)

**Before:** the prior handler recorded the event_id first, then processed.
A processing failure meant the retry would short-circuit as "already
processed" — silent data loss.
**After:** both webhook routes do

1. `select` by `(provider, event_id)` with `maybeSingle()`
2. if found → return `{ success: true, duplicate: true }` with 200
3. call the dispatcher in a try/catch
4. only on success insert the `webhook_events` row

Failure in step 3 throws → 500 → Razorpay retries → the row isn't there
yet → we reprocess. Failure in step 4 also returns 500 so Razorpay retries
(work succeeded but we want the audit row).

### C5 — Error status contract

**Before:** handler returned 200 unconditionally (even on error) so
Razorpay would never retry.
**After:** strict contract at the top of
`src/app/api/billing/webhook/razorpay/route.ts`:

- 200: success or duplicate
- 400: missing signature, bad signature, non-JSON body, missing entity id
- 500: secret not configured, storage error, handler threw

### C6 — GST computed with `calculateGST`, not hardcoded

**Before:** handler wrote invoices with cgst/sgst/igst = 0 and the full
payment amount as `base_amount` — broke the downstream invoice template.
**After:** checkout encodes `base_amount`, `billing_state`, and
`gst_number` in Razorpay order `notes`. In `handlePaymentCaptured`:

```ts
const gross = baseAmountPaise > 0 ? baseAmountPaise : payment.amount;
const companyState = process.env.COMPANY_GST_STATE || "Karnataka";
const gstBreakdown = calculateGST(gross, billingState || companyState, companyState);
await generateInvoice({ ..., gstBreakdown, gstNumber, billingState });
```

Same state that was shown at checkout is the state the invoice records.

### C7 — DELETE /api/billing/subscription actually cancels in Razorpay

**Before:** handler only flipped `organizations.plan = 'free'`; Razorpay
kept charging.
**After:** `src/lib/razorpay.ts` exports
`cancelSubscription(subscriptionId, cancelAtCycleEnd=true)`. The DELETE
route calls it first — on error returns **502** and leaves the DB
untouched; only after Razorpay confirms does it update
`organizations.plan`. RBAC gate (owner/admin) lives before the call.

### C8 — Plan-limit gates on mutating routes

Wired `checkNumericLimit` into every route that can grow a gated resource:

| Route                                                               | Limit                                                                  | Behavior on deny                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| `POST /api/posts`                                                   | `max_posts_per_month`, `max_scheduled_posts` (when `scheduled_at` set) | 403 `PLAN_LIMIT_EXCEEDED`            |
| `POST /api/orgs/[id]/members`                                       | `max_users`                                                            | 403 `PLAN_LIMIT_EXCEEDED`            |
| `POST /api/connectors/whatsapp/connect`                             | `max_social_profiles`                                                  | 403 `PLAN_LIMIT_EXCEEDED`            |
| Facebook / Instagram / Twitter / LinkedIn / YouTube OAuth callbacks | `max_social_profiles`                                                  | redirect `?error=plan_limit_reached` |

AI routes (`/api/ai/generate-content`, `/hashtags`, `/suggest-replies`)
already gate by `org.plan === 'free'` + per-user hourly rate limit — no
`max_ai_calls_per_day` key exists in the plan schema, so no change
required. If the product team wants a daily counter later, it should be
added to `plan_limits` + `NumericLimit` first.

## Warnings

| Warning                                                                  | Fix                                                                                                                                                        |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ts-expect-error` + cast on `window.Razorpay` in `RazorpayCheckout.tsx` | new `src/types/razorpay.d.ts` declares `Window.Razorpay`; cast removed                                                                                     |
| `console.*` in pricing page                                              | replaced with isomorphic `logger.error`                                                                                                                    |
| `console.*` (3×) in billing settings page                                | replaced with `logger.error`                                                                                                                               |
| `as any` (5×) in `tests/lib/plan-limits.test.ts`                         | typed as `unknown as SupabaseClient`                                                                                                                       |
| 4× TS2367 (literal vs `-1`) in plan-limits test                          | declared comparands as `number`, removed unused helper imports                                                                                             |
| No Zod on billing GET query params                                       | `listQuerySchema` (`z.coerce.number().int().min().max().default()`) in `/api/billing/invoices`; 400 on invalid                                             |
| No RBAC on checkout/cancel                                               | `membership.role` check (`owner`/`admin`) in `POST /checkout`, `PUT` / `DELETE /subscription`                                                              |
| Invoice number race (SELECT last+1)                                      | migration 00005 adds `invoice_number_seq` + `SECURITY DEFINER` `next_invoice_number()` RPC; `src/lib/invoice.ts` calls it                                  |
| `billing-webhook.test.ts` tested nothing                                 | rewrote: signed payload → POST route → assert status + idempotency (new → ok, duplicate → 200+duplicate, handler throws → 500 + event_id **not** inserted) |

## Tests + config

- `vitest.config.ts` coverage `include` extended with `src/lib/gst.ts`,
  `src/lib/plan-limits.ts`, `src/lib/razorpay.ts`, `src/lib/invoice.ts`.
- `tests/api/billing-webhook.test.ts` rewritten to invoke the real
  `POST` handler with a matching HMAC signature.
- 130/130 tests pass.

## Secret scan

`grep 'rzp_live|rzp_test|sk_live|sk_test|RAZORPAY_KEY_SECRET|STRIPE_SECRET|SERVICE_ROLE_KEY'`
across `.next/static/` returned **no matches**. Hits in `.next/server/`
are identifier references in the server bundle (process.env accessor),
not embedded values — expected and safe.

## Not in scope (deferred)

- 10 `console.*` and 14 `as any` in non-Phase-4 test files
  (`auth.test.ts`, `msg91.test.ts`) — pre-existing, untouched per scope.
- `next lint` migration prompt — upstream deprecation, orthogonal.
