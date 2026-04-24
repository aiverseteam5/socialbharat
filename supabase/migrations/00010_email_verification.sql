-- Track when the user's email was verified.
-- Null = email not yet verified. Set on:
--   * OAuth providers that pre-verify (Google, etc.) → set to NOW() on first callback
--   * Password signup → set when auth.users.email_confirmed_at flips to non-null
-- Middleware gates /dashboard access on this field for account_type='team' users.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email_verified_at
  ON users (email_verified_at);
