# Implementation Plan
# SocialBharat — Phased Build

## Build Philosophy
Following the Agentic Build SOP: each phase produces a deployable increment. No phase begins until the previous one passes its gate. Human review required at each gate.

---

## Phase 0: Project Scaffold (Day 1 — First 2 hours)
**Goal:** Repository setup, tooling, CI/CD, empty shell deploys to Vercel.

### Tasks:
1. Scaffold Next.js 15 App Router project with TypeScript strict, Tailwind v4, shadcn/ui
2. Initialize Supabase (local dev + cloud project)
3. Configure pnpm, Husky pre-commit hooks (lint-staged: ESLint + Prettier + type-check)
4. Create `.env.example` with all required environment variables
5. Set up GitHub Actions CI workflow (lint → type-check → test → build)
6. Link Vercel project, deploy empty shell to confirm pipeline works
7. Set up PostHog, Sentry, and basic error boundary
8. Create base layout components: Sidebar, Header, MobileNav (empty shells)
9. Set up i18n framework with en.json and hi.json stubs

### Gate:
- [ ] `pnpm type-check && pnpm lint && pnpm build` exits 0
- [ ] Vercel preview deployment accessible
- [ ] GitHub Actions CI passes on PR
- [ ] Supabase local dev running

---

## Phase 1: Authentication & Multi-Tenancy (Day 1 — Next 4 hours)
**Goal:** Users can register, login, create organizations, and invite team members. RBAC enforced.

### Tasks:
1. **Database migrations:** Create `users`, `organizations`, `org_members`, `invitations` tables with RLS
2. **Phone OTP auth:** POST /api/auth/otp/send (MSG91 integration), POST /api/auth/otp/verify
3. **Email/password auth:** Supabase Auth email/password flow
4. **Google OAuth:** Supabase Auth Google provider
5. **Middleware:** Protect all /dashboard/* routes — redirect to /login if unauthenticated
6. **Server-side auth:** `getUser()` check in all protected server components and actions
7. **Onboarding wizard:** Organization creation flow (name, industry, team size, language)
8. **Team management:** Invite members, accept invitations, role management (Owner/Admin/Editor/Viewer)
9. **RBAC guard:** Server-side role checks on all org-level actions
10. **Auth pages:** /login, /register, /verify-otp, /onboarding (responsive, i18n ready)
11. **Tests:** Vitest tests for all auth utility functions, OTP logic, RBAC guards

### Gate:
- [ ] `pnpm type-check && pnpm test && pnpm lint && pnpm build` exits 0
- [ ] Human review: Logged-out user cannot access /dashboard
- [ ] Human review: Session expiry works correctly
- [ ] Human review: SUPABASE_SERVICE_ROLE_KEY not in client bundle
- [ ] Human review: RLS enabled on all tables
- [ ] Human review: Users in one org cannot see another org's data

---

## Phase 2: Social Account Connection & Publishing (Day 1–2)
**Goal:** Users can connect social profiles and create, schedule, and publish posts.

### Tasks:
1. **Database migrations:** Create `social_profiles`, `posts`, `post_approvals`, `campaigns`, `media_assets` tables with RLS
2. **Social OAuth connectors:** Facebook, Instagram, Twitter, LinkedIn, YouTube connection flows
3. **WhatsApp Business connector:** Manual token entry flow (WhatsApp Cloud API)
4. **Token management:** Encrypted storage, automatic refresh, health check endpoint
5. **Post Composer UI:** Rich text editor with platform previews, media upload, platform selection
6. **Publishing engine:** Publish to multiple platforms via their APIs (handle per-platform formatting)
7. **Scheduling:** Schedule posts for future times, cron job to process scheduled queue
8. **Content Calendar:** Calendar view (week/month) with drag-and-drop rescheduling
9. **Media Library:** Upload, organize, and manage media assets (Supabase Storage + CDN)
10. **Indian Festival Calendar:** Seed 50+ festivals, suggestion banner in composer
11. **AI Content Assist:** Generate content via OpenAI (with platform, language, tone, festival context)
12. **Approval workflows:** Submit for approval, approve/reject flow (for Pro+ plans)
13. **Tests:** Vitest tests for publishing logic, scheduling logic, festival calendar

### Gate:
- [ ] `pnpm type-check && pnpm test && pnpm lint && pnpm build` exits 0
- [ ] Can connect a Facebook page and publish a post to it
- [ ] Scheduled posts publish at the correct time
- [ ] Content calendar shows all posts correctly
- [ ] Festival suggestions appear for upcoming festivals
- [ ] AI content generation works in English and Hindi
- [ ] Media upload and CDN delivery works

---

## Phase 3: Engagement Hub (Unified Inbox) (Day 2)
**Goal:** Users see all messages/comments across platforms in one inbox, can reply and assign.

### Tasks:
1. **Database migrations:** Create `contacts`, `conversations`, `messages` tables with RLS
2. **Webhook handlers:** Set up incoming webhooks for Meta (FB/IG/WhatsApp), Twitter, LinkedIn
3. **Message ingestion:** Process incoming messages, create/update conversations and contacts
4. **Unified Inbox UI:** Conversation list (filterable by platform, status, assigned), message thread view
5. **Reply functionality:** Reply from inbox → send via platform API
6. **Real-time updates:** Supabase Realtime subscriptions for new messages
7. **Conversation management:** Assign to team member, change status (open/closed/snoozed), add tags
8. **WhatsApp Inbox:** Dedicated WhatsApp tab with template message support
9. **Smart Replies:** AI-generated reply suggestions (including Hinglish)
10. **Contact profiles:** CRM-lite view of contact history across platforms
11. **Tests:** Vitest tests for message processing, conversation logic

### Gate:
- [ ] `pnpm type-check && pnpm test && pnpm lint && pnpm build` exits 0
- [ ] Incoming Facebook message appears in inbox in real-time
- [ ] Reply from inbox appears on the social platform
- [ ] Conversation assignment works and triggers notification
- [ ] WhatsApp messages appear and can be replied to

---

## Phase 4: Billing & Payments (Day 2)
**Goal:** Users can subscribe to plans, pay via Razorpay (UPI), receive GST-compliant invoices.

### Tasks:
1. **Database migrations:** Create `plan_limits`, `invoices` tables, seed plan data
2. **Pricing page:** Display all plans with feature comparison (INR pricing)
3. **Razorpay integration:** Create Razorpay checkout session, handle payment completion
4. **Razorpay webhooks:** Handle subscription.activated, subscription.charged, subscription.cancelled, payment.failed
5. **Webhook idempotency:** Check if event already processed before writing to DB
6. **GST calculation:** CGST/SGST for same state, IGST for interstate
7. **Invoice generation:** Generate GST-compliant invoices with GSTIN, HSN/SAC code, tax breakdown
8. **Plan enforcement:** Middleware to check subscription status and plan limits on premium features
9. **Subscription management:** Upgrade, downgrade, cancel flows
10. **Stripe fallback:** International payment option for non-Indian users
11. **Tests:** Vitest tests for GST calculation, webhook handler, plan limit enforcement

### Gate:
- [ ] `pnpm type-check && pnpm test && pnpm lint && pnpm build` exits 0
- [ ] Can complete a payment via Razorpay test mode
- [ ] Webhook idempotency: same event twice → single DB write
- [ ] GST correctly calculated for intra-state and inter-state
- [ ] Invoice PDF generated with correct tax breakdown
- [ ] Free plan users blocked from premium features
- [ ] RAZORPAY_KEY_SECRET not in client bundle

---

## Phase 5: Analytics & Reporting (Day 3)
**Goal:** Users see performance dashboards, generate custom reports.

### Tasks:
1. **Metrics collection:** Background jobs to fetch profile metrics from social APIs
2. **Analytics dashboard:** Overview with key metrics, charts (followers growth, engagement, reach)
3. **Post analytics:** Per-post performance metrics
4. **Audience insights:** Demographics breakdown (age, gender, location, language)
5. **Custom report builder:** Select metrics, date range, profiles → generate report
6. **Report export:** PDF, CSV, XLSX download
7. **Scheduled reports:** Weekly/monthly email delivery
8. **India benchmarks:** Industry-specific comparison data for Indian verticals
9. **Tests:** Vitest tests for metrics aggregation, report generation

### Gate:
- [ ] `pnpm type-check && pnpm test && pnpm lint && pnpm build` exits 0
- [ ] Dashboard shows accurate metrics for connected profiles
- [ ] Custom report generates and exports as PDF
- [ ] Scheduled report delivers via email

---

## Phase 6: Social Listening & Advanced AI (Day 3)
**Goal:** Brand monitoring, sentiment analysis, advanced AI features.

### Tasks:
1. **Database migrations:** Create `listening_queries`, `listening_mentions` tables with RLS
2. **Listening query setup:** Create keyword/hashtag monitoring rules
3. **Mention crawling:** Fetch mentions from Twitter, Instagram (via APIs)
4. **Sentiment analysis:** Analyze mention sentiment (English + Hindi/Indian languages)
5. **Trends dashboard:** Trending topics, volume graphs, sentiment distribution
6. **Crisis alerts:** Notify when negative sentiment spikes
7. **AI improvements:** Better content generation with learning from analytics data
8. **Tests:** Vitest tests for sentiment analysis, alerting logic

### Gate:
- [ ] `pnpm type-check && pnpm test && pnpm lint && pnpm build` exits 0
- [ ] Listening query returns relevant mentions
- [ ] Sentiment correctly identified for English and Hindi content

---

## Phase 7: UI Polish, i18n, & Error States (Day 3)
**Goal:** Production-quality UI, full Hindi translation, comprehensive error handling.

### Tasks:
1. **UI consistency:** Audit all pages for consistent shadcn/ui usage
2. **Loading states:** Skeleton loaders for all async data
3. **Error states:** Graceful error messages, not raw errors
4. **Empty states:** Helpful messaging when no data exists
5. **Mobile responsive:** Test and fix all views at 375px, 768px, 1280px
6. **i18n completion:** Complete Hindi translation, add Tamil/Telugu stubs
7. **Accessibility:** All interactive elements labeled, focus management, keyboard navigation
8. **Performance:** Optimize images, lazy load heavy components, minimize bundle size
9. **E2E tests:** Playwright tests for: signup, post creation, inbox reply, billing

### Gate:
- [ ] `pnpm type-check && pnpm test && pnpm lint && pnpm build` exits 0
- [ ] All Playwright E2E tests pass
- [ ] No white screens on network failure
- [ ] Mobile views look correct at all breakpoints
- [ ] Hindi UI is complete and readable

---

## Phase 8: Security Audit & Production Deploy (Day 3)
**Goal:** Security hardened, observability active, production live.

### Tasks:
1. **Security audit:** Check all API routes for auth, Zod validation, RLS
2. **IDOR testing:** Verify users cannot access other orgs' data
3. **XSS/injection:** Verify all user input is sanitized
4. **Environment check:** No secrets in client bundle, all env vars set in Vercel
5. **Rate limiting:** Implement on auth endpoints and AI endpoints (Upstash)
6. **DPDP compliance:** Data export/deletion endpoints, privacy settings
7. **Monitoring:** Confirm PostHog events, Sentry errors, uptime monitoring active
8. **Production deploy:** Merge to main, deploy via GitHub Actions
9. **Post-deploy verification:** Run all checklist items from SOP Section 9.5
10. **DNS & SSL:** Configure custom domain if ready

### Gate:
- [ ] Full human review checklist from SOP Section 8 passes
- [ ] No critical findings in security audit
- [ ] PostHog PMF events firing correctly
- [ ] Sentry connected and reporting
- [ ] Production URL accessible and functional
