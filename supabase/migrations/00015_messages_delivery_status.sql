-- V3 Phase 4D — WhatsApp delivery status on messages
-- WhatsApp Cloud API delivers status receipts (sent/delivered/read/failed) via
-- webhook value.statuses[]. Each status references the original platform_message_id.
-- This migration adds the columns plus an atomic, race-safe RPC for applying them.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed')),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Webhook handler looks up by platform_message_id; partial index keeps it tight.
CREATE INDEX IF NOT EXISTS idx_messages_platform_message_id
  ON messages (platform_message_id)
  WHERE platform_message_id IS NOT NULL;

-- Atomic, idempotent, no-downgrade status update.
-- Rank order: sent(1) < delivered(2) < read(3); failed(99) always wins.
-- Meta retries the same status webhook on transient errors, so the function
-- must be safe under "at-least-once" delivery.
CREATE OR REPLACE FUNCTION apply_message_status(
  p_platform_message_id TEXT,
  p_status TEXT,
  p_ts TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  rank_map CONSTANT JSONB := '{"sent":1,"delivered":2,"read":3,"failed":99}';
BEGIN
  UPDATE messages
     SET delivery_status = CASE
           WHEN (rank_map->>p_status)::INT >= (rank_map->>delivery_status)::INT
             THEN p_status
           ELSE delivery_status
         END,
         delivered_at = CASE
           WHEN p_status IN ('delivered', 'read') AND delivered_at IS NULL
             THEN p_ts
           ELSE delivered_at
         END,
         read_at = CASE
           WHEN p_status = 'read' AND read_at IS NULL
             THEN p_ts
           ELSE read_at
         END
   WHERE platform_message_id = p_platform_message_id;
END
$$;

GRANT EXECUTE ON FUNCTION apply_message_status(TEXT, TEXT, TIMESTAMPTZ) TO service_role;
