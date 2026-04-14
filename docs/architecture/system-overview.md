# Architecture Overview
# SocialBharat — System Design

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Web App   │  │  Mobile Web  │  │  Public API (v1)   │  │
│  │  Next.js   │  │  Responsive  │  │  REST + Webhooks   │  │
│  └─────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
└────────┼────────────────┼───────────────────┼──────────────┘
         │                │                   │
┌────────▼────────────────▼───────────────────▼──────────────┐
│              VERCEL EDGE NETWORK                           │
│  ┌────────────────────────────────────────────────────────┐│
│  │  Next.js App Router (SSR + API Routes + Server Actions)││
│  │  • Auth middleware (session validation)                 ││
│  │  • Rate limiting (Upstash Redis)                       ││
│  │  • API routes for webhooks & integrations              ││
│  │  • Server Actions for mutations                        ││
│  └────────────────────────┬───────────────────────────────┘│
└───────────────────────────┼────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│                    SUPABASE CLOUD                           │
│  ┌──────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│  │PostgreSQL│  │  Auth   │  │ Storage │  │  Realtime   │  │
│  │  + RLS   │  │ (JWT)  │  │  (S3)   │  │ (WebSocket) │  │
│  └──────────┘  └─────────┘  └─────────┘  └─────────────┘  │
└────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│                EXTERNAL SERVICES                            │
│  ┌──────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│  │ Razorpay │  │  MSG91  │  │ OpenAI  │  │ Social APIs │  │
│  │(Payments)│  │  (OTP)  │  │  (AI)   │  │ (Meta, X,..)│  │
│  └──────────┘  └─────────┘  └─────────┘  └─────────────┘  │
│  ┌──────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│  │  Resend  │  │ PostHog │  │ Sentry  │  │  Upstash    │  │
│  │ (Email)  │  │(Analyt.)│  │(Errors) │  │  (Redis)    │  │
│  └──────────┘  └─────────┘  └─────────┘  └─────────────┘  │
└────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Monolithic Next.js (not microservices) for MVP
- Single deployable unit on Vercel
- Faster development with AI agents (single codebase)
- Server Actions for mutations, API routes for webhooks
- Can decompose later when scale demands it

### 2. Supabase as Backend Platform
- PostgreSQL with Row Level Security = multi-tenant isolation
- Built-in Auth (email, phone, OAuth)
- Realtime subscriptions for live inbox
- Storage for media assets with CDN
- Edge Functions for background jobs

### 3. India-First Architecture
- Supabase project in Mumbai region (ap-south-1)
- Razorpay as primary payment gateway (UPI, net banking)
- MSG91 for SMS OTP (best delivery rates in India)
- IST timezone as default
- Hindi as first supported regional language

### 4. Encryption Strategy
- Social platform tokens encrypted with AES-256 before storing
- Encryption key in environment variable (never in code)
- Supabase handles auth token management
- All communication over HTTPS

## Data Flow Diagrams

### Publishing Flow
```
User creates post → Validate with Zod → Store in posts table (status: draft)
  → User clicks Publish → Server Action → For each platform:
    → Decrypt access token → Call platform API → Collect result
  → Update post status (published/failed/partially_failed)
  → Store publish_results JSONB
  → Emit notification
```

### Scheduling Flow
```
User schedules post → Store with status: 'scheduled', scheduled_at: timestamp
  → Vercel Cron job runs every minute
  → Query: SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_at <= NOW()
  → For each due post: execute publish flow
  → Update status based on results
```

### Inbox Flow
```
External message → Platform webhook → /api/webhooks/meta (verify signature)
  → Parse message payload → Upsert contact → Upsert conversation
  → Insert message → Update conversation.last_message_at
  → Supabase Realtime broadcasts to connected clients
  → User sees new message in real-time (no refresh needed)
```

### Billing Flow
```
User selects plan → POST /api/billing/checkout → Create Razorpay order
  → Redirect to Razorpay checkout (UPI/card/netbanking)
  → Payment success → Razorpay webhook → /api/billing/webhook/razorpay
  → Verify signature → Check idempotency (webhook_events table)
  → Update org.plan → Generate GST invoice → Send confirmation email
```

## Scaling Path (Post-MVP)

When user count exceeds Supabase/Vercel comfortable limits:

1. **Extract AI service** → Python FastAPI on Railway/Render (GPU for inference)
2. **Extract publishing worker** → Background job service (Inngest or Trigger.dev)
3. **Extract analytics** → ClickHouse for OLAP queries
4. **Add Redis** → Upstash Redis for caching and rate limiting (already in stack)
5. **Add CDN** → Cloudflare in front of Vercel for DDoS protection
6. **Database scaling** → Supabase connection pooling, read replicas
