# Tasks — Atomic Task List

# SocialBharat — Each task is independently testable

## Phase 0: Project Scaffold

- [ ] **P0-01**: Run `pnpm create next-app@latest socialbharat --typescript --tailwind --app --src-dir` and initialize project
- [ ] **P0-02**: Run `pnpm dlx shadcn@latest init` and add core components: Button, Input, Card, Dialog, Sheet, Tabs, Table, Badge, Avatar, DropdownMenu, Tooltip, Skeleton, Toast
- [ ] **P0-03**: Install dependencies: `@supabase/supabase-js @supabase/ssr zod razorpay resend zustand @tanstack/react-query`
- [ ] **P0-04**: Install dev dependencies: `vitest @playwright/test husky lint-staged @types/node`
- [ ] **P0-05**: Create `src/lib/supabase/client.ts` (browser client) and `src/lib/supabase/server.ts` (server client) using @supabase/ssr
- [ ] **P0-06**: Create `.env.example` with all required environment variables from CLAUDE.md
- [ ] **P0-07**: Create `src/types/database.ts` with TypeScript types for all Supabase tables (from solution.md schema)
- [ ] **P0-08**: Configure Husky pre-commit: ESLint fix + Prettier + `tsc --noEmit`
- [ ] **P0-09**: Create `.github/workflows/ci.yml` with lint → type-check → test → build pipeline
- [ ] **P0-10**: Create `src/app/layout.tsx` with root providers (QueryClient, PostHog, Sentry)
- [ ] **P0-11**: Create `src/components/layout/Sidebar.tsx` — responsive sidebar with navigation links
- [ ] **P0-12**: Create `src/components/layout/Header.tsx` — top bar with org switcher, user menu, notifications
- [ ] **P0-13**: Create `src/components/layout/MobileNav.tsx` — bottom nav for mobile
- [ ] **P0-14**: Create `src/app/(dashboard)/layout.tsx` — authenticated layout wrapper with Sidebar + Header
- [ ] **P0-15**: Create `src/app/(auth)/layout.tsx` — minimal layout for login/register pages
- [ ] **P0-16**: Set up i18n with `src/i18n/en.json` and `src/i18n/hi.json` stubs, language context provider
- [ ] **P0-17**: Set up PostHog client provider and `src/lib/analytics.ts` with track() helper
- [ ] **P0-18**: Set up Sentry for error tracking (client + server)
- [ ] **P0-19**: Link Vercel project, deploy empty shell, confirm preview URL works
- [ ] **P0-20**: Initialize Supabase local dev (`supabase init && supabase start`)

---

## Phase 1: Authentication & Multi-Tenancy

- [ ] **P1-01**: Create Supabase migration: `users` table (id, email, phone, full_name, avatar_url, preferred_language, notification_preferences, timestamps)
- [ ] **P1-02**: Create Supabase migration: `organizations` table (id, name, slug, industry, plan, gst_number, billing_state, razorpay_customer_id, preferred_language, timezone, timestamps)
- [ ] **P1-03**: Create Supabase migration: `org_members` table (org_id, user_id, role, invited_by, timestamps) with UNIQUE constraint
- [ ] **P1-04**: Create Supabase migration: `invitations` table (org_id, email, phone, role, token, expires_at, timestamps)
- [ ] **P1-05**: Create RLS policies for users, organizations, org_members, invitations tables
- [ ] **P1-06**: Create Zod schemas: `sendOtpSchema`, `verifyOtpSchema`, `registerSchema`, `loginSchema`, `createOrgSchema`, `inviteMemberSchema`
- [ ] **P1-07**: Create `src/lib/msg91.ts` — MSG91 OTP send/verify helper
- [ ] **P1-08**: Create `POST /api/auth/otp/send` — validate phone with Zod, generate OTP, store in cache (Supabase or Upstash), send via MSG91
- [ ] **P1-09**: Create `POST /api/auth/otp/verify` — validate OTP, create/find Supabase user, return session
- [ ] **P1-10**: Create `src/middleware.ts` — protect /dashboard/\* routes, redirect unauthenticated to /login, redirect authenticated away from /login
- [ ] **P1-11**: Create `src/lib/auth.ts` — `getUser()`, `getSession()`, `requireAuth()`, `requireRole()` server-side helpers
- [ ] **P1-12**: Create `src/app/(auth)/login/page.tsx` — phone OTP tab + email/password tab + Google OAuth button
- [ ] **P1-13**: Create `src/app/(auth)/register/page.tsx` — registration form with phone-first, email option
- [ ] **P1-14**: Create `src/app/(auth)/verify-otp/page.tsx` — OTP entry with countdown timer
- [ ] **P1-15**: Create `src/app/(dashboard)/onboarding/page.tsx` — org creation wizard (name, industry, team size, language)
- [ ] **P1-16**: Create `POST /api/orgs` — create organization, add creator as Owner
- [ ] **P1-17**: Create `GET /api/orgs/:id` — get org details (auth + role check)
- [ ] **P1-18**: Create `POST /api/orgs/:id/invite` — invite team member (Owner/Admin only), generate invite token
- [ ] **P1-19**: Create `GET /api/orgs/:id/members` — list team members with roles
- [ ] **P1-20**: Create `PUT /api/orgs/:id/members/:uid` — update member role (Owner/Admin only)
- [ ] **P1-21**: Create `DELETE /api/orgs/:id/members/:uid` — remove member (Owner/Admin only, cannot remove last Owner)
- [ ] **P1-22**: Create `src/app/(dashboard)/settings/team/page.tsx` — team management UI
- [ ] **P1-23**: Create `src/hooks/useAuth.ts` — Zustand store + hook for auth state
- [ ] **P1-24**: Create `src/stores/auth-store.ts` — Zustand store for user, org, role
- [ ] **P1-25**: Write Vitest tests for: OTP generation/verification logic, RBAC guards, Zod schemas, auth helpers
- [ ] **P1-26**: Write Playwright E2E test: full signup flow (register → OTP → onboarding → dashboard)

---

## Phase 2: Social Accounts & Publishing

- [ ] **P2-01**: Create Supabase migration: `social_profiles` table with RLS
- [ ] **P2-02**: Create Supabase migration: `posts`, `post_approvals`, `campaigns` tables with RLS
- [ ] **P2-03**: Create Supabase migration: `media_assets` table with RLS
- [ ] **P2-04**: Create `src/lib/encryption.ts` — AES-256 encrypt/decrypt for access tokens
- [ ] **P2-05**: Create `POST /api/connectors/facebook/auth` — initiate Facebook OAuth (pages scope)
- [ ] **P2-06**: Create `GET /api/connectors/facebook/callback` — handle OAuth callback, store tokens
- [ ] **P2-07**: Create `POST /api/connectors/instagram/auth` — Instagram Business OAuth
- [ ] **P2-08**: Create `POST /api/connectors/twitter/auth` — Twitter/X OAuth 2.0
- [ ] **P2-09**: Create `POST /api/connectors/linkedin/auth` — LinkedIn OAuth
- [ ] **P2-10**: Create `POST /api/connectors/youtube/auth` — YouTube OAuth
- [ ] **P2-11**: Create `POST /api/connectors/whatsapp/connect` — manual WhatsApp Business API token setup
- [ ] **P2-12**: Create `GET /api/connectors/profiles` — list connected profiles with health status
- [ ] **P2-13**: Create `DELETE /api/connectors/profiles/:id` — disconnect profile
- [ ] **P2-14**: Create `src/lib/platforms/facebook.ts` — publish post, fetch metrics (typed)
- [ ] **P2-15**: Create `src/lib/platforms/instagram.ts` — publish post (image/carousel/reel)
- [ ] **P2-16**: Create `src/lib/platforms/twitter.ts` — publish tweet (text + media)
- [ ] **P2-17**: Create `src/lib/platforms/linkedin.ts` — publish post
- [ ] **P2-18**: Create `src/lib/platforms/youtube.ts` — upload video
- [ ] **P2-19**: Create `src/lib/platforms/whatsapp.ts` — send message, send template, send broadcast
- [ ] **P2-20**: Create `POST /api/posts` — create post (validate with Zod, store in DB)
- [ ] **P2-21**: Create `POST /api/posts/:id/publish` — publish to selected platforms (parallel, collect results)
- [ ] **P2-22**: Create `POST /api/posts/:id/schedule` — schedule for future time
- [ ] **P2-23**: Create scheduling worker: check scheduled posts every minute, publish when due
- [ ] **P2-24**: Create `GET /api/posts/calendar` — calendar view with date range filter
- [ ] **P2-25**: Create `POST /api/posts/:id/approve` and `POST /api/posts/:id/reject` — approval workflow
- [ ] **P2-26**: Create `src/components/publishing/PostComposer.tsx` — rich editor with platform previews
- [ ] **P2-27**: Create `src/components/publishing/ContentCalendar.tsx` — calendar with drag-and-drop
- [ ] **P2-28**: Create `src/components/publishing/PlatformPreview.tsx` — real-time per-platform preview
- [ ] **P2-29**: Create `src/components/publishing/FestivalSuggestions.tsx` — upcoming festival banner
- [ ] **P2-30**: Create `src/components/publishing/AIContentAssist.tsx` — AI content generation UI
- [ ] **P2-31**: Create `src/app/(dashboard)/publishing/compose/page.tsx` — compose page
- [ ] **P2-32**: Create `src/app/(dashboard)/publishing/calendar/page.tsx` — calendar page
- [ ] **P2-33**: Create `src/app/(dashboard)/publishing/drafts/page.tsx` — drafts list
- [ ] **P2-34**: Create `src/app/(dashboard)/settings/social-accounts/page.tsx` — connect/manage social accounts
- [ ] **P2-35**: Create Supabase migration: `indian_festivals` table, seed with 50+ festivals
- [ ] **P2-36**: Create `POST /api/ai/generate-content` — OpenAI content generation with platform/language/tone/festival params
- [ ] **P2-37**: Create `POST /api/ai/hashtags` — generate hashtags for content
- [ ] **P2-38**: Create `POST /api/media/upload` — upload to Supabase Storage, generate CDN URL
- [ ] **P2-39**: Create `src/app/(dashboard)/media/page.tsx` — media library with grid view, folders
- [ ] **P2-40**: Write Vitest tests for: publishing logic, scheduling logic, platform API helpers, festival calendar
- [ ] **P2-41**: Write Playwright E2E test: compose post → schedule → verify on calendar

---

## Phase 3: Engagement Hub

### Tech debt (carried from Phase 2)

- [ ] **P3-TD-01**: Extract `checkAiRateLimit()` into `src/lib/ratelimit.ts` and import into both AI routes — trigger when first new AI route is added in Phase 3. Currently duplicated in `src/app/api/ai/generate-content/route.ts` and `src/app/api/ai/hashtags/route.ts`.
- [ ] **P3-TD-02**: Expand `src/lib/scheduler.ts` unit tests — current `tests/lib/scheduler.test.ts` only covers the empty-posts path. Add mocked-supabase tests for: publish-success, publish-failure, partially_failed, and no-profiles cases. Then add `src/lib/scheduler.ts` back to `vitest.config.ts` coverage.include.
- [ ] **P3-TD-03**: Generate a real `META_WEBHOOK_VERIFY_TOKEN` (random 32+ char secret via `openssl rand -hex 32`), set it in `.env.local` / Vercel, and register the same value in the Meta app dashboard webhook subscription. Currently a placeholder — blocks the `/api/webhooks/meta` verification handshake. Required before P3-02 can be wired to Meta for live FB/IG/WhatsApp message ingestion.

---

- [ ] **P3-01**: Create Supabase migration: `contacts`, `conversations`, `messages` tables with RLS
- [ ] **P3-02**: Create `POST /api/webhooks/meta` — handle incoming FB/IG/WhatsApp messages, verify signature
- [ ] **P3-03**: Create `POST /api/webhooks/twitter` — handle incoming Twitter DMs/mentions
- [ ] **P3-04**: Create message ingestion service: parse webhook payload → create/update conversation + message
- [ ] **P3-05**: Create `GET /api/inbox/conversations` — list conversations (paginated, filterable by platform/status/assigned)
- [ ] **P3-06**: Create `GET /api/inbox/conversations/:id` — get conversation with messages (paginated)
- [ ] **P3-07**: Create `POST /api/inbox/conversations/:id/reply` — send reply via platform API
- [ ] **P3-08**: Create `PUT /api/inbox/conversations/:id/assign` — assign to team member
- [ ] **P3-09**: Create `PUT /api/inbox/conversations/:id/status` — update status
- [ ] **P3-10**: Create `POST /api/ai/suggest-replies` — AI reply suggestions (including Hinglish)
- [ ] **P3-11**: Create `src/components/inbox/ConversationList.tsx` — left panel with conversation previews
- [ ] **P3-12**: Create `src/components/inbox/MessageThread.tsx` — right panel with message history + reply box
- [ ] **P3-13**: Create `src/components/inbox/WhatsAppInbox.tsx` — WhatsApp-specific view with template support
- [ ] **P3-14**: Create `src/components/inbox/SmartReply.tsx` — AI suggestion chips
- [ ] **P3-15**: Create `src/app/(dashboard)/inbox/page.tsx` — unified inbox page
- [ ] **P3-16**: Create `src/app/(dashboard)/inbox/[conversationId]/page.tsx` — conversation detail
- [ ] **P3-17**: Set up Supabase Realtime subscription for new messages (live inbox updates)
- [ ] **P3-18**: Create `src/hooks/useInbox.ts` and `src/stores/inbox-store.ts`
- [ ] **P3-19**: Write Vitest tests for: message ingestion, conversation logic, webhook processing
- [ ] **P3-20**: Write Playwright E2E test: view inbox → open conversation → send reply

---

## Phase 4: Billing & Payments

### Infrastructure prerequisites

- [ ] **P4-INFRA-01**: Wire up a production trigger for `/api/cron/publish` (scheduler). Vercel Hobby blocks sub-daily crons, so `vercel.json` has no `crons` block as of the Phase 3 deploy. Options in priority order: (a) Upstash QStash hitting the endpoint every minute (free tier sufficient), (b) cron-job.org external trigger, (c) upgrade to Vercel Pro and restore `vercel.json` `{ "crons": [{ "path": "/api/cron/publish", "schedule": "* * * * *" }] }`. Protect the endpoint with a `CRON_SECRET` bearer token — without an external trigger, scheduled posts never auto-publish. Required before paid customers start scheduling posts.

---

- [ ] **P4-01**: Create Supabase migration: `plan_limits` table with seed data, `invoices` table with RLS
- [ ] **P4-02**: Create `src/lib/razorpay.ts` — Razorpay client, create order, verify payment
- [ ] **P4-03**: Create `src/lib/gst.ts` — GST calculator (CGST/SGST for intra-state, IGST for inter-state, 18% rate)
- [ ] **P4-04**: Create `GET /api/billing/plans` — return plans with features and INR pricing
- [ ] **P4-05**: Create `POST /api/billing/checkout` — create Razorpay order for selected plan (auth required)
- [ ] **P4-06**: Create `POST /api/billing/webhook/razorpay` — verify signature, handle payment.captured, subscription events
- [ ] **P4-07**: Implement webhook idempotency: store processed event IDs, skip duplicates
- [ ] **P4-08**: Create `src/lib/invoice.ts` — generate GST-compliant invoice (GSTIN, HSN/SAC 998314, tax breakdown)
- [ ] **P4-09**: Create plan enforcement middleware: check org plan limits before premium features
- [ ] **P4-10**: Create `src/app/(marketing)/pricing/page.tsx` — pricing page with plan comparison
- [ ] **P4-11**: Create `src/app/(dashboard)/settings/billing/page.tsx` — subscription management, invoice history
- [ ] **P4-12**: Create `POST /api/billing/webhook/stripe` — Stripe webhook for international payments
- [ ] **P4-13**: Create `src/components/common/IndianCurrencyDisplay.tsx` — format INR with lakhs/crores
- [ ] **P4-14**: Write Vitest tests for: GST calculator, Razorpay webhook handler (with signature verify), plan limits, idempotency
- [ ] **P4-15**: Write Playwright E2E test: navigate to pricing → select plan → complete payment (Razorpay test mode)

---

## Phase 5: Analytics & Reporting

- [ ] **P5-01**: Create metrics collection cron job: fetch profile metrics from social APIs daily
- [ ] **P5-02**: Create `GET /api/analytics/overview` — dashboard aggregate metrics (followers, impressions, engagement)
- [ ] **P5-03**: Create `GET /api/analytics/profiles/:id/metrics` — profile metrics with date range
- [ ] **P5-04**: Create `GET /api/analytics/posts` — post-level analytics
- [ ] **P5-05**: Create `POST /api/analytics/reports` — generate custom report
- [ ] **P5-06**: Create `GET /api/analytics/reports/:id/export` — export as PDF/CSV/XLSX
- [ ] **P5-07**: Create `src/components/analytics/OverviewDashboard.tsx` — metrics cards + charts
- [ ] **P5-08**: Create `src/components/analytics/MetricCard.tsx` — single metric with trend indicator
- [ ] **P5-09**: Create `src/components/analytics/ChartContainer.tsx` — chart wrapper (line, bar, pie)
- [ ] **P5-10**: Create `src/components/analytics/ReportBuilder.tsx` — select metrics, date range, profiles
- [ ] **P5-11**: Create `src/app/(dashboard)/analytics/page.tsx` — analytics dashboard
- [ ] **P5-12**: Create `src/app/(dashboard)/analytics/reports/page.tsx` — reports list and builder
- [ ] **P5-13**: Write Vitest tests for: metrics aggregation, report generation

---

## Phase 6: Social Listening & Advanced AI

- [ ] **P6-01**: Create Supabase migration: `listening_queries`, `listening_mentions` tables with RLS
- [ ] **P6-02**: Create `POST /api/listening/queries` — create keyword monitoring query
- [ ] **P6-03**: Create listening crawler: fetch mentions from Twitter API, Instagram hashtags
- [ ] **P6-04**: Create `POST /api/ai/sentiment` — sentiment analysis (English + Hindi)
- [ ] **P6-05**: Create `GET /api/listening/queries/:id/results` — paginated mention results
- [ ] **P6-06**: Create `GET /api/listening/trends` — trending topics visualization
- [ ] **P6-07**: Create alert system: notify when negative sentiment spikes
- [ ] **P6-08**: Create `src/app/(dashboard)/listening/page.tsx` — listening dashboard
- [ ] **P6-09**: Write Vitest tests for: sentiment analysis, alert thresholds

---

## Phase 7: UI Polish & i18n

- [ ] **P7-01**: Audit all pages for consistent shadcn/ui usage and design tokens
- [ ] **P7-02**: Add Skeleton loading states to all pages that fetch data
- [ ] **P7-03**: Add error boundaries with user-friendly error messages to all routes
- [ ] **P7-04**: Add empty states with helpful CTAs to all list/table views
- [ ] **P7-05**: Mobile responsive audit: fix layout at 375px, 768px, 1280px
- [ ] **P7-06**: Complete Hindi (hi.json) translation for all UI strings
- [ ] **P7-07**: Add Tamil (ta.json) and Telugu (te.json) translation stubs
- [ ] **P7-08**: Create `src/components/common/LanguageSwitcher.tsx` — language selector in header
- [ ] **P7-09**: Accessibility audit: labels, focus management, keyboard navigation, ARIA
- [ ] **P7-10**: Performance: lazy load charts, optimize images, analyze bundle size
- [ ] **P7-11**: Write comprehensive Playwright E2E tests for all critical flows

---

## Phase 8: Security & Production Deploy

- [ ] **P8-01**: Security audit: verify auth check on every API route (grep for unprotected routes)
- [ ] **P8-02**: Security audit: verify Zod validation on every API route
- [ ] **P8-03**: Security audit: verify RLS on every table
- [ ] **P8-04**: IDOR test: create 2 test orgs, verify data isolation
- [ ] **P8-05**: Implement rate limiting on auth endpoints (Upstash Redis)
- [ ] **P8-06**: Implement rate limiting on AI endpoints
- [ ] **P8-07**: Verify no secrets in client bundle: `grep -r 'SERVICE_ROLE\|SECRET\|sk_live\|rzp_live' .next/static/`
- [ ] **P8-08**: Create DPDP compliance endpoints: data export, account deletion
- [ ] **P8-09**: Set all environment variables in Vercel (production + preview)
- [ ] **P8-10**: Merge to main, deploy via GitHub Actions
- [ ] **P8-11**: Run post-deploy verification checklist
- [ ] **P8-12**: Verify PostHog PMF events: signed_up, completed_core_action, started_checkout, converted_to_paid
- [ ] **P8-13**: Verify Sentry error tracking active
- [ ] **P8-14**: Configure custom domain and SSL
