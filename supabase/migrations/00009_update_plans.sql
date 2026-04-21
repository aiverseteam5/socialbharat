-- Redesign plan_limits to match the new 6-plan pricing structure.
-- Also widens the organizations.plan CHECK constraint.
--
-- Plans (prices in paise):
--   free          ₹0
--   creator       ₹299/month  ₹2,990/year
--   pro_creator   ₹699/month  ₹6,990/year
--   starter_team  ₹999/month  ₹9,990/year
--   business     ₹2,499/month ₹24,990/year
--   agency        custom (0)

-- 1. Remove old plan rows.
DELETE FROM plan_limits;

-- 2. Insert new rows (all prices in paise).
INSERT INTO plan_limits
  (plan, max_social_profiles, max_users, max_posts_per_month, max_scheduled_posts,
   ai_content_generation, social_listening, custom_reports, approval_workflows,
   whatsapp_inbox, api_access, price_monthly_inr, price_yearly_inr)
VALUES
  ('free',          3,   1,    30,    10, false, false, false, false, false, false,       0,       0),
  ('creator',      10,   1,    -1,    -1, true,  false, false, false, true,  false,   29900,  299000),
  ('pro_creator',  20,   3,    -1,    -1, true,  true,  false, true,  true,  false,   69900,  699000),
  ('starter_team',  5,   3,    -1,    -1, true,  false, false, false, true,  false,   99900,  999000),
  ('business',     20,  10,    -1,    -1, true,  true,  true,  true,  true,  false,  249900, 2499000),
  ('agency',       -1,  -1,    -1,    -1, true,  true,  true,  true,  true,  true,        0,       0);

-- 3. Widen the CHECK constraint on organizations.plan.
--    PostgreSQL requires DROP + ADD since ALTER CONSTRAINT only handles deferrability.
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_plan_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('free', 'creator', 'pro_creator', 'starter_team', 'business', 'agency'));

-- 4. Update any existing orgs on retired plan names to nearest equivalent.
UPDATE organizations SET plan = 'creator'      WHERE plan = 'starter';
UPDATE organizations SET plan = 'pro_creator'  WHERE plan = 'pro';
UPDATE organizations SET plan = 'agency'       WHERE plan = 'enterprise';
