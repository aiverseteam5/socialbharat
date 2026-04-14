# Claude Code Prompts — Phase-by-Phase
# SocialBharat Build Sequence
#
# RULES:
# 1. Run prompts in exact order. Never skip a phase.
# 2. After each phase prompt completes, run the GATE CHECK before proceeding.
# 3. After each gate passes, run the QA PROMPT before moving to next phase.
# 4. If a gate fails, tell Claude Code to fix the failures — do NOT proceed.

# ============================================================================
# PHASE 0 — PROJECT SCAFFOLD
# ============================================================================
# Goal: Working Next.js project with all tooling, CI/CD, empty layouts, deploys to Vercel.
# Time estimate: ~45 min
# ============================================================================

## Prompt 0A — Scaffold & Dependencies

```
Read CLAUDE.md first — this is your constitution for the entire project.

This project already has: package.json, tsconfig.json, vitest.config.ts, playwright.config.ts, tests/setup.ts, e2e/smoke.spec.ts, src/types/database.ts, src/types/schemas.ts, .env.example, .github/workflows/ci.yml, .github/workflows/deploy.yml, supabase/migrations/*.sql.

Do NOT overwrite those files. Build around them.

Execute Phase 0 from specs/plan.md, tasks P0-01 through P0-20:

1. Initialize the Next.js 15 App Router project in the current directory. Since package.json already exists, run pnpm install to get dependencies. Then run pnpm dlx shadcn@latest init (use default style, slate base color, CSS variables yes). Add these shadcn components: button, input, card, dialog, sheet, tabs, table, badge, avatar, dropdown-menu, tooltip, skeleton, toast, separator, scroll-area, select, textarea, checkbox, label, popover, command.

2. Create src/lib/supabase/client.ts — browser Supabase client using @supabase/ssr createBrowserClient. Read SUPABASE_URL and ANON_KEY from NEXT_PUBLIC_ env vars.

3. Create src/lib/supabase/server.ts — server Supabase client using @supabase/ssr createServerClient with cookie handling for Next.js App Router. Must work in Server Components, Server Actions, and Route Handlers.

4. Create src/lib/supabase/middleware.ts — updateSession helper for refreshing auth tokens in middleware.

5. Create src/app/layout.tsx — root layout with: html lang attribute, Tailwind globals, QueryClientProvider from @tanstack/react-query, Toaster from shadcn, metadata with title "SocialBharat — India's Social Media Platform".

6. Create src/app/(auth)/layout.tsx — centered card layout for login/register pages. Clean, minimal. SocialBharat logo placeholder at top.

7. Create src/app/(dashboard)/layout.tsx — authenticated shell with Sidebar on left (hidden on mobile), Header on top, main content area. This layout should be a placeholder — auth checks will come in Phase 1.

8. Create src/components/layout/Sidebar.tsx — collapsible sidebar with nav links: Dashboard, Publishing, Inbox, Analytics, Listening, Media, AI Studio, Settings. Use lucide-react icons. Active state highlighting. Collapsible on desktop, hidden on mobile.

9. Create src/components/layout/Header.tsx — top bar with: hamburger menu toggle (mobile), "SocialBharat" text, placeholder for org switcher, placeholder for notification bell, user avatar dropdown with Sign Out.

10. Create src/components/layout/MobileNav.tsx — bottom fixed nav for mobile with 5 key icons: Home, Publishing, Inbox, Analytics, Settings.

11. Create src/app/(dashboard)/page.tsx — empty dashboard home with "Welcome to SocialBharat" heading.

12. Create src/app/(auth)/login/page.tsx — placeholder login page with "Sign In" heading.

13. Set up i18n: Create src/i18n/en.json and src/i18n/hi.json with stubs for common keys (app_name, nav items, auth labels). Create src/lib/i18n.ts with a simple translation hook or context.

14. Create src/lib/analytics.ts — PostHog wrapper with track() function. Initialize only if NEXT_PUBLIC_POSTHOG_KEY exists. Export track('event_name', props) helper.

15. Configure Husky: run pnpm dlx husky init. Create .husky/pre-commit that runs: pnpm lint-staged && pnpm type-check.

16. Create a src/app/(marketing)/page.tsx — simple landing page with "SocialBharat — India's #1 Social Media Platform" and a "Get Started" button linking to /register.

17. After creating all files, run: pnpm type-check && pnpm lint && pnpm build. Fix every error until all three commands exit 0. Do not stop until the build succeeds.

Report what you created and the result of the final build.
```

## Gate Check 0

```bash
pnpm type-check   # must exit 0
pnpm lint          # must exit 0
pnpm build         # must exit 0
pnpm test          # should exit 0 (may have no tests yet — that's fine)
```

---

# ============================================================================
# PHASE 1 — AUTHENTICATION & MULTI-TENANCY
# ============================================================================
# Goal: Phone OTP, email/password, Google OAuth, orgs, teams, RBAC.
# Time estimate: ~2-3 hours
# ============================================================================

## Prompt 1A — Database & Auth Backend

```
Read CLAUDE.md and specs/plan.md Phase 1. Read specs/tasks.md Phase 1 for the full task list. Read specs/solution.md Section 1 for the data model and Section 3 for auth flows.

Phase 0 is approved. Proceed to Phase 1: Authentication & Multi-Tenancy.

The database migration already exists at supabase/migrations/00001_initial_schema.sql with tables AND RLS policies. Do NOT recreate them. Instead, push this migration to your local Supabase: run supabase db push.

Now implement tasks P1-06 through P1-26:

BACKEND FIRST:

1. The Zod schemas already exist in src/types/schemas.ts. Review them and use them in all route handlers below.

2. Create src/lib/msg91.ts — helper to send OTP via MSG91 REST API. Function sendOtp(phone: string) that calls MSG91 /otp/send endpoint using MSG91_AUTH_KEY and MSG91_TEMPLATE_ID from env. Function verifyOtp(phone: string, otp: string) that calls MSG91 /otp/verify. Type everything. If MSG91_AUTH_KEY is not set, log a warning and use a mock OTP "123456" for development.

3. Create src/app/api/auth/otp/send/route.ts — POST handler. Parse body with sendOtpSchema. Call msg91.sendOtp(). Return { message: "OTP sent", expiresIn: 300 }. Rate limit: use a simple in-memory map for now (5 requests per phone per 10 minutes).

4. Create src/app/api/auth/otp/verify/route.ts — POST handler. Parse body with verifyOtpSchema. Call msg91.verifyOtp(). If valid, check if user exists in users table by phone. If not, create user via Supabase Auth (signUp with phone), then insert into users table. Create session. Return { user, session, isNewUser }.

5. Create src/lib/auth.ts with these server-side helpers:
   - getUser() — reads session from cookies via Supabase server client, returns user or null
   - getSession() — returns the full session object or null
   - requireAuth() — calls getUser(), throws redirect to /login if null
   - requireRole(orgId, allowedRoles[]) — checks org_members table for user's role, throws 403 if not allowed
   - getCurrentOrg(userId) — fetches the user's first org from org_members, returns org or null

6. Create src/middleware.ts — Next.js middleware that:
   - Calls updateSession to refresh auth tokens
   - Protects /dashboard/* routes: if no session, redirect to /login
   - Redirects /login and /register to /dashboard if session exists
   - Allows /api/* routes through (they handle their own auth)
   - Allows /(marketing)/* routes through (public)

7. Create src/app/api/orgs/route.ts — POST: create organization. Parse with createOrgSchema. Generate slug from name. Insert org, insert org_member with role='owner'. Return org.

8. Create src/app/api/orgs/[id]/route.ts — GET: get org details. requireAuth + verify membership.

9. Create src/app/api/orgs/[id]/members/route.ts — GET: list members. POST: invite member (requireRole owner/admin). Generate random invite token, store in invitations table, return invite link.

10. Create src/app/api/orgs/[id]/members/[uid]/route.ts — PUT: update role (requireRole owner/admin). DELETE: remove member (requireRole owner/admin, cannot remove last owner).

After creating all backend files, run pnpm type-check. Fix all errors before proceeding. Report results.
```

## Prompt 1B — Auth UI & Tests

```
Phase 1 backend is done. Now implement the UI and tests.

UI:

1. Create src/app/(auth)/login/page.tsx — Two tabs: "Phone OTP" and "Email". Phone tab has phone input (+91 prefix) and "Send OTP" button. On send, call POST /api/auth/otp/send, then show OTP input with 6 digit fields and countdown timer. Email tab has email + password inputs with "Sign In" button. Below both tabs: "Continue with Google" button (Supabase OAuth). Below that: "Don't have an account? Register" link. Use shadcn components. Mobile-first responsive.

2. Create src/app/(auth)/register/page.tsx — Phone-first registration. Phone input → Send OTP → Verify OTP → Set name & email (optional). Or switch to "Register with Email" tab: name, email, password (with strength indicator), confirm password. "Already have an account? Sign In" link.

3. Create src/app/(auth)/verify-otp/page.tsx — standalone OTP verification page. 6 digit input, countdown timer (5 min), "Resend OTP" button (enabled after 30 sec). On verify, redirect to /dashboard or /onboarding if isNewUser.

4. Create src/app/(dashboard)/onboarding/page.tsx — multi-step wizard. Step 1: Organization name + industry dropdown. Step 2: Team size selector. Step 3: Preferred language (English, Hindi, Tamil, Telugu, Bengali, Marathi). Step 4: "Invite team members" (optional, can skip). On finish, POST /api/orgs, then redirect to /dashboard.

5. Create src/app/(dashboard)/settings/team/page.tsx — table showing team members (name, email/phone, role, joined date). "Invite Member" button opens dialog: email or phone + role selector (Admin, Editor, Viewer). Role change dropdown for each member (only if current user is Owner/Admin). Remove member button with confirmation dialog. Cannot change/remove the last Owner.

6. Create src/hooks/useAuth.ts and src/stores/auth-store.ts — Zustand store holding: user, currentOrg, role, isLoading. Hook that initializes from server data (passed via props from server component). Include signOut function that calls supabase.auth.signOut() and redirects to /login.

7. Update src/components/layout/Header.tsx — wire up the user avatar dropdown: show user name, org name, "Settings" link, "Sign Out" button that calls auth store signOut.

TESTS:

8. Create tests/lib/auth.test.ts — test requireAuth throws redirect when no session, test requireRole with different roles, test getCurrentOrg.

9. Create tests/lib/msg91.test.ts — test sendOtp calls fetch with correct params, test verifyOtp returns correct response, test dev fallback OTP.

10. Create tests/types/schemas.test.ts — test every Zod schema: valid input passes, invalid input fails with correct error messages. Test sendOtpSchema with valid/invalid Indian phone numbers. Test verifyOtpSchema with 6 digit and non-6 digit. Test createOrgSchema. Test GST number format in updateOrgSchema.

11. Create tests/lib/gst.test.ts — if src/lib/gst.ts exists already (it may not yet), test it. Otherwise skip.

Run pnpm type-check && pnpm test && pnpm lint && pnpm build. Fix all errors. Do not proceed to Phase 2. Report results including test count and pass rate.
```

## Gate Check 1

```bash
pnpm type-check && pnpm test && pnpm lint && pnpm build
# All must exit 0
# Manually verify:
# - Open incognito → /dashboard → should redirect to /login
# - Log in → should see dashboard
# - grep -r 'SERVICE_ROLE' .next/static/ → should return nothing
```

---

# ============================================================================
# PHASE 2 — SOCIAL ACCOUNTS & PUBLISHING
# ============================================================================
# Goal: Connect social profiles, compose posts, schedule, calendar, festivals, AI content.
# Time estimate: ~3-4 hours
# ============================================================================

## Prompt 2A — Social Connectors & Platform APIs

```
Read CLAUDE.md and specs/plan.md Phase 2. Read specs/tasks.md P2-01 through P2-19.

Phase 1 is approved. Proceed to Phase 2: Social Account Connection & Publishing.

The database tables (social_profiles, posts, post_approvals, campaigns, media_assets) and their RLS policies already exist in supabase/migrations/00001_initial_schema.sql. The festival seed data exists in 00002_seed_festivals.sql. Do NOT recreate migrations — they are already applied.

SOCIAL CONNECTORS:

1. Create src/lib/encryption.ts — AES-256-GCM encrypt/decrypt using a key from env var ENCRYPTION_KEY. Functions: encrypt(plaintext: string): string and decrypt(ciphertext: string): string. Used for storing social platform tokens.

2. Create src/lib/platforms/base.ts — abstract BasePlatformConnector class/interface with methods: publishPost(content, mediaUrls), deletePost(platformPostId), getProfile(), getMetrics(dateRange). Each platform extends this.

3. Create src/lib/platforms/facebook.ts — Facebook Graph API connector. publishPost creates a post on a Facebook Page via /{page-id}/feed. getProfile fetches page info. getMetrics fetches page insights. All typed.

4. Create src/lib/platforms/instagram.ts — Instagram Graph API connector. publishPost creates media container then publishes. Handles image, carousel, and reel types. Character limit 2200.

5. Create src/lib/platforms/twitter.ts — Twitter API v2 connector. publishPost creates a tweet via /2/tweets. Handles text (280 char limit) + media upload. getMetrics fetches tweet metrics.

6. Create src/lib/platforms/linkedin.ts — LinkedIn API connector. publishPost creates a share via /ugcPosts. Text limit 3000 chars.

7. Create src/lib/platforms/youtube.ts — YouTube Data API connector. publishPost uploads video via /youtube/v3/videos. getMetrics fetches video stats.

8. Create src/lib/platforms/whatsapp.ts — WhatsApp Cloud API connector. sendMessage sends text/template/media message. sendBroadcast sends template to multiple recipients. handleWebhook parses incoming message payloads.

9. Create src/lib/platforms/index.ts — factory function: getPlatformConnector(platform: SocialPlatform, accessToken: string) that returns the correct connector instance.

10. Create OAuth flows for each platform:
    - src/app/api/connectors/facebook/auth/route.ts — redirects to Facebook OAuth with pages_manage_posts, pages_read_engagement scopes
    - src/app/api/connectors/facebook/callback/route.ts — handles callback, exchanges code for token, encrypts and stores in social_profiles
    - Repeat same pattern for instagram, twitter, linkedin, youtube
    - src/app/api/connectors/whatsapp/connect/route.ts — POST that accepts phone_number_id and access_token directly (WhatsApp uses manual token setup), encrypts and stores

11. Create src/app/api/connectors/profiles/route.ts — GET: list all connected profiles for current org. Include decrypted-then-checked health status (is token expired?).

12. Create src/app/api/connectors/profiles/[id]/route.ts — DELETE: disconnect profile (remove from DB).

Run pnpm type-check. Fix all errors. Report what you created.
```

## Prompt 2B — Publishing Engine & UI

```
Phase 2A connectors are done. Now implement the publishing engine and UI.

Read specs/tasks.md P2-20 through P2-41.

PUBLISHING ENGINE:

1. Create src/app/api/posts/route.ts — POST: create post. Parse with postSchema (from schemas.ts). Store in posts table with status 'draft'. GET: list posts for current org with filters (status, dateRange, campaign, platform).

2. Create src/app/api/posts/[id]/route.ts — GET: post details. PUT: update post (only if draft/rejected). DELETE: delete post.

3. Create src/app/api/posts/[id]/publish/route.ts — POST: publish immediately. For each platform in post.platforms: decrypt token from social_profiles → call platform connector publishPost → collect results. Update post status to 'published', 'failed', or 'partially_failed'. Store per-platform results in publish_results JSONB.

4. Create src/app/api/posts/[id]/schedule/route.ts — POST: validate scheduled_at is in the future, update post status to 'scheduled'.

5. Create src/app/api/posts/[id]/approve/route.ts — POST: requireRole owner/admin. Update status from pending_approval to approved. Create post_approval record.

6. Create src/app/api/posts/[id]/reject/route.ts — POST: requireRole owner/admin. Update status to draft. Create post_approval record with feedback.

7. Create src/lib/scheduler.ts — function processScheduledPosts() that queries posts WHERE status='scheduled' AND scheduled_at <= NOW(), then publishes each one. This will be called by a Vercel Cron or API route.

8. Create src/app/api/cron/publish/route.ts — GET handler (for Vercel Cron). Calls processScheduledPosts(). Protected by a CRON_SECRET env var check.

9. Create vercel.json with cron config: run /api/cron/publish every minute.

10. Create src/app/api/posts/calendar/route.ts — GET: return posts within a date range for calendar view.

AI & FESTIVALS:

11. Create src/app/api/ai/generate-content/route.ts — POST: accept prompt, platform, language, tone, festival_context. Call OpenAI GPT-4 with a system prompt optimized for Indian social media. Return generated content + hashtags. Use Zod for input validation.

12. Create src/app/api/ai/hashtags/route.ts — POST: accept content text + platform + language, return relevant hashtags.

13. Create src/lib/festivals.ts — helper to query indian_festivals table for upcoming festivals within N days, filtered by region.

MEDIA:

14. Create src/app/api/media/upload/route.ts — POST: accept file upload, store in Supabase Storage bucket 'media', generate CDN URL, insert into media_assets table. Validate file type and size.

15. Create src/app/api/media/route.ts — GET: list media assets for current org, paginated, filterable by folder/type/tags.

UI:

16. Create src/components/publishing/PostComposer.tsx — the main composer. Text area with character counter (adapts to selected platform limits). Platform selector checkboxes. Media upload zone (drag & drop). Schedule date/time picker. "Publish Now", "Schedule", "Save Draft" buttons. If approval workflow enabled (Pro+ plan), show "Submit for Approval" instead of "Publish Now" for Editor role.

17. Create src/components/publishing/PlatformPreview.tsx — shows how the post will look on each selected platform. Tabs for each platform. Mocked preview cards.

18. Create src/components/publishing/ContentCalendar.tsx — month and week views using a grid. Shows posts as colored blocks by status (draft=gray, scheduled=blue, published=green, failed=red). Click to view details. Basic drag to reschedule.

19. Create src/components/publishing/FestivalSuggestions.tsx — banner that shows when a festival is within 14 days. Festival name, Hindi name, suggested hashtags, "Generate Content" button that pre-fills the composer with AI prompt.

20. Create src/components/publishing/AIContentAssist.tsx — sidebar panel or modal. Prompt input, platform selector, language selector (en, hi, ta, te, bn, mr), tone selector (professional, casual, humorous, festive, hinglish). "Generate" button. Shows generated content with "Use This" button to insert into composer.

21. Wire up pages:
    - src/app/(dashboard)/publishing/compose/page.tsx — PostComposer + PlatformPreview + AIContentAssist + FestivalSuggestions
    - src/app/(dashboard)/publishing/calendar/page.tsx — ContentCalendar
    - src/app/(dashboard)/publishing/drafts/page.tsx — list of draft posts with edit/delete actions
    - src/app/(dashboard)/settings/social-accounts/page.tsx — grid of platform cards with "Connect" buttons, list of connected profiles with status + "Disconnect"
    - src/app/(dashboard)/media/page.tsx — media library grid with upload button, folder navigation, search

22. Create src/hooks/usePublishing.ts and src/stores/publishing-store.ts — Zustand store for composer state (content, selectedPlatforms, mediaFiles, scheduledAt).

TESTS:

23. Create tests/lib/platforms/facebook.test.ts — mock fetch, test publishPost constructs correct API call, test error handling.
24. Create tests/lib/scheduler.test.ts — test processScheduledPosts finds and publishes due posts.
25. Create tests/lib/festivals.test.ts — test getUpcomingFestivals returns correct festivals for date range.
26. Create tests/api/posts.test.ts — test create post validation, test publish flow.

Run pnpm type-check && pnpm test && pnpm lint && pnpm build. Fix all errors. Do not proceed to Phase 3. Report results.
```

## Gate Check 2

```bash
pnpm type-check && pnpm test && pnpm lint && pnpm build
```

---

# ============================================================================
# PHASE 3 — ENGAGEMENT HUB (UNIFIED INBOX)
# ============================================================================
# Goal: Unified inbox, webhooks, real-time messages, WhatsApp, smart replies.
# Time estimate: ~2-3 hours
# ============================================================================

## Prompt 3

```
Read CLAUDE.md and specs/plan.md Phase 3. Read specs/tasks.md P3-01 through P3-20. Read specs/solution.md Section 2.5 for engagement API design.

Phase 2 is approved. Proceed to Phase 3: Engagement Hub.

The database tables (contacts, conversations, messages) and RLS policies already exist in the migration. They are already applied.

WEBHOOK HANDLERS:

1. Create src/app/api/webhooks/meta/route.ts — handles incoming webhooks from Facebook, Instagram, AND WhatsApp (Meta sends all three to one endpoint). GET handler for webhook verification (hub.verify_token check). POST handler: verify X-Hub-Signature-256 header, parse payload, route by object type (page→FB, instagram→IG, whatsapp_business_account→WhatsApp). For each incoming message/comment: upsert contact, upsert conversation, insert message, update conversation.last_message_at.

2. Create src/app/api/webhooks/twitter/route.ts — Twitter Account Activity API webhook. POST: verify CRC signature. Parse incoming DMs and mentions. Same flow: upsert contact → upsert conversation → insert message.

3. Create src/lib/inbox/message-processor.ts — shared logic for processing incoming messages from any platform. Functions: processIncomingMessage(platform, rawPayload) that normalizes the payload, upserts contact and conversation, inserts message. Uses Supabase service role client (this runs in webhook context, not user context).

INBOX API:

4. Create src/app/api/inbox/conversations/route.ts — GET: list conversations for current org. Paginated (cursor-based). Filters: platform, status (open/assigned/closed), assigned_to, search (contact name). Sort by last_message_at desc. Include latest message preview and contact info.

5. Create src/app/api/inbox/conversations/[id]/route.ts — GET: conversation detail with messages (paginated, oldest first). Include contact profile. PUT: update conversation fields.

6. Create src/app/api/inbox/conversations/[id]/reply/route.ts — POST: accept reply text + optional media. Determine platform from conversation. Decrypt social profile token. Call platform connector to send reply. Insert message with sender_type='agent'. Return sent message.

7. Create src/app/api/inbox/conversations/[id]/assign/route.ts — PUT: assign conversation to a team member. Update assigned_to and status to 'assigned'. Create notification for the assigned user.

8. Create src/app/api/inbox/conversations/[id]/status/route.ts — PUT: update status (close, snooze, reopen).

9. Create src/app/api/inbox/conversations/[id]/tags/route.ts — POST: add tags to conversation.

10. Create src/app/api/ai/suggest-replies/route.ts — POST: accept conversation messages history + contact language. Call OpenAI to generate 3 reply suggestions. If language_detected is 'hi' or conversation appears Hinglish, generate Hinglish replies. Return array of suggestions.

INBOX UI:

11. Create src/components/inbox/ConversationList.tsx — left sidebar panel. Each item shows: contact avatar, contact name, platform icon, last message preview (truncated), timestamp, unread indicator, assigned user avatar. Filter bar at top: platform selector, status selector, search input. Click to select conversation.

12. Create src/components/inbox/MessageThread.tsx — right panel. Shows conversation header (contact name, platform, status, assign button, close button). Message bubbles: incoming on left (with contact avatar), outgoing on right. Timestamp on each message. Reply input at bottom with send button and media attach button.

13. Create src/components/inbox/SmartReply.tsx — below the message thread, above the reply input. Shows 3 AI-suggested reply chips. Click a chip to insert into reply input. "Refresh suggestions" button. Only shows if org plan includes AI features.

14. Create src/components/inbox/WhatsAppInbox.tsx — specialized view for WhatsApp conversations. Shows template message button (for initiating conversations outside 24h window). Template selector dropdown. Template preview before sending.

15. Create src/components/inbox/ContactProfile.tsx — right sidebar or drawer. Shows contact: name, avatar, platform, first seen date, total conversations, tags, notes field. History of all conversations with this contact across platforms.

16. Wire up pages:
    - src/app/(dashboard)/inbox/page.tsx — ConversationList on left, MessageThread on right (or stacked on mobile). SmartReply below thread.
    - src/app/(dashboard)/inbox/[conversationId]/page.tsx — same layout, pre-selected conversation.
    - src/app/(dashboard)/whatsapp/page.tsx — WhatsAppInbox with template management

REAL-TIME:

17. Create src/hooks/useInbox.ts and src/stores/inbox-store.ts — Zustand store for: selectedConversation, conversations list, messages, filters. Hook that subscribes to Supabase Realtime on the 'messages' table filtered by org conversations. On new message: update conversation list, update message thread if viewing that conversation, show toast notification.

18. Create src/hooks/useRealtime.ts — generic Supabase Realtime subscription hook. useRealtime(table, filter, callback). Used by useInbox and potentially other features.

TESTS:

19. Create tests/lib/inbox/message-processor.test.ts — test processIncomingMessage with Facebook, Instagram, WhatsApp payload mocks. Verify contact upsert, conversation upsert, message insert.
20. Create tests/api/inbox.test.ts — test conversation list with filters, test reply sends to correct platform.

Run pnpm type-check && pnpm test && pnpm lint && pnpm build. Fix all errors. Report results.
```

## Gate Check 3

```bash
pnpm type-check && pnpm test && pnpm lint && pnpm build
```

---

# ============================================================================
# PHASE 4 — BILLING & PAYMENTS
# ============================================================================
# Goal: Razorpay checkout, GST invoices, plan enforcement.
# Time estimate: ~2 hours
# ============================================================================

## Prompt 4

```
Read CLAUDE.md and specs/plan.md Phase 4. Read specs/tasks.md P4-01 through P4-15. Read specs/solution.md Section 2.8 for billing API design.

Phase 3 is approved. Proceed to Phase 4: Billing & Payments.

The plan_limits table (with seed data) and invoices table already exist in the migration. The webhook_events table for idempotency also exists.

BILLING BACKEND:

1. Create src/lib/razorpay.ts — Razorpay client initialization using RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. Functions: createOrder(amount, currency, orgId), verifyPaymentSignature(orderId, paymentId, signature). All typed. RAZORPAY_KEY_SECRET must NEVER appear in any client-side file.

2. Create src/lib/gst.ts — GST calculator. Function calculateGST(baseAmountPaise: number, customerState: string, companyState: string): { baseAmount, cgst, sgst, igst, totalAmount, isInterState }. GST rate is 18% for SaaS. If same state: split into CGST 9% + SGST 9%. If different state: IGST 18%. Company state from COMPANY_GST_STATE env var (default: 'Karnataka'). All amounts in paise (integer math, no floating point).

3. Create src/lib/invoice.ts — Generate GST-compliant invoice. Function generateInvoice(org, payment, gstBreakdown): creates invoice record with sequential invoice number (SB-2025-0001 format), GSTIN, HSN/SAC code 998314, tax breakdown. Returns invoice record. For PDF generation, use a simple HTML-to-PDF approach or just store the data for now.

4. Create src/app/api/billing/plans/route.ts — GET: return all plans from plan_limits table with formatted INR pricing. Public route (no auth required).

5. Create src/app/api/billing/checkout/route.ts — POST: requireAuth. Parse with checkoutSchema (plan, billingState, gstNumber optional). Look up plan price. Calculate GST. Create Razorpay order via razorpay.orders.create(). Return { orderId, amount, currency, key: RAZORPAY_KEY_ID, orgId, gstBreakdown }.

6. Create src/app/api/billing/webhook/razorpay/route.ts — POST: verify Razorpay webhook signature using RAZORPAY_WEBHOOK_SECRET and X-Razorpay-Signature header. CRITICAL: Check webhook_events table for idempotency — if event_id already exists, return 200 and skip processing. Handle events:
   - payment.captured: update org plan, generate invoice, insert webhook_event
   - subscription.activated: update org plan + plan_expires_at
   - subscription.charged: generate invoice for renewal
   - subscription.cancelled: downgrade org to free plan at period end
   - payment.failed: create notification for org owner
   Return 200 for all events (Razorpay retries on non-200).

7. Create src/lib/plan-limits.ts — middleware/helper that checks if current org's plan allows a feature. Function checkPlanLimit(orgId, feature: string): boolean. Features: 'ai_content_generation', 'social_listening', 'custom_reports', 'approval_workflows', 'whatsapp_inbox', 'api_access'. Also checks numeric limits: max_social_profiles, max_users, max_posts_per_month.

8. Create src/app/api/billing/subscription/route.ts — GET: return current subscription details (plan, next billing date, payment method). PUT: upgrade/downgrade plan. DELETE: cancel subscription (effective at period end).

9. Create src/app/api/billing/invoices/route.ts — GET: list invoices for current org. Paginated.

10. Create src/app/api/billing/webhook/stripe/route.ts — POST: Stripe webhook for international payments. Verify signature. Handle checkout.session.completed and customer.subscription.deleted. Same idempotency pattern.

BILLING UI:

11. Create src/app/(marketing)/pricing/page.tsx — Pricing page with plan comparison table. Show INR prices with "per month" and "per year (save 20%)" toggle. Feature comparison grid. "Get Started" / "Upgrade" CTAs. Free plan highlighted for micro-businesses. Use IndianCurrencyDisplay component.

12. Create src/components/common/IndianCurrencyDisplay.tsx — formats number as INR: ₹4,99,999 (Indian lakhs/crores format, not Western comma grouping). Props: amount (in paise), showPaise (boolean).

13. Create src/app/(dashboard)/settings/billing/page.tsx — Current plan card with usage meters (X of Y profiles used, etc.). "Upgrade Plan" button. Payment method on file. Invoice history table with download links. Cancel subscription with confirmation dialog.

14. Create src/components/billing/RazorpayCheckout.tsx — client component that loads Razorpay checkout script, opens checkout modal with order details, handles success/failure callbacks. On success: POST to a verification endpoint, then redirect to billing settings with success toast.

TESTS:

15. Create tests/lib/gst.test.ts — test intra-state (Karnataka→Karnataka): CGST 9% + SGST 9%, IGST 0. Test inter-state (Karnataka→Maharashtra): CGST 0, SGST 0, IGST 18%. Test with various amounts. Test integer math (no floating point drift).

16. Create tests/lib/plan-limits.test.ts — test free plan blocks AI features, test pro plan allows AI, test numeric limits (max profiles).

17. Create tests/api/billing-webhook.test.ts — test Razorpay signature verification (valid and invalid). Test idempotency: process event, try same event_id again, verify single DB write. Test payment.captured updates org plan.

Run pnpm type-check && pnpm test && pnpm lint && pnpm build. Fix all errors. Report results.
```

## Gate Check 4

```bash
pnpm type-check && pnpm test && pnpm lint && pnpm build
# Also manually verify:
# grep -r 'RAZORPAY_KEY_SECRET\|rzp_live' .next/static/ → must return nothing
```

---

# ============================================================================
# PHASE 5 — ANALYTICS & REPORTING
# ============================================================================
# Goal: Dashboards, metrics, custom reports, PDF export.
# Time estimate: ~2 hours
# ============================================================================

## Prompt 5

```
Read CLAUDE.md and specs/plan.md Phase 5. Read specs/tasks.md P5-01 through P5-13.

Phase 4 is approved. Proceed to Phase 5: Analytics & Reporting.

The profile_metrics and post_metrics tables already exist in the migration.

1. Create src/lib/metrics-collector.ts — for each connected social_profile: decrypt token, call platform connector getMetrics(dateRange), upsert into profile_metrics table. Function collectAllMetrics(orgId, date).

2. Create src/app/api/cron/collect-metrics/route.ts — Vercel Cron handler (daily). Iterates all active social_profiles across all orgs, calls collectAllMetrics. Protected by CRON_SECRET.

3. Update vercel.json — add daily cron for /api/cron/collect-metrics.

4. Create src/app/api/analytics/overview/route.ts — GET: aggregate metrics for current org across all profiles. Return: total followers, total impressions, avg engagement rate, top 5 posts by engagement. Accept dateRange query param.

5. Create src/app/api/analytics/profiles/[id]/metrics/route.ts — GET: metrics for a specific profile over a date range. Return time series data for charts.

6. Create src/app/api/analytics/posts/route.ts — GET: post-level analytics. Join posts with post_metrics. Sort by engagement desc. Paginated.

7. Create src/app/api/analytics/reports/route.ts — POST: generate custom report. Accept: selectedMetrics, dateRange, profileIds, reportName. Store report config. GET: list saved reports.

8. Create src/app/api/analytics/reports/[id]/export/route.ts — GET: export report as CSV (using comma-separated text generation) or JSON. PDF export can be a stretch goal — generate HTML report and note that PDF generation requires a library like puppeteer (which won't run on Vercel Edge, so document this limitation).

9. Create src/components/analytics/MetricCard.tsx — card showing: metric name, current value (formatted), trend arrow (up/down), percentage change from previous period. Use green for positive, red for negative.

10. Create src/components/analytics/ChartContainer.tsx — wrapper around recharts. Accept data and chart type (line, bar, area, pie). Responsive. Consistent color scheme.

11. Create src/components/analytics/OverviewDashboard.tsx — grid of MetricCards (followers, impressions, engagement rate, reach, clicks). Below: two charts side by side — followers growth line chart and engagement bar chart. Below: top performing posts list.

12. Create src/components/analytics/ReportBuilder.tsx — form with: checkboxes for metrics to include, date range picker, profile multi-select, report name input. "Generate" button. Preview of report data in a table.

13. Wire up pages:
    - src/app/(dashboard)/analytics/page.tsx — OverviewDashboard with profile selector at top
    - src/app/(dashboard)/analytics/reports/page.tsx — saved reports list + ReportBuilder

14. Create tests/lib/metrics-collector.test.ts — test metric collection calls correct platform APIs, test upsert logic.
15. Create tests/api/analytics.test.ts — test overview aggregation, test date range filtering.

Run pnpm type-check && pnpm test && pnpm lint && pnpm build. Fix all errors. Report results.
```

## Gate Check 5

```bash
pnpm type-check && pnpm test && pnpm lint && pnpm build
```

---

# ============================================================================
# PHASE 6 — SOCIAL LISTENING & ADVANCED AI
# ============================================================================
# Goal: Brand monitoring, sentiment analysis, trending topics, crisis alerts.
# Time estimate: ~1.5 hours
# ============================================================================

## Prompt 6

```
Read CLAUDE.md and specs/plan.md Phase 6. Read specs/tasks.md P6-01 through P6-09.

Phase 5 is approved. Proceed to Phase 6: Social Listening & Advanced AI.

The listening_queries and listening_mentions tables already exist in the migration.

1. Create src/app/api/listening/queries/route.ts — POST: create listening query (keywords, excluded keywords, platforms, languages). requireRole owner/admin. Plan check: social_listening must be true. GET: list queries for current org.

2. Create src/app/api/listening/queries/[id]/route.ts — GET: query details. PUT: update. DELETE: deactivate.

3. Create src/app/api/listening/queries/[id]/results/route.ts — GET: paginated mentions for this query. Filters: platform, sentiment, dateRange. Sort by posted_at desc.

4. Create src/lib/listening/crawler.ts — for each active listening query: search Twitter API v2 with keywords, search Instagram hashtags via Graph API. Normalize results into listening_mentions format. Run sentiment analysis on each mention.

5. Create src/app/api/cron/crawl-mentions/route.ts — Vercel Cron handler (every 15 min for pro+). Iterates active listening queries, calls crawler. Protected by CRON_SECRET.

6. Create src/app/api/ai/sentiment/route.ts — POST: accept text + optional language hint. Call OpenAI with a prompt engineered for Indian language sentiment analysis: "Analyze the sentiment of this social media text. It may be in English, Hindi, Hinglish, or another Indian language. Return: { score: -1 to 1, label: positive|negative|neutral|mixed, language_detected: string }". Parse JSON response.

7. Create src/app/api/listening/trends/route.ts — GET: aggregate mentions by keyword/day, calculate volume trends, identify spikes. Return time series + top trending keywords.

8. Create src/lib/listening/alerts.ts — after each crawl batch: check if negative sentiment count exceeds threshold (e.g., >50% negative in last hour, or 3x normal volume). If triggered: create notification for org owner with type 'crisis_alert'.

9. Create src/app/(dashboard)/listening/page.tsx — listening dashboard with: query list sidebar, main area showing mentions feed, sentiment donut chart, volume over time line chart, trending keywords cloud. "Create Query" button that opens a dialog. Each mention shows: author, platform, content, sentiment badge (colored), timestamp, link to original.

10. Create src/app/(dashboard)/listening/queries/[id]/page.tsx — detailed view for a single query: all mentions, sentiment breakdown, volume chart, crisis alert history.

TESTS:

11. Create tests/api/sentiment.test.ts — test sentiment API with positive English text, negative Hindi text, mixed Hinglish text. Mock OpenAI responses.
12. Create tests/lib/listening/alerts.test.ts — test alert threshold logic: normal volume no alert, spike triggers alert.

Run pnpm type-check && pnpm test && pnpm lint && pnpm build. Fix all errors. Report results.
```

## Gate Check 6

```bash
pnpm type-check && pnpm test && pnpm lint && pnpm build
```

---

# ============================================================================
# PHASE 7 — UI POLISH, i18n, ERROR STATES
# ============================================================================
# Goal: Production-quality UI, Hindi translation, loading/error/empty states, E2E tests.
# Time estimate: ~2 hours
# ============================================================================

## Prompt 7

```
Read CLAUDE.md and specs/plan.md Phase 7. Read specs/tasks.md P7-01 through P7-11.

Phase 6 is approved. Proceed to Phase 7: UI Polish, i18n & Error States.

This phase is about hardening — no new features, only quality improvements.

UI AUDIT:

1. Audit every page under src/app/(dashboard)/ and src/app/(auth)/. For each page:
   - If it fetches data: add a Skeleton loading state (use shadcn Skeleton component). Show skeleton while data loads.
   - If data fetch can fail: add an error boundary or try/catch with a user-friendly error card (icon + message + retry button). NEVER show raw error objects or stack traces.
   - If the data list can be empty: add an empty state with an illustration placeholder, descriptive text, and a primary action CTA (e.g., "No posts yet — Create your first post").
   - Verify consistent use of shadcn/ui components (no raw HTML buttons, inputs, etc.).

2. Create src/components/common/LoadingState.tsx — reusable skeleton layout for pages (header skeleton + content grid skeleton).

3. Create src/components/common/ErrorState.tsx — reusable error display: icon, title, message, "Try Again" button. Props: message, onRetry.

4. Create src/components/common/EmptyState.tsx — reusable empty state: icon, title, description, action button. Props: icon, title, description, actionLabel, actionHref.

5. Create src/app/error.tsx — global error boundary for the app. Shows ErrorState component. Logs to Sentry.

6. Create src/app/not-found.tsx — custom 404 page. "Page not found" with link back to dashboard.

MOBILE RESPONSIVE:

7. Test every page at 375px (mobile), 768px (tablet), 1280px (desktop) viewport widths. Fix any layout issues:
   - Sidebar should be hidden on mobile, shown via hamburger menu
   - Tables should horizontally scroll on mobile
   - Forms should be single-column on mobile
   - Content calendar should show day view on mobile instead of month
   - Inbox should show conversation list only on mobile, thread on tap

i18n:

8. Complete src/i18n/en.json with ALL user-facing strings from every page and component. Organize by section: auth, dashboard, publishing, inbox, analytics, listening, billing, settings, common.

9. Complete src/i18n/hi.json — full Hindi translation of every key in en.json. Use natural Hindi (not Google Translate quality). For technical terms that don't have good Hindi equivalents, keep the English word.

10. Create src/i18n/ta.json and src/i18n/te.json — stub files with same keys as en.json, values same as English for now (to be translated later). Just the structure needs to exist.

11. Create src/components/common/LanguageSwitcher.tsx — dropdown in the Header that lets user switch between English, हिन्दी, தமிழ், తెలుగు. Persist selection in user preferences (users.preferred_language) and localStorage.

12. Ensure every page uses the translation hook/function for all displayed text. No hardcoded English strings in components.

ACCESSIBILITY:

13. Audit all interactive elements: every button, link, input, and select must have an accessible label (aria-label or visible label). Add focus-visible outlines. Ensure tab order makes sense. Add aria-live regions for real-time inbox updates.

PERFORMANCE:

14. Add dynamic imports (next/dynamic) for heavy components: recharts charts, PostComposer, ContentCalendar, ReportBuilder. Show Skeleton while loading.

15. Add next/image for all images with proper width/height/alt props.

E2E TESTS:

16. Create e2e/auth.spec.ts — test: navigate to /dashboard (should redirect to /login), fill in registration form, verify lands on dashboard.

17. Create e2e/publishing.spec.ts — test: login, navigate to compose, type post content, select platform, click "Save Draft", verify appears in drafts.

18. Create e2e/inbox.spec.ts — test: login, navigate to inbox, verify page loads without error. If conversations exist, click one and verify thread loads.

19. Create e2e/billing.spec.ts — test: login, navigate to pricing, verify all plans display with INR prices.

Run pnpm type-check && pnpm test && pnpm lint && pnpm build && pnpm e2e. Fix all errors. Report results.
```

## Gate Check 7

```bash
pnpm type-check && pnpm test && pnpm lint && pnpm build && pnpm e2e
```

---

# ============================================================================
# PHASE 8 — SECURITY AUDIT & PRODUCTION DEPLOY
# ============================================================================
# Goal: Security hardened, observability confirmed, production live.
# Time estimate: ~1.5 hours
# ============================================================================

## Prompt 8

```
Read CLAUDE.md and specs/plan.md Phase 8. Read specs/tasks.md P8-01 through P8-14.

Phase 7 is approved. Final phase: Security Audit & Production Deploy.

SECURITY AUDIT — run each check and fix every issue found:

1. AUTH AUDIT: Run grep -rn "route.ts" src/app/api/ to list every API route file. For EACH route: verify it either (a) calls requireAuth() or getUser() at the top, or (b) is explicitly public (billing/plans, webhooks, marketing pages). List any unprotected routes and add auth checks.

2. ZOD AUDIT: For EACH API route that accepts a request body (POST/PUT): verify it parses the body with a Zod schema BEFORE any database call or business logic. List any routes missing validation and add Zod schemas.

3. RLS AUDIT: List all tables. Verify every table has ALTER TABLE ... ENABLE ROW LEVEL SECURITY in the migration. Verify every table (except public ones like plan_limits and indian_festivals) has SELECT, INSERT, UPDATE, DELETE policies appropriate to the data.

4. IDOR TEST: Write a test or script that: creates user A in org A, creates user B in org B. As user A, attempts to: read org B's posts, read org B's conversations, read org B's invoices. ALL must fail (403 or empty results). Document results.

5. SECRET LEAK CHECK: Run these commands and verify they return nothing:
   - grep -r 'SERVICE_ROLE' .next/static/
   - grep -r 'RAZORPAY_KEY_SECRET\|rzp_live' .next/static/
   - grep -r 'STRIPE_SECRET\|sk_live' .next/static/
   - grep -r 'MSG91_AUTH_KEY' .next/static/
   - grep -r 'OPENAI_API_KEY' .next/static/
   If any match, find the leak source and fix it.

6. WEBHOOK SECURITY: Verify every webhook handler verifies signatures:
   - /api/webhooks/meta — verifies X-Hub-Signature-256
   - /api/billing/webhook/razorpay — verifies X-Razorpay-Signature
   - /api/billing/webhook/stripe — verifies Stripe-Signature
   - /api/webhooks/twitter — verifies CRC signature

7. RATE LIMITING: Create src/lib/rate-limit.ts using Upstash Redis (@upstash/ratelimit). If UPSTASH_REDIS_REST_URL is not set, use a simple in-memory fallback. Add rate limiting to:
   - /api/auth/otp/send — 5 requests per phone per 10 minutes
   - /api/auth/otp/verify — 10 requests per phone per 10 minutes
   - /api/ai/* routes — 20 requests per org per minute
   - /api/connectors/*/auth — 10 requests per user per hour

8. DPDP COMPLIANCE:
   - Create src/app/api/account/export/route.ts — GET: exports all user data as JSON (user profile, org memberships, posts, conversations). requireAuth.
   - Create src/app/api/account/delete/route.ts — DELETE: deletes user account and all associated data. requireAuth. Confirmation required (accept body with { confirm: "DELETE MY ACCOUNT" }).
   - Create src/app/(dashboard)/settings/privacy/page.tsx — privacy settings: data export button, account deletion with confirmation.

9. INPUT SANITIZATION: Verify all user-generated content displayed in the UI is properly escaped (React does this by default with JSX, but check for any dangerouslySetInnerHTML usage — remove it or sanitize with DOMPurify).

OBSERVABILITY:

10. Verify PostHog is tracking these PMF events — add them if missing:
    - track('signed_up') in registration success handler
    - track('completed_core_action') when user publishes their first post
    - track('invited_user') when invitation is sent
    - track('started_checkout') when Razorpay checkout is initiated
    - track('converted_to_paid') in Razorpay payment.captured webhook handler

11. Verify Sentry is initialized in both:
    - src/app/layout.tsx or a client provider (client-side)
    - next.config.js or instrumentation.ts (server-side)
    Trigger a test error and confirm it would be captured.

12. Add security headers in next.config.js:
    ```
    headers: [{ source: '/(.*)', headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]}]
    ```

FINAL BUILD:

13. Run the complete quality pipeline:
    pnpm type-check && pnpm lint && pnpm test --coverage && pnpm build && pnpm e2e

14. Report:
    - Total number of API routes and how many have auth + Zod
    - Total number of tables and how many have RLS
    - Test coverage percentage
    - Any remaining warnings or issues
    - Confirmation that the build succeeds and is ready for vercel --prod

Do NOT deploy. Report results for human review.
```

## Gate Check 8 (HUMAN REVIEW — MANDATORY)

```bash
# Run full pipeline
pnpm type-check && pnpm lint && pnpm test --coverage && pnpm build && pnpm e2e

# Manual security checks:
# [ ] Open incognito → /dashboard → redirects to /login
# [ ] Register new user → can access dashboard
# [ ] Create second user in different org → cannot see first user's data
# [ ] grep -r 'SERVICE_ROLE\|SECRET\|sk_live\|rzp_live' .next/static/ → empty
# [ ] All webhook endpoints verify signatures
# [ ] Razorpay test checkout completes successfully
# [ ] PostHog events appear in dashboard
# [ ] Hindi UI is readable and complete

# If all pass:
vercel --prod
```

---

# ============================================================================
# POST-PHASE: QA PIPELINE (run after each phase if using multi-agent)
# ============================================================================

## QA Prompt (optional — run between phases for extra thoroughness)

```
Phase [N] is complete and the gate passed. Before proceeding to Phase [N+1], run a quality review:

1. CODE REVIEW: Read all files created or modified in Phase [N]. Check every rule in CLAUDE.md. List any violations in file:line:issue format.

2. TEST GAPS: Read all new source files. Identify functions and branches that lack test coverage. Write the missing Vitest tests to achieve ≥80% coverage on new files.

3. SECURITY CHECK: For every new API route: verify (a) auth check present, (b) Zod validation present, (c) no secrets leaked to client. For every new DB operation: verify RLS would catch unauthorized access. List any issues as CRITICAL (blocks next phase) or WARNING (fix before deploy).

4. TYPE SAFETY: Run pnpm type-check. If there are any errors, fix them. Also look for any usage of 'any', 'as any', '@ts-ignore', or '@ts-expect-error' — replace with proper types.

Report findings. Fix all CRITICAL issues before proceeding.
```
