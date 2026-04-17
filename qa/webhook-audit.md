# Webhook Handler Security Audit — Pre-Phase 4

**Date**: 2026-04-17
**Scope**: All webhook routes in `src/app/api/webhooks/` + `src/app/api/billing/webhook/`
**Auditor**: Automated scan (Claude)

---

## Files Audited

| #   | File                                    | Exists                                             |
| --- | --------------------------------------- | -------------------------------------------------- |
| 1   | `src/app/api/webhooks/meta/route.ts`    | YES                                                |
| 2   | `src/app/api/webhooks/twitter/route.ts` | YES                                                |
| 3   | `src/app/api/billing/webhook/*`         | NO — not yet created (Phase 4 scope: P4-06, P4-12) |

---

## 1. `/api/webhooks/meta/route.ts`

### 1a. Signature Verification

**Status**: PRESENT

- **GET** (verification handshake): Compares `hub.verify_token` query param against `process.env.META_WEBHOOK_VERIFY_TOKEN` (line 24–25). Constant-time comparison NOT used — plain `===` string equality. Low risk since this is a one-time subscription handshake, not a per-request signature.
- **POST** (event delivery): Reads raw body via `request.text()` (line 46), extracts `x-hub-signature-256` header (line 47), passes both to `verifyMetaSignature()` (line 48) which performs HMAC-SHA256 with timing-safe comparison via `timingSafeEqual` in `src/lib/webhooks/verify.ts:100`.

```
Line 37:  const appSecret = process.env.META_APP_SECRET;
Line 46:  const rawBody = await request.text();
Line 47:  const signature = request.headers.get("x-hub-signature-256");
Line 48:  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
```

**Finding**: Correct. Secret from env, raw body before JSON parse, timing-safe compare.

### 1b. Idempotency

**Status**: PRESENT (delegated to message processor)

The route itself does NOT deduplicate — it passes every normalized event to `processIncomingMessage()`. Deduplication happens inside the processor:

```
message-processor.ts line 114-129:
  // 3. Dedupe: skip if this platform_message_id is already on the conversation
  const { data: existingMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("platform_message_id", incoming.message.platformMessageId)
    .maybeSingle();

  if (existingMsg) {
    return { conversationId, messageId: existingMsg.id, contactId: contact.id, deduplicated: true };
  }
```

**Finding**: Deduplication is on `(conversation_id, platform_message_id)` — a SELECT + conditional INSERT, not an upsert with a unique constraint. **Race condition possible**: if Meta retries rapidly, two concurrent requests could both pass the SELECT before either inserts, resulting in a duplicate row. This is a **low-severity gap** — the window is narrow and Postgres will reject if there's a unique constraint on those columns, but no such constraint was found in the migrations.

### 1c. Error Isolation

**Status**: PRESENT

```
Line 102-103:
  // Meta requires a 200 response to stop retries even on partial failures.
  return NextResponse.json({ received: results.length });
```

Individual entry processing failures are caught per-entry (line 93–99) and logged, but the route always returns HTTP 200 at line 103. Meta will not retry.

**Finding**: Correct. Partial failures don't trigger retries.

### 1d. Secrets Exposure

**Status**: CLEAN

- `META_APP_SECRET` read from `process.env` at line 37 — never logged, never returned in responses.
- `META_WEBHOOK_VERIFY_TOKEN` read from `process.env` at line 24 — never logged.
- `verifyMetaSignature` in `src/lib/webhooks/verify.ts` accepts secret as a parameter, never hardcodes it.
- Grep for hardcoded secrets: 0 matches across webhook routes and verify.ts.

---

## 2. `/api/webhooks/twitter/route.ts`

### 2a. Signature Verification

**Status**: PRESENT

- **GET** (CRC challenge): Computes HMAC-SHA256 response token from `crc_token` query param + `process.env.TWITTER_API_SECRET` (line 23, 27). This proves to Twitter that we hold the consumer secret.
- **POST** (event delivery): Reads raw body via `request.text()` (line 47), extracts `x-twitter-webhooks-signature` header (line 48), passes both to `verifyTwitterSignature()` (line 49) which performs HMAC-SHA256 with timing-safe base64 comparison via `timingSafeEqual` in `src/lib/webhooks/verify.ts:36-42`.

```
Line 38:  const consumerSecret = process.env.TWITTER_API_SECRET;
Line 47:  const rawBody = await request.text();
Line 48:  const signature = request.headers.get("x-twitter-webhooks-signature");
Line 49:  if (!verifyTwitterSignature(rawBody, signature, consumerSecret)) {
```

**Finding**: Correct. Secret from env, raw body before JSON parse, timing-safe compare.

### 2b. Idempotency

**Status**: PRESENT (delegated to message processor) — same mechanism as Meta

Twitter DM events carry `ev.id` as platform_message_id (line 114). Tweet/mention events carry `t.id_str` (line 157, 170). Both are passed to `processIncomingMessage()` which deduplicates on `(conversation_id, platform_message_id)`.

**Finding**: Same race condition caveat as Meta (SELECT-then-INSERT without unique DB constraint). Additionally, if Twitter retries the exact same payload, the `ev.id` / `t.id_str` fields ensure logical dedup works.

### 2c. Error Isolation

**Status**: PRESENT

```
Line 190:  return NextResponse.json({ received: handled });
```

Per-event processing failures are caught individually (DMs: line 126–128, mentions: line 183–185) and logged without aborting the loop. The route always returns HTTP 200 at line 190.

**Finding**: Correct. Partial failures don't trigger retries.

### 2d. Secrets Exposure

**Status**: CLEAN

- `TWITTER_API_SECRET` read from `process.env` at lines 23 and 38 — never logged, never returned in responses.
- CRC GET response returns only the computed `response_token` (line 28), not the raw secret.
- Grep for hardcoded secrets: 0 matches.

---

## 3. `/api/billing/webhook/*`

**Status**: DOES NOT EXIST

Razorpay (`P4-06`) and Stripe (`P4-12`) webhook handlers are Phase 4 scope. When implemented, they MUST:

- Verify Razorpay signature using `verifyRazorpaySignature()` (already exists in `src/lib/webhooks/verify.ts`)
- Implement event-level idempotency (store `event_id` in a processed-events table — explicitly called out as `P4-07`)
- Return 200 on partial failures
- Read `RAZORPAY_WEBHOOK_SECRET` / `STRIPE_WEBHOOK_SECRET` from `process.env`

---

## Summary Table

| Check                        | Meta Webhook                                        | Twitter Webhook                                     | Billing Webhook |
| ---------------------------- | --------------------------------------------------- | --------------------------------------------------- | --------------- |
| Signature verification       | PASS (HMAC-SHA256, timing-safe)                     | PASS (HMAC-SHA256, timing-safe)                     | N/A (not built) |
| Idempotency                  | PARTIAL (app-level dedupe, no DB unique constraint) | PARTIAL (app-level dedupe, no DB unique constraint) | N/A (not built) |
| Error isolation (always 200) | PASS                                                | PASS                                                | N/A (not built) |
| No hardcoded secrets         | PASS                                                | PASS                                                | N/A (not built) |

---

## Findings

### W1: Message deduplication relies on SELECT-then-INSERT without a unique DB constraint

**Severity**: Low-Medium
**Affects**: Both Meta and Twitter webhooks (via `message-processor.ts` lines 114–129)

The `messages` table does not have a `UNIQUE(conversation_id, platform_message_id)` constraint. Deduplication is done via a `SELECT ... maybeSingle()` check before `INSERT`. Under concurrent webhook retries, two requests could both pass the SELECT before either commits the INSERT, resulting in a duplicate message row.

**Recommendation**: Add a unique index on `messages(conversation_id, platform_message_id)` and convert the SELECT-then-INSERT to an `INSERT ... ON CONFLICT DO NOTHING` (or handle the unique violation gracefully). This is a one-line migration.

### W2: GET verification handshake uses plain `===` for verify_token comparison

**Severity**: Info
**Affects**: Meta webhook GET (line 25)

The `hub.verify_token` check uses `===` instead of timing-safe comparison. This is the initial subscription handshake (called once during setup, not per-event), so timing attacks are not practically exploitable. The actual per-event HMAC signature verification IS timing-safe.

**Recommendation**: No action required. Document as accepted risk.

### W3: Billing webhooks not yet implemented

**Severity**: Info (Phase 4 pre-requisite)
**Affects**: `/api/billing/webhook/razorpay`, `/api/billing/webhook/stripe`

Not a current vulnerability — these routes don't exist yet. Tracked as P4-06 (Razorpay), P4-07 (idempotency), and P4-12 (Stripe) in `specs/tasks.md`. The Razorpay signature verifier (`verifyRazorpaySignature`) already exists and is tested.

**Recommendation**: When implementing, use the same patterns as Meta/Twitter webhooks (signature first, dedupe, always-200). P4-07 explicitly requires stored event IDs for payment idempotency — more critical than messaging dedup since duplicate payment processing has financial impact.

---

## Recommended Fix Priority

| Priority | Fix                                                                                                        | Effort                     |
| -------- | ---------------------------------------------------------------------------------------------------------- | -------------------------- |
| **P1**   | Add `UNIQUE(conversation_id, platform_message_id)` index on `messages` table                               | Trivial (1-line migration) |
| **P2**   | Convert dedupe in `message-processor.ts` to `INSERT ... ON CONFLICT DO NOTHING` or handle unique violation | Small                      |
| **P3**   | Ensure P4-06/P4-07/P4-12 follow the same webhook security patterns                                         | Phase 4 scope              |
