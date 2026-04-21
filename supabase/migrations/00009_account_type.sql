-- Add account_type to differentiate individual/creator users from team/business users.
-- Drives default pricing tab and post-onboarding dashboard banners.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NOT NULL DEFAULT 'individual'
  CHECK (account_type IN ('individual', 'team'));
