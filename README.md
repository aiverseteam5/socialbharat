# SocialBharat 🇮🇳

> AI-powered, India-first social media management platform

## What is this?

SocialBharat is a full-featured social media management SaaS — think Sprout Social + Hootsuite, but built for the Indian market with:

- **WhatsApp Business** as a first-class channel (500M+ users in India)
- **22 Indian language** support with AI content generation
- **INR pricing** with UPI/Razorpay payments and GST-compliant invoicing
- **Indian Festival Calendar** with 50+ festivals and AI-generated content suggestions
- **Regional platform support** (ShareChat, Moj) alongside global platforms

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui |
| Backend | Next.js API Routes + Server Actions |
| Database | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Payments | Razorpay (India) + Stripe (International) |
| AI | OpenAI GPT-4 |
| SMS/OTP | MSG91 |
| Email | Resend |
| Analytics | PostHog |
| Error Tracking | Sentry |
| Rate Limiting | Upstash Redis |
| Deployment | Vercel |

## Project Structure

```
socialbharat/
├── CLAUDE.md                    ← Project constitution (READ FIRST)
├── .env.example                 ← All required environment variables
├── docs/
│   ├── prd.md                   ← Product Requirements Document
│   ├── architecture/
│   │   └── system-overview.md   ← System architecture & data flows
│   └── sop/
│       └── agentic-build-sop.md ← Build process & QA pipeline
├── specs/
│   ├── requirements.md          ← User stories with acceptance criteria
│   ├── solution.md              ← Data model, API design, auth flows
│   ├── plan.md                  ← Phased build plan (8 phases)
│   └── tasks.md                 ← Atomic task list per phase
├── supabase/
│   └── migrations/
│       ├── 00001_initial_schema.sql  ← Complete DB schema + RLS
│       └── 00002_seed_festivals.sql  ← 50+ Indian festivals seed data
└── .github/
    └── workflows/
        ├── ci.yml               ← CI pipeline (lint → type-check → test → build)
        └── deploy.yml           ← Production deploy to Vercel
```

## Getting Started with Claude Code

### Prerequisites
- Node.js 20 LTS
- pnpm
- Claude Code (`npm install -g @anthropic-ai/claude-code`)
- Vercel CLI (`npm install -g vercel`)
- Supabase CLI (`npm install -g supabase`)

### Step 1: Read the constitution
```bash
cat CLAUDE.md  # Understand the rules before writing any code
```

### Step 2: Start Phase 0 (Scaffold)
```bash
claude "Read CLAUDE.md. Execute Phase 0 from specs/plan.md. Scaffold the Next.js project, install all dependencies, set up Supabase, configure CI/CD and pre-commit hooks. Confirm with pnpm type-check."
```

### Step 3: Build phase by phase
Follow the prompts in `docs/sop/agentic-build-sop.md` — each phase has an exact Claude Code prompt and a gate that must pass before proceeding.

## Build Phases

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| 0 | Scaffold | Project setup, CI/CD, empty shell on Vercel |
| 1 | Auth | Phone OTP, email, OAuth, RBAC, org management |
| 2 | Publishing | Social connectors, post composer, scheduling, calendar, AI content |
| 3 | Engagement | Unified inbox, WhatsApp, real-time messages, smart replies |
| 4 | Billing | Razorpay, UPI, GST invoicing, plan enforcement |
| 5 | Analytics | Dashboard, metrics, custom reports, PDF export |
| 6 | Listening | Brand monitoring, sentiment analysis, crisis alerts |
| 7 | Polish | UI consistency, i18n, accessibility, E2E tests |
| 8 | Deploy | Security audit, rate limiting, DPDP compliance, production launch |

## Key Files for Claude Code

When starting a Claude Code session, ensure the agent reads these files:

1. **CLAUDE.md** — Project rules, stack, conventions (always read first)
2. **specs/plan.md** — Which phase to work on and what to build
3. **specs/tasks.md** — Atomic task list for the current phase
4. **specs/solution.md** — Data model, API design, auth flows (reference)
5. **specs/requirements.md** — User stories with acceptance criteria (reference)

## License

Proprietary — All rights reserved.
