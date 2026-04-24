# OAuth & Email Setup Guide

Settings that must be configured in external consoles — they cannot be
committed to code. Run through this checklist once per environment
(development / staging / production).

---

## 1. Google OAuth (Supabase + Google Cloud Console)

### Google Cloud Console

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an OAuth 2.0 Client ID
   - **Application type:** Web application
   - **Name:** `SocialBharat <env>`
   - **Authorized JavaScript origins:**
     - `http://localhost:3000` (dev)
     - `https://socialbharat.tynkai.com` (prod — update as env changes)
   - **Authorized redirect URIs:**
     - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
     - (Supabase handles the provider callback; we never register our own
       app URL with Google directly.)
3. Copy the **Client ID** and **Client Secret**.
4. Enable the **Google People API** (left nav → APIs & Services → Library)
   so Supabase can read the user's name + avatar.

### Supabase Dashboard

1. Go to **Authentication → Providers → Google**
2. Toggle **Enabled**
3. Paste the Google Client ID and Client Secret from above
4. Under **Authentication → URL Configuration**, add these to
   **Redirect URLs**:
   - `http://localhost:3000/api/auth/callback`
   - `https://socialbharat.tynkai.com/api/auth/callback`
5. Save.

### Verification

Local: click "Continue with Google" on `/login` — you should be bounced to
Google, then back to `/api/auth/callback`, then to `/dashboard`.

---

## 2. Email verification (Supabase Auth)

Email signup (`/register` → email + password) uses
`supabase.auth.signUp()`. That triggers Supabase's verification email via
the project's email provider.

### Supabase Dashboard

1. **Authentication → Providers → Email**: ensure **Confirm email** is
   toggled **ON**. Without this, users are auto-confirmed and bypass the
   `/verify-email` flow.
2. **Authentication → Email Templates → Confirm signup**: customise the
   template. The action link must point to
   `{{ .SiteURL }}/api/auth/callback?code={{ .TokenHash }}` — Supabase
   substitutes `SiteURL` from **URL Configuration**, so make sure Site
   URL is set correctly per environment.
3. **Authentication → URL Configuration → Site URL**: set to the
   environment's public URL (e.g., `https://socialbharat.tynkai.com`).

### SMTP (production)

Supabase's default SMTP has a 3-emails-per-hour limit. For prod, configure
custom SMTP (Supabase supports Resend, SES, SendGrid):

1. **Project Settings → Auth → SMTP Settings**
2. Enable custom SMTP and fill in credentials from your transactional
   email provider (we use Resend — the API key is in `RESEND_API_KEY`).
3. Sender: `SocialBharat <no-reply@socialbharat.tynkai.com>` (must be a
   verified sender in the provider).

---

## 3. Environment variable sanity check

Required for OAuth + email flows to work end-to-end:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://socialbharat.tynkai.com   # used by register route
                                                       # for emailRedirectTo
```

`NEXT_PUBLIC_APP_URL` is critical — if it's wrong, email verification
links will point to the wrong domain and users will see `Invalid link`.
