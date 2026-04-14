# Agentic Build SOP — Quick Reference
# Adapted for SocialBharat from the full SOP document

## Pipeline
① CLAUDE.md → ② Spec (SDD) → ③ Scaffold → ④ Phase Build → ⑤ QA Pipeline → ⑥ Human Check → ⑦ Deploy

Each phase produces a verifiable artefact. No phase begins until the previous one passes its gate.

## Build Commands

### Phase Prompts for Claude Code
```bash
# Phase 0: Scaffold
claude "Read CLAUDE.md. Scaffold the Next.js project with all dependencies from the stack. Set up Supabase, CI/CD, pre-commit hooks. Run pnpm type-check to confirm."

# Phase 1: Auth
claude "Read CLAUDE.md and specs/plan.md Phase 1. Implement auth with phone OTP, email/password, Google OAuth, org management, RBAC. Write Vitest tests. Run pnpm type-check && pnpm test. Do not proceed to Phase 2."

# Phase 2: Publishing
claude "Phase 1 approved. Read specs/plan.md Phase 2. Implement social connectors, post composer, scheduling, content calendar, festival suggestions, AI content assist, media library. Write tests. Report when complete."

# Phase 3: Engagement
claude "Phase 2 approved. Read specs/plan.md Phase 3. Implement unified inbox, webhook handlers, real-time messages, conversation management, WhatsApp inbox, smart replies. Write tests. Report when complete."

# Phase 4: Billing
claude "Phase 3 approved. Read specs/plan.md Phase 4. Implement Razorpay checkout, webhooks with idempotency, GST calculation, invoice generation, plan enforcement. Write tests. Report when complete."

# Phase 5: Analytics
claude "Phase 4 approved. Read specs/plan.md Phase 5. Implement analytics dashboard, metrics collection, custom reports, PDF export. Write tests. Report when complete."

# Phase 6: Listening
claude "Phase 5 approved. Read specs/plan.md Phase 6. Implement social listening, sentiment analysis, trend detection, crisis alerts. Write tests. Report when complete."

# Phase 7: Polish
claude "Phase 6 approved. Read specs/plan.md Phase 7. UI polish: loading states, error states, empty states, mobile responsive, Hindi i18n, accessibility. Write Playwright E2E tests."

# Phase 8: Security & Deploy
claude "Phase 7 approved. Read specs/plan.md Phase 8. Security audit all API routes for auth + Zod + RLS. Implement rate limiting. DPDP compliance. Prepare for production deploy."
```

### QA Pipeline (after each phase)
```bash
claude --agents 4 "
Phase N is complete. Run the QA pipeline in parallel.

Agent 1 — Code Reviewer: Read all changed files. Check every CLAUDE.md rule. Output: /qa/review.md
Agent 2 — Test Writer: Find untested edge cases. Write missing tests for ≥80% coverage. Output: test files
Agent 3 — Security Auditor: Check API routes for missing auth, unvalidated input, exposed secrets, missing RLS. Output: /qa/security.md
Agent 4 — E2E Test Writer: Write Playwright tests for Phase N happy path + one error path. Output: e2e/phase-N.spec.ts
"
```

### Daily Development Commands
```bash
pnpm dev              # Start Next.js dev server
pnpm build            # Production build
pnpm type-check       # TypeScript check (tsc --noEmit)
pnpm lint             # ESLint
pnpm test             # Vitest unit tests
pnpm test --coverage  # With coverage report
pnpm e2e              # Playwright E2E tests
supabase start        # Start local Supabase
supabase db push      # Push migrations to linked project
supabase migration new # Create new migration file
```

### Deploy Commands
```bash
vercel            # Deploy preview
vercel --prod     # Deploy production
vercel logs [url] # Tail production logs
vercel env ls     # List environment variables
vercel rollback   # Rollback to previous deployment
```

## Quality Red Flags
Stop and fix immediately if you see:
- `as any` or `@ts-ignore` — agent is hiding type errors
- API route without Zod schema validation
- Auth check using cookies/headers directly without Supabase getUser()
- Webhook handler without signature verification
- Supabase query without RLS filter on user-owned data
- console.log in production code paths
- Hardcoded values that should be environment variables

## Human Review Checklist (before each deploy)
- [ ] Logged-out user cannot access /dashboard (incognito test)
- [ ] Session cookie is HttpOnly and Secure
- [ ] No SERVICE_ROLE_KEY in client bundle: `grep -r 'SERVICE_ROLE' .next/static/`
- [ ] RLS enabled on every table (check Supabase Studio)
- [ ] Users cannot read each other's data (2-user test)
- [ ] Razorpay webhook signature verification active
- [ ] Webhook idempotency: same event twice → single DB write
- [ ] No stack traces exposed to users (kill DB, check UI)
- [ ] All API routes return typed error responses
- [ ] Network offline → no white screens

## PMF Events to Track (PostHog)
```typescript
track('signed_up', { method: 'phone_otp' | 'email' | 'google' })
track('completed_core_action', { action: 'published_post', platform: '...' })
track('invited_user', { role: '...' })
track('started_checkout', { plan: '...' })
track('converted_to_paid', { plan: '...', amount_inr: ... })
```

### Decision Thresholds (14 days post-launch)
- KILL: completed_core_action < 20% of signed_up
- INVESTIGATE: started_checkout < 5% of completed_core_action
- DOUBLE DOWN: ≥3 organic referrals in first week
- SCALE: converted_to_paid ≥ 5% of signed_up within 14 days
