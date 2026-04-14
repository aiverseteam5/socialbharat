# CLAUDE.md — Project Constitution
# Read this file at the start of every session.

## Project
Name: SocialBharat
Purpose: AI-powered, India-first social media management platform (reverse-engineering Sprout Social & Hootsuite with Indian market enhancements)
Stack: Next.js 15 App Router | TypeScript strict | Tailwind CSS v3.4 | shadcn/ui
       Supabase (Postgres + Auth + Storage) | Razorpay (payments) | Resend (email) | Vercel

## Directory Structure
```
src/app/                  — Next.js pages and API routes (App Router)
src/components/           — Reusable UI components (shadcn/ui + custom)
  layout/                 — Sidebar, Header, MobileNav
  publishing/             — PostComposer, ContentCalendar, PlatformPreview, FestivalSuggestions, AIContentAssist
  inbox/                  — ConversationList, MessageThread, WhatsAppInbox, SmartReply
  analytics/              — OverviewDashboard, MetricCard, ChartContainer, ReportBuilder
  common/                 — LanguageSwitcher, IndianCurrencyDisplay
src/lib/                  — Utility functions, Supabase client, Razorpay client, API helpers
src/types/                — TypeScript type definitions and Zod schemas
src/hooks/                — Custom React hooks (useAuth, useSocialProfiles, usePublishing, useInbox, useAnalytics, useRealtime)
src/stores/               — Zustand state stores (auth-store, inbox-store, publishing-store)
src/i18n/                 — Internationalization files (en, hi, ta, te, bn, mr)
supabase/                 — Migrations, seed data, RLS policies
tests/                    — Vitest unit tests
e2e/                      — Playwright end-to-end tests
docs/                     — Architecture docs, API contracts, runbooks
specs/                    — Requirements, solution design, plan, tasks
```

## Hard Rules — Never Violate
- Zero `any` types. Use `unknown` + type guards if type is uncertain.
- All secrets via environment variables. Never hardcode keys, tokens, or credentials.
- Every API route: parse body/params with Zod schema before any DB call or business logic.
- All auth checks server-side using `getUser()` in server components/actions. Never trust client claims.
- RLS must be enabled on every Supabase table. No exceptions.
- No raw SQL strings. Use Supabase typed client only.
- Write tests alongside new features, never after.
- Explain your plan before writing code on complex tasks.
- Never commit directly to main. Always use a feature branch.
- No `console.log` in production code paths. Use structured logging.
- No `@ts-ignore` or `as any` — fix the type error, don't suppress it.
- Razorpay webhook handler: verify signature before processing. Use idempotency checks.
- All user-facing text must support i18n (use translation keys, not hardcoded strings).
- Phone-first auth pattern: Indian users prefer OTP over email/password.

## India-Specific Requirements
- Default currency: INR (₹). All prices displayed in Indian numbering system (lakhs/crores).
- Payment gateway: Razorpay (UPI, net banking, cards, wallets). Stripe as international fallback.
- GST compliance: All invoices must show GSTIN, HSN/SAC code (998314), CGST/SGST or IGST breakdown.
- Languages: Support en, hi (Hindi), ta (Tamil), te (Telugu), bn (Bengali), mr (Marathi) minimum.
- Festival calendar: Pre-load 50+ Indian festivals with content suggestions.
- WhatsApp Business API integration is critical — 500M+ users in India.
- Indian platform support: ShareChat, Moj (in addition to FB, IG, Twitter, LinkedIn, YouTube).
- Data residency: All data stored in ap-south-1 (Mumbai) region.
- DPDP Act compliance: India's data protection law.
- Time zone: IST (UTC+5:30) as default, with smart scheduling optimized for Indian audiences.

## Supported Social Platforms
- Facebook Pages (Meta Graph API)
- Instagram Business (Meta Graph API)
- Twitter/X (Twitter API v2)
- LinkedIn Pages (LinkedIn API)
- YouTube (YouTube Data API)
- WhatsApp Business (WhatsApp Cloud API) — **highest priority for India**
- ShareChat (Partner API) — India-specific
- Moj — India-specific
- Google Business Profile

## Definition of Done Per Phase
- `pnpm type-check` exits 0 (tsc --noEmit)
- `pnpm test` exits 0 with ≥80% coverage on new files
- `pnpm lint` exits 0
- `pnpm build` exits 0
- No TODO comments left in changed files
- Auth-related changes: human review required before merge
- All new tables have RLS policies
- All new API routes have Zod validation
- All new components handle loading, error, and empty states
- Mobile responsive: tested at 375px, 768px, 1280px

## Environment Variables Required
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          # server-only, never expose to client

# Razorpay
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET                # server-only
RAZORPAY_WEBHOOK_SECRET            # server-only

# Stripe (international fallback)
STRIPE_SECRET_KEY                  # server-only
STRIPE_WEBHOOK_SECRET              # server-only

# Email
RESEND_API_KEY                     # server-only

# SMS/OTP
MSG91_AUTH_KEY                     # server-only
MSG91_TEMPLATE_ID

# AI Services
OPENAI_API_KEY                     # server-only
ANTHROPIC_API_KEY                  # server-only

# Social Platform APIs
META_APP_ID
META_APP_SECRET                    # server-only
TWITTER_API_KEY
TWITTER_API_SECRET                 # server-only
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET             # server-only
YOUTUBE_API_KEY
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN              # server-only

# Analytics
NEXT_PUBLIC_POSTHOG_KEY
POSTHOG_HOST

# Error Tracking
SENTRY_DSN
```

## Key Architecture Decisions
1. **Monolithic Next.js app** (not microservices) for MVP speed — following SOP guidance.
2. **Supabase** for DB + Auth + Storage + Realtime — single platform agents can scaffold end-to-end.
3. **Server Actions** for mutations, API routes for webhooks and external integrations.
4. **Zustand** for client state management (lightweight, TypeScript-first).
5. **Razorpay** as primary payment gateway (India-first), Stripe as international option.
6. **Edge functions** for performance-critical paths (API gateway, rate limiting).
7. **Supabase Realtime** for live inbox updates (instead of custom WebSocket server).
8. **ClickHouse** deferred to Phase 4 — use Supabase Postgres for analytics MVP.

## Agent Workflow
- Follow the phase-by-phase build process defined in specs/plan.md
- After each phase: run `pnpm type-check && pnpm test && pnpm lint && pnpm build`
- Do not proceed to next phase until current phase gates pass
- Report completion of each phase for human review before proceeding
