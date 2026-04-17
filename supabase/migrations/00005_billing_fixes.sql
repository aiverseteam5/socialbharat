-- Phase 4 billing fixes.
--
-- 1. price_monthly_inr / price_yearly_inr are stored in PAISE (integer).
--    The original seed in 00001 used rupees, which caused checkout to bill
--    ₹4.99 instead of ₹499. Multiply existing values by 100 so every
--    integer column across billing (plan prices, invoice amounts) is paise.
-- 2. Expose an atomic next_invoice_number() function so two concurrent
--    webhooks cannot collide on the SB-YYYY-NNNNNN format.

-- 1. Convert seeded plan prices from rupees to paise.
UPDATE plan_limits
  SET price_monthly_inr = price_monthly_inr * 100,
      price_yearly_inr  = price_yearly_inr  * 100
  WHERE price_monthly_inr < 10000  -- guard: only rupee-scale rows
    AND price_yearly_inr  < 100000;

-- 2. Atomic, monotonic invoice number generator.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq BIGINT;
BEGIN
  seq := nextval('invoice_number_seq');
  RETURN 'SB-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(seq::TEXT, 6, '0');
END;
$$;

-- Allow service-role (and authenticated) to call it. Service role bypasses
-- RLS anyway, but grants make intent explicit and let us tighten later.
REVOKE ALL ON FUNCTION next_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_invoice_number() TO service_role, authenticated;
