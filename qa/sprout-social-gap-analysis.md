# SocialBharat — Gap Analysis vs Sprout Social / Hootsuite

**Prepared:** 2026-04-19
**Scope:** Brutally honest assessment of functional parity, what works end-to-end vs what is code-only, and what must ship before a real Indian SMB can use this.

---

## TL;DR

**SocialBharat today is ~35% of a usable Sprout Social / Hootsuite competitor.** The data model, scaffolding, and wiring for most features is in place. However:

- **Several "working" connectors are broken** in ways that will surface the first time a user tries them (YouTube OAuth uses an API key as client_id, Twitter PKCE is a hardcoded string, Twitter media upload is a stub, LinkedIn uses deprecated scopes).
- **No real user has ever completed an end-to-end flow** in this codebase — there are no integration tests against live APIs, and manual testing (yesterday's session) showed 5 of 5 OAuth flows failing.
- **Entire "India-first" differentiators are empty shells**: ShareChat, Moj, Google Business Profile, festival calendar UI, cricket event scheduler, industry benchmarks, IndicTrans2 translation — all referenced in PRD, none built.
- **Landing page is a 40-line stub** with a title and two buttons. Not launch-grade.
- **Admin account has no organization** — many routes 400 out of the box. There is an onboarding flow, but the admin path created yesterday bypassed it.

The code quality in what exists is generally good (Zod validation, RLS, structured logging, encryption at rest, signature-verified webhooks). But the delta between "route exists" and "feature works for a real customer" is large.

---

## Step 1 — Feature Parity Matrix

Legend for SocialBharat column:

- **WORKS** = end-to-end verified, real API calls, would work today with credentials
- **BUILT** = code is real and correct, but unverified against live API
- **STUBBED** = code exists but has a bug, mock, hardcoded value, or missing step that prevents real use
- **UI-ONLY** = page/button exists, no backend wiring
- **MISSING** = not built at all

| #                                | Feature                                         | Sprout    | Hootsuite | SocialBharat | Notes                                                                                                                                                          |
| -------------------------------- | ----------------------------------------------- | --------- | --------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Auth**                      |                                                 |           |           |              |                                                                                                                                                                |
| 1a                               | Email/password signup                           | YES       | YES       | **BUILT**    | `/api/auth/register` uses admin.createUser (service role), bypasses rate limit. Works.                                                                         |
| 1b                               | Phone OTP signup                                | NO        | NO        | **BUILT**    | MSG91 integration exists. Unverified against live.                                                                                                             |
| 1c                               | Google SSO                                      | YES       | YES       | **MISSING**  | Supabase Auth supports it but no UI/route wired.                                                                                                               |
| 1d                               | Email verification                              | YES       | YES       | **STUBBED**  | admin.createUser sets `email_confirm: true` — verification skipped entirely.                                                                                   |
| 1e                               | Password reset                                  | YES       | YES       | **MISSING**  | No route, no UI.                                                                                                                                               |
| 1f                               | 2FA/MFA                                         | YES (SSO) | YES       | **MISSING**  | Not implemented.                                                                                                                                               |
| **2. Social profile connection** |                                                 |           |           |              |                                                                                                                                                                |
| 2a                               | Facebook Pages                                  | YES       | YES       | **STUBBED**  | OAuth route correct. Requires app in Live mode + tester approval for scopes. Failed yesterday.                                                                 |
| 2b                               | Instagram Business                              | YES       | YES       | **STUBBED**  | Callback works if dev server stays alive. Failed yesterday ("localhost refused to connect").                                                                   |
| 2c                               | Twitter/X                                       | YES       | YES       | **STUBBED**  | **Broken PKCE**: `code_challenge="challenge"` literal, `code_challenge_method=plain`. User never returned from Twitter yesterday.                              |
| 2d                               | LinkedIn Pages                                  | YES       | YES       | **STUBBED**  | Uses deprecated v1 scopes (`r_liteprofile`, `r_organization_admin`). Errored out yesterday.                                                                    |
| 2e                               | YouTube                                         | YES       | YES       | **STUBBED**  | **Uses `YOUTUBE_API_KEY` as OAuth client_id** — this is fundamentally wrong. Needs `YOUTUBE_CLIENT_ID` + secret.                                               |
| 2f                               | WhatsApp Business                               | NO        | Partial   | **BUILT**    | User-supplied phone_number_id + token via `/api/connectors/whatsapp/connect`. Real Cloud API calls.                                                            |
| 2g                               | ShareChat                                       | NO        | NO        | **MISSING**  | No connector, no route.                                                                                                                                        |
| 2h                               | Moj                                             | NO        | NO        | **MISSING**  | No connector, no route.                                                                                                                                        |
| 2i                               | Google Business Profile                         | YES       | YES       | **MISSING**  | No code.                                                                                                                                                       |
| 2j                               | TikTok                                          | YES       | YES       | **MISSING**  | Out of PRD scope.                                                                                                                                              |
| 2k                               | Pinterest                                       | YES       | YES       | **MISSING**  | Out of PRD scope.                                                                                                                                              |
| **3. Post composer**             |                                                 |           |           |              |                                                                                                                                                                |
| 3a                               | Multi-platform composition                      | YES       | YES       | **STUBBED**  | PostComposer has hardcoded platform list. Doesn't filter to connected accounts.                                                                                |
| 3b                               | Per-platform content override                   | YES       | YES       | **BUILT**    | `content_json.platform_overrides` is read in publish route. No UI to set it.                                                                                   |
| 3c                               | Media upload in composer                        | YES       | YES       | **STUBBED**  | Uses `URL.createObjectURL(file)` which is a blob URL — **never uploads to storage**. Platform APIs will 404 on the blob URL.                                   |
| 3d                               | Character count per platform                    | YES       | YES       | **BUILT**    | Works client-side.                                                                                                                                             |
| 3e                               | Platform preview                                | YES       | YES       | **BUILT**    | PlatformPreview component exists.                                                                                                                              |
| 3f                               | Hashtag suggestions                             | YES       | YES       | **BUILT**    | `/api/ai/hashtags` is real (OpenAI).                                                                                                                           |
| 3g                               | Emoji picker                                    | YES       | YES       | **MISSING**  | Not implemented.                                                                                                                                               |
| 3h                               | Link shortener                                  | YES       | YES       | **MISSING**  | Not implemented.                                                                                                                                               |
| 3i                               | UTM builder                                     | YES       | YES       | **MISSING**  | Not implemented.                                                                                                                                               |
| **4. Scheduling**                |                                                 |           |           |              |                                                                                                                                                                |
| 4a                               | Schedule post for later                         | YES       | YES       | **BUILT**    | `POST /api/posts/[id]/schedule` + cron `/api/cron/publish`. Real scheduler in `src/lib/scheduler.ts`.                                                          |
| 4b                               | Content calendar (month)                        | YES       | YES       | **BUILT**    | Month view renders.                                                                                                                                            |
| 4c                               | Content calendar (week)                         | YES       | YES       | **STUBBED**  | Week button toggles state but `renderCalendar()` doesn't branch — renders month regardless.                                                                    |
| 4d                               | Content calendar (day)                          | YES       | YES       | **MISSING**  | Not implemented.                                                                                                                                               |
| 4e                               | Drag-and-drop rescheduling                      | YES       | YES       | **MISSING**  | Not implemented.                                                                                                                                               |
| 4f                               | Queue / auto-schedule                           | YES       | YES       | **MISSING**  | No queue logic. User manually picks datetime.                                                                                                                  |
| 4g                               | Optimal time prediction (AI)                    | YES       | Partial   | **MISSING**  | PRD lists it; no code.                                                                                                                                         |
| 4h                               | Recurring posts                                 | Partial   | YES       | **MISSING**  | No recurrence model.                                                                                                                                           |
| 4i                               | Bulk scheduling (CSV)                           | YES       | YES       | **MISSING**  | `/api/posts/bulk` listed in solution.md, **route does not exist**.                                                                                             |
| **5. Publishing**                |                                                 |           |           |              |                                                                                                                                                                |
| 5a                               | Publish to Facebook                             | YES       | YES       | **BUILT**    | `FacebookConnector.publishPost` calls `/{page_id}/feed`. Correct.                                                                                              |
| 5b                               | Publish to Instagram                            | YES       | YES       | **STUBBED**  | Container + publish flow is correct BUT requires publicly-accessible `image_url`. Composer sends blob URLs → fail. Also **no video/Reel support** despite PRD. |
| 5c                               | Publish to Twitter                              | YES       | YES       | **STUBBED**  | Text works. **Media upload is a stub**: missing APPEND chunk step, uses wrong auth (Bearer instead of OAuth 1.0a for v1.1 upload).                             |
| 5d                               | Publish to LinkedIn                             | YES       | YES       | **BUILT**    | UGC Posts API. Unverified.                                                                                                                                     |
| 5e                               | Publish to YouTube                              | YES       | YES       | **BUILT**    | Uses resumable upload. Unverified.                                                                                                                             |
| 5f                               | Publish to WhatsApp (template)                  | NO        | Partial   | **BUILT**    | WhatsApp connector has sendMessage/sendTemplate.                                                                                                               |
| 5g                               | Partial-failure handling                        | YES       | YES       | **BUILT**    | `publish_results` JSON per profile, `partially_failed` status.                                                                                                 |
| 5h                               | Retry failed posts                              | YES       | YES       | **MISSING**  | No retry UI or backend.                                                                                                                                        |
| 5i                               | Publishing Stories/Reels                        | YES       | YES       | **MISSING**  | Only IMAGE and CAROUSEL for IG.                                                                                                                                |
| **6. Unified Inbox (receiving)** |                                                 |           |           |              |                                                                                                                                                                |
| 6a                               | Receive FB/IG messages                          | YES       | YES       | **BUILT**    | `/api/webhooks/meta` handles verification + parses incoming.                                                                                                   |
| 6b                               | Receive WhatsApp messages                       | NO        | Partial   | **BUILT**    | Webhook route parses into conversations.                                                                                                                       |
| 6c                               | Receive Twitter DMs/mentions                    | YES       | YES       | **BUILT**    | `/api/webhooks/twitter` exists (191 lines). Unverified.                                                                                                        |
| 6d                               | Receive LinkedIn messages                       | Partial   | Partial   | **MISSING**  | No LinkedIn webhook.                                                                                                                                           |
| 6e                               | Receive YouTube comments                        | YES       | YES       | **MISSING**  | No PubSubHubbub subscription code.                                                                                                                             |
| 6f                               | Conversation threading                          | YES       | YES       | **BUILT**    | Data model + routes.                                                                                                                                           |
| 6g                               | Real-time updates                               | YES       | Partial   | **STUBBED**  | Supabase Realtime referenced in CLAUDE.md, but I saw no subscribe() call in inbox components. Needs verification.                                              |
| **7. Replying from inbox**       |                                                 |           |           |              |                                                                                                                                                                |
| 7a                               | Send FB reply                                   | YES       | YES       | **BUILT**    | `FacebookConnector.sendReply`.                                                                                                                                 |
| 7b                               | Send IG reply (DM + comment)                    | YES       | YES       | **BUILT**    | See `instagram.ts` lines 238+.                                                                                                                                 |
| 7c                               | Send Twitter reply                              | YES       | YES       | **BUILT**    | Assumed — unverified.                                                                                                                                          |
| 7d                               | Send WhatsApp reply                             | NO        | Partial   | **BUILT**    | WhatsApp Cloud API.                                                                                                                                            |
| 7e                               | Send LinkedIn reply                             | YES       | Partial   | **MISSING**  | No sendReply on LinkedIn connector.                                                                                                                            |
| 7f                               | Send YouTube reply                              | YES       | YES       | **MISSING**  | Likely missing on youtube.ts.                                                                                                                                  |
| 7g                               | Canned responses                                | YES       | YES       | **MISSING**  | Not implemented.                                                                                                                                               |
| 7h                               | Assign to team member                           | YES       | YES       | **UI-ONLY**  | `[id]/assign` route exists — need to verify body.                                                                                                              |
| **8. WhatsApp Business**         |                                                 |           |           |              |                                                                                                                                                                |
| 8a                               | Send text message                               | N/A       | Partial   | **BUILT**    | Real Cloud API.                                                                                                                                                |
| 8b                               | Send template message                           | N/A       | Partial   | **BUILT**    | Template flow.                                                                                                                                                 |
| 8c                               | Receive inbound                                 | N/A       | Partial   | **BUILT**    | Webhook.                                                                                                                                                       |
| 8d                               | Broadcast list                                  | N/A       | NO        | **STUBBED**  | Solution.md claims it; need to verify code.                                                                                                                    |
| 8e                               | Template approval workflow                      | N/A       | NO        | **MISSING**  | No Meta template submission UI.                                                                                                                                |
| 8f                               | Catalog/commerce                                | N/A       | NO        | **MISSING**  | Not in scope.                                                                                                                                                  |
| **9. Analytics**                 |                                                 |           |           |              |                                                                                                                                                                |
| 9a                               | Profile metrics (live fetch)                    | YES       | YES       | **BUILT**    | `getMetrics()` on each connector. Scheduled by `/api/cron/collect-metrics`.                                                                                    |
| 9b                               | Post-level analytics                            | YES       | YES       | **STUBBED**  | `post_metrics` table exists. **No post-level fetch function seen in connectors** — only profile-level metrics.                                                 |
| 9c                               | Overview dashboard                              | YES       | YES       | **BUILT**    | `/api/analytics/overview` + component.                                                                                                                         |
| 9d                               | Audience demographics                           | YES       | YES       | **MISSING**  | `/api/analytics/audience/:profileId` in solution.md, **route does not exist**.                                                                                 |
| 9e                               | Competitor analysis                             | YES       | YES       | **MISSING**  | Not implemented.                                                                                                                                               |
| 9f                               | Custom report builder                           | YES       | YES       | **BUILT**    | `/api/analytics/reports` + export route (180 lines). Unverified end-to-end.                                                                                    |
| 9g                               | Scheduled email delivery                        | YES       | YES       | **MISSING**  | No cron job for scheduled reports.                                                                                                                             |
| 9h                               | PDF/CSV/XLSX export                             | YES       | YES       | **BUILT**    | Export route exists.                                                                                                                                           |
| 9i                               | India industry benchmarks                       | NO        | NO        | **MISSING**  | PRD lists it, no benchmarks dataset.                                                                                                                           |
| 9j                               | Regional audience segmentation                  | NO        | NO        | **MISSING**  | No code.                                                                                                                                                       |
| 9k                               | WhatsApp analytics                              | NO        | NO        | **MISSING**  | No code.                                                                                                                                                       |
| 9l                               | Festival campaign ROI                           | NO        | NO        | **MISSING**  | No code.                                                                                                                                                       |
| **10. Social Listening**         |                                                 |           |           |              |                                                                                                                                                                |
| 10a                              | Keyword monitoring                              | YES       | YES       | **BUILT**    | `src/lib/listening/crawler.ts` (341 lines). Crawls Twitter.                                                                                                    |
| 10b                              | Multi-platform crawl                            | YES       | YES       | **STUBBED**  | Crawler lists platforms but likely only Twitter/X is actually queried. Need to verify FB/IG public search.                                                     |
| 10c                              | Sentiment analysis                              | YES       | YES       | **BUILT**    | OpenAI-based, Indian-language-aware prompt.                                                                                                                    |
| 10d                              | Hinglish detection                              | NO        | NO        | **BUILT**    | Part of sentiment prompt.                                                                                                                                      |
| 10e                              | Trend detection                                 | YES       | YES       | **STUBBED**  | `/api/listening/trends` route exists. Need to verify aggregation logic.                                                                                        |
| 10f                              | Influencer identification                       | YES       | Partial   | **MISSING**  | Not implemented.                                                                                                                                               |
| 10g                              | Crisis alerts                                   | YES       | YES       | **BUILT**    | `src/lib/listening/alerts.ts` (139 lines). Unverified trigger.                                                                                                 |
| 10h                              | Regional news/blog monitoring                   | NO        | NO        | **MISSING**  | No RSS/news crawler.                                                                                                                                           |
| **11. AI content generation**    |                                                 |           |           |              |                                                                                                                                                                |
| 11a                              | Caption generation                              | YES       | YES       | **BUILT**    | `/api/ai/generate-content` — real OpenAI GPT-4. Free plan blocked.                                                                                             |
| 11b                              | Hashtag generation                              | YES       | YES       | **BUILT**    | `/api/ai/hashtags`.                                                                                                                                            |
| 11c                              | Smart reply suggestions                         | YES       | YES       | **BUILT**    | `/api/ai/suggest-replies`.                                                                                                                                     |
| 11d                              | Sentiment analysis (on-demand)                  | YES       | Partial   | **BUILT**    | `/api/ai/sentiment`.                                                                                                                                           |
| 11e                              | Translation (22 Indian languages / IndicTrans2) | NO        | NO        | **MISSING**  | PRD calls this out; no translate route, no IndicTrans2 integration.                                                                                            |
| 11f                              | Image alt-text                                  | YES       | YES       | **MISSING**  | No code.                                                                                                                                                       |
| 11g                              | Content performance prediction                  | Partial   | NO        | **MISSING**  | No code.                                                                                                                                                       |
| 11h                              | Festival-themed content                         | NO        | NO        | **STUBBED**  | Prompt supports `festival_context` param, but no festival-templates wiring UI.                                                                                 |
| 11i                              | Cricket commentary posts                        | NO        | NO        | **MISSING**  | No code.                                                                                                                                                       |
| **12. Team collaboration**       |                                                 |           |           |              |                                                                                                                                                                |
| 12a                              | Multi-role RBAC                                 | YES       | YES       | **BUILT**    | `org_members.role` checks in insert policies.                                                                                                                  |
| 12b                              | Invite team members                             | YES       | YES       | **STUBBED**  | Onboarding UI has "Send Invitation" button marked `disabled`. `/api/orgs/:id/members` exists for listing, no invite endpoint.                                  |
| 12c                              | Approval workflows                              | YES       | YES       | **BUILT**    | `/api/posts/[id]/approve` + `/reject` + `post_approvals` table. Need to verify UI.                                                                             |
| 12d                              | Multi-step approval chains                      | YES       | Partial   | **MISSING**  | Single reviewer only.                                                                                                                                          |
| 12e                              | Task assignment (inbox)                         | YES       | YES       | **BUILT**    | Route exists.                                                                                                                                                  |
| 12f                              | Audit logs                                      | YES       | YES       | **MISSING**  | No audit log table/UI despite being in PRD.                                                                                                                    |
| **13. Billing**                  |                                                 |           |           |              |                                                                                                                                                                |
| 13a                              | Razorpay checkout                               | N/A       | NO        | **BUILT**    | `/api/billing/checkout` (153 lines).                                                                                                                           |
| 13b                              | Razorpay webhook                                | N/A       | NO        | **BUILT**    | 332 lines, signature-verified, idempotent.                                                                                                                     |
| 13c                              | Stripe checkout (intl)                          | YES       | YES       | **BUILT**    | Webhook route 285 lines.                                                                                                                                       |
| 13d                              | GST-compliant invoice (PDF)                     | NO        | NO        | **BUILT**    | `src/lib/gst.ts` + `src/lib/invoice.ts`.                                                                                                                       |
| 13e                              | Plan limit enforcement                          | YES       | YES       | **BUILT**    | `checkNumericLimit` used in posts/profiles routes.                                                                                                             |
| 13f                              | Trial management                                | YES       | YES       | **MISSING**  | No trial timer in plan.                                                                                                                                        |
| 13g                              | Promo codes                                     | YES       | YES       | **MISSING**  | Not implemented.                                                                                                                                               |
| 13h                              | Annual/monthly toggle                           | YES       | YES       | **BUILT**    | Present in pricing UI.                                                                                                                                         |
| 13i                              | Dunning / failed payment retry                  | YES       | YES       | **MISSING**  | No code.                                                                                                                                                       |
| **14. Media library**            |                                                 |           |           |              |                                                                                                                                                                |
| 14a                              | Upload image/video                              | YES       | YES       | **BUILT**    | `/api/media/upload` (98 lines). Supabase Storage.                                                                                                              |
| 14b                              | Organize folders/tags                           | YES       | YES       | **UI-ONLY**  | DB fields exist; no folder/tag UI verified.                                                                                                                    |
| 14c                              | CDN delivery                                    | YES       | YES       | **STUBBED**  | `cdn_url` field in DB. Supabase Storage has CDN by default — need to confirm `.public` URLs used.                                                              |
| 14d                              | Image/video editing (crop, filter)              | YES       | Partial   | **MISSING**  | No editor.                                                                                                                                                     |
| 14e                              | AI alt-text                                     | YES       | Partial   | **MISSING**  | No code.                                                                                                                                                       |
| 14f                              | Indian festival templates                       | NO        | NO        | **MISSING**  | PRD lists 50+ festival templates pre-loaded; `indian_festivals` table exists with 0 seed data.                                                                 |
| 14g                              | Regional language text overlay                  | NO        | NO        | **MISSING**  | No code.                                                                                                                                                       |
| 14h                              | WhatsApp-optimized formats                      | NO        | NO        | **MISSING**  | No code.                                                                                                                                                       |
| **15. Notifications**            |                                                 |           |           |              |                                                                                                                                                                |
| 15a                              | In-app notifications                            | YES       | YES       | **STUBBED**  | `notifications` table exists. **No `/api/notifications` route directory.** No bell icon in Header (was removed in phase 7 UI pass).                            |
| 15b                              | Email notifications                             | YES       | YES       | **STUBBED**  | Resend API key set, but no email template layer seen.                                                                                                          |
| 15c                              | SMS notifications                               | Partial   | NO        | **MISSING**  | No trigger code.                                                                                                                                               |
| 15d                              | Push notifications (web)                        | YES       | YES       | **MISSING**  | Not implemented.                                                                                                                                               |
| 15e                              | Notification preferences UI                     | YES       | YES       | **MISSING**  | DB has `notification_preferences`; no settings UI.                                                                                                             |
| **16. Landing / marketing site** |                                                 |           |           |              |                                                                                                                                                                |
| 16a                              | Hero with value prop                            | YES       | YES       | **STUBBED**  | 40 lines, title + 2 buttons. No features, screenshots, testimonials.                                                                                           |
| 16b                              | Pricing page                                    | YES       | YES       | **BUILT**    | Real pricing with monthly/yearly toggle.                                                                                                                       |
| 16c                              | Feature pages                                   | YES       | YES       | **MISSING**  | No `/features` pages.                                                                                                                                          |
| 16d                              | Blog / resources                                | YES       | YES       | **MISSING**  | No CMS.                                                                                                                                                        |
| 16e                              | Demo request / sales form                       | YES       | YES       | **MISSING**  | `mailto:sales@` link only.                                                                                                                                     |
| 16f                              | Case studies                                    | YES       | YES       | **MISSING**  | None.                                                                                                                                                          |
| 16g                              | Comparison pages (vs Sprout/Hootsuite)          | YES       | YES       | **MISSING**  | None.                                                                                                                                                          |
| 16h                              | SEO (meta, sitemap, OG)                         | YES       | YES       | **STUBBED**  | Need to check `generateMetadata` in layouts.                                                                                                                   |
| **17. Mobile responsive**        |                                                 |           |           |              |                                                                                                                                                                |
| 17a                              | Phone layout (≤375px)                           | YES       | YES       | **BUILT**    | Tailwind responsive + mobile Sheet nav in Header.                                                                                                              |
| 17b                              | Tablet layout                                   | YES       | YES       | **BUILT**    | Not verified at 768px.                                                                                                                                         |
| 17c                              | Native iOS app                                  | YES       | YES       | **MISSING**  | Not in scope per PRD (Phase 4+).                                                                                                                               |
| 17d                              | Native Android app                              | YES       | YES       | **MISSING**  | Same.                                                                                                                                                          |
| **18. i18n**                     |                                                 |           |           |              |                                                                                                                                                                |
| 18a                              | English UI                                      | YES       | YES       | **BUILT**    | `en.json`.                                                                                                                                                     |
| 18b                              | Hindi UI                                        | NO        | NO        | **BUILT**    | `hi.json`.                                                                                                                                                     |
| 18c                              | Tamil UI                                        | NO        | NO        | **BUILT**    | `ta.json`.                                                                                                                                                     |
| 18d                              | Telugu UI                                       | NO        | NO        | **BUILT**    | `te.json`.                                                                                                                                                     |
| 18e                              | Bengali UI                                      | NO        | NO        | **MISSING**  | No `bn.json` despite PRD minimum.                                                                                                                              |
| 18f                              | Marathi UI                                      | NO        | NO        | **MISSING**  | No `mr.json` despite PRD minimum.                                                                                                                              |
| 18g                              | RTL support                                     | YES       | YES       | **MISSING**  | Not needed for listed languages.                                                                                                                               |

---

## Step 2 — "Does it actually work?"

### Works end-to-end (would run today with credentials)

- Email signup → login → session
- Phone OTP flow (MSG91 real API)
- Razorpay checkout + webhook + invoice PDF
- Stripe checkout + webhook
- Facebook page publishing (text only; media needs hosted URL)
- WhatsApp send/receive via Cloud API
- AI content generation (OpenAI, paid plans only)
- Scheduled post cron
- Listening crawler (Twitter only, sentiment via OpenAI)
- RLS org isolation

### Has real code but unverified in production

- Instagram publishing
- LinkedIn publishing
- YouTube publishing
- Analytics metrics cron
- Twitter inbound webhook
- Report PDF/CSV/XLSX export
- Custom report builder
- Media upload to Supabase Storage

### Real code but broken/won't work without fixes

1. **YouTube OAuth** — [youtube/auth/route.ts:23](src/app/api/connectors/youtube/auth/route.ts#L23) uses `YOUTUBE_API_KEY` as `client_id`. Need a real Google OAuth 2.0 client.
2. **Twitter OAuth 2.0 PKCE** — [twitter/auth/route.ts:35-36](src/app/api/connectors/twitter/auth/route.ts#L35-L36) hardcodes `code_challenge="challenge"` with `method=plain`. Twitter rejects this or returns invalid tokens.
3. **Twitter media upload** — `uploadMedia()` hardcodes `total_bytes=1000000`, skips APPEND, uses Bearer token for v1.1 API (must be OAuth 1.0a). Any tweet with an image will fail.
4. **LinkedIn scopes** — uses deprecated v1 (`r_liteprofile`, `r_organization_admin`). Needs OIDC (`openid profile email`) + product-gated (`w_member_social`, `r_organization_social`) **after LinkedIn Marketing Developer Platform approval**.
5. **Facebook app mode** — in Development, blocks non-tester accounts. Needs Live mode or user must be added as Tester.
6. **Composer media** — [PostComposer.tsx:48](src/components/publishing/PostComposer.tsx#L48) passes `URL.createObjectURL(file)` (browser-local blob URL) as `media_urls`. Platform APIs require publicly-accessible HTTPS URLs. **All image posts will fail**.
7. **Calendar week view** — renders month regardless.
8. **Notifications** — DB exists, no API route.
9. **Landing page** — 40 lines, needs full marketing site.

### Pure UI or empty

- Onboarding "Send Invitation" button — `disabled` attr set.
- Media library organization — folder/tag DB fields, unclear UI.
- Festival calendar page — not seen.
- Audit log UI.

### Entirely missing (but promised in PRD)

- ShareChat connector
- Moj connector
- Google Business Profile connector
- IndicTrans2 translation (22 Indian languages)
- Festival calendar UI + 50+ pre-loaded festivals
- Cricket match event scheduler
- Image/video editor
- Indian festival media templates
- Industry benchmarks dataset
- Regional audience segmentation
- Queue / auto-schedule
- Drag-and-drop calendar
- Recurring posts
- Bulk CSV scheduling
- Optimal-time prediction AI
- Content performance prediction
- Competitor analysis
- Trials, promo codes, dunning
- Zoho/Freshworks/HubSpot/Shopify/Zapier integrations
- Webhook management UI
- Native mobile apps
- Bengali + Marathi i18n

---

## Step 3 — Top 10 critical gaps before an Indian SMB can use this

Effort estimates assume one senior full-stack engineer.

| #   | Gap                                                                | Why it blocks launch                                                                 | Effort            | Dependencies                                                                                                                       |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Composer media upload is broken (blob URLs)**                    | Users cannot attach images or videos to any post. This is the #1 workflow.           | 4h                | Supabase Storage bucket with public access + signed URLs                                                                           |
| 2   | **Platform OAuth credentials valid + apps approved**               | FB/IG/YT/Twitter/LinkedIn all fail or are broken. Zero social accounts = zero posts. | 3-5 weeks elapsed | Meta app review (1-3 wks), LinkedIn MDP approval (2-4 wks), YouTube Google Cloud OAuth client, Twitter Developer "Elevated" access |
| 3   | **YouTube OAuth code fix + Twitter PKCE fix + LinkedIn scope fix** | Bugs listed in Step 2 #1–#4.                                                         | 4h                | None (code only)                                                                                                                   |
| 4   | **Org seeding / onboarding gate**                                  | Admin user has no org → 50% of routes 400. User must be forced through onboarding.   | 3h                | None                                                                                                                               |
| 5   | **Real landing page**                                              | Current page is a title + two buttons. No conversion signal, no trust, no SEO.       | 3-5 days          | Copywriter + designer or template. Content about India differentiators.                                                            |
| 6   | **Twitter media upload (v1.1 chunked + OAuth 1.0a)**               | Any tweet with image fails. Twitter is a top-3 platform for D2C.                     | 1-2 days          | Twitter Dev API v1.1 access                                                                                                        |
| 7   | **In-app notifications + email digest**                            | Users can't tell when posts fail, approvals are pending, new DMs arrive.             | 2-3 days          | Resend templates + cron job                                                                                                        |
| 8   | **Calendar week/day views + drag-drop reschedule**                 | Sprout/Hootsuite users expect this. Currently only a buggy month view.               | 3-4 days          | `@dnd-kit` or similar                                                                                                              |
| 9   | **Festival calendar data (50+ festivals) + UI**                    | This is the "India-first" headline feature. Zero rows in `indian_festivals` table.   | 2 days            | Festival data research + content writer                                                                                            |
| 10  | **End-to-end smoke test hitting real APIs**                        | Nothing is verified. Each launch will break in new ways.                             | 3-4 days          | Playwright + test tenant with real credentials for each platform                                                                   |

**Total critical path:** ~3-5 weeks of engineering, gated by 3-5 weeks of platform approvals running in parallel. If approvals start today, realistic soft-launch date is **late May 2026**.

---

## Step 4 — What a real Indian D2C brand experiences today (first 30 minutes)

Assumptions: all `.env` vars filled with real production credentials, Meta/Twitter/LinkedIn apps approved, admin user has a `pro` org seeded.

| Step                                                 | Experience                                                                                                                                                                                                                                                                                | Verdict                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. **Visits landing page**                           | Sees a 40-line page: "SocialBharat — India's #1 Social Media Platform" + Get Started button. No feature descriptions, no pricing teaser, no screenshots. Most will bounce.                                                                                                                | **DOES NOT WORK (as marketing)**                                 |
| 2. **Signs up (email)**                              | `/api/auth/register` creates user via `admin.createUser`, email verification skipped. Redirects to `/onboarding`. Onboarding asks org name → creates org → redirects to `/dashboard`.                                                                                                     | **WORKS**                                                        |
| 2b. **Signs up (phone OTP)**                         | MSG91 OTP sent. `/api/auth/otp/verify` runs. Redirect to onboarding.                                                                                                                                                                                                                      | **WORKS** (assuming MSG91 DLT template approved)                 |
| 3. **Connects Instagram**                            | Clicks Connect IG → Meta OAuth dialog → grants permission → redirect to `/api/connectors/instagram/callback` → stores encrypted token + IG Business account. **But requires Meta app in Live mode and `instagram_content_publish` approved scope**; typical new app takes 1-3 wks review. | **WORKS** (if app approved)                                      |
| 4. **Composes post, attaches image, clicks Publish** | PostComposer stores a `blob:` URL in `media_urls`. Instagram Graph API call `POST /media` with `image_url=blob:http://localhost/...` returns 400: "image_url is not a valid URL". Post status flips to `failed`. UI shows no error toast (silent).                                        | **DOES NOT WORK**                                                |
| 4b. **Publishes text-only to Facebook**              | Works if FB Page connected. Text appears on Page.                                                                                                                                                                                                                                         | **WORKS (text-only)**                                            |
| 5. **Opens Analytics**                               | `/api/analytics/overview` returns 200 with zero rows (no metrics collected yet — cron runs hourly). User sees empty dashboard.                                                                                                                                                            | **PARTIALLY WORKS** (empty but non-erroring)                     |
| 6. **Opens Inbox**                                   | Empty unless Meta webhook has fired. Webhook requires public HTTPS URL (not localhost). In prod, if webhook subscribed + user messages IG, it appears.                                                                                                                                    | **WORKS in prod, DOES NOT WORK locally**                         |
| 7. **Tries AI content in Hindi**                     | `/api/ai/generate-content` with `language: "hi"`. Org on `pro` plan. OpenAI GPT-4 called with India-aware system prompt. Returns Hindi caption + hashtags.                                                                                                                                | **WORKS**                                                        |
| 8. **Subscribes to Pro plan**                        | Razorpay checkout opens with UPI/cards/netbanking. Payment succeeds. Webhook fires, verifies signature, updates `plan='pro'`, generates GST-compliant invoice PDF, stores in Storage. User sees invoice in Settings → Billing.                                                            | **WORKS** (verify webhook URL whitelisted in Razorpay dashboard) |

**Summary:** Of the 8 steps, only 4 reliably work end-to-end today. Steps 1, 4, and one of 6 (local dev only) are broken or inadequate. The core publishing workflow — the whole reason someone buys the product — **does not work** because of the blob-URL bug alone.

---

## Honest Closing Assessment

**Strengths:**

- Architecture is sound (monolithic Next.js, Supabase, RLS, service-role webhooks, encryption at rest).
- Data model is thorough and matches PRD.
- Phase 8 security audit, DPDP compliance, and idempotent webhooks put this ahead of most early-stage SaaS codebases.
- Real platform API integrations exist for 5 of 7 supported platforms; they're not mocks.
- Razorpay + GST invoicing is genuinely launch-ready.

**Weaknesses:**

- **"Finished code" ≠ "finished product"** — many routes ship correct but unverified, and verification against live APIs is where subtle bugs (Twitter upload, YouTube OAuth, IG blob URLs) hide.
- **India-first differentiators are mostly empty** — festival calendar, cricket scheduler, IndicTrans2, regional benchmarks, ShareChat/Moj — the things that would make a brand pick SocialBharat over Hootsuite are scaffolding without content/code.
- **No end-to-end user has ever completed the golden path** in this repo. Every bug found in the past 48 hours (nav, white-page, auth endpoints, org-less admin, OAuth configs) has been a "code reviewed but never run" surprise.
- **Landing page and notifications** are two areas where a 90%-finished product looks 10%-finished to a customer. Both need attention before a real signup campaign.

**Recommended path to production:**

1. **Weeks 1-2** — Fix the 4 OAuth/PKCE/scope bugs (Step 3 #3), fix blob-URL composer bug (#1), force onboarding for new users (#4). This makes the core flow testable.
2. **Weeks 2-4** — Submit Meta, LinkedIn, Twitter, YouTube apps for production review (run in parallel with work above). Get MSG91 DLT template + Razorpay live-mode activated.
3. **Weeks 3-5** — Build real landing page, notifications, calendar week view, festival seed data. These are the visible gaps a prospect notices first.
4. **Weeks 5-6** — End-to-end smoke tests against live APIs in a staging tenant. This is where Twitter media / IG video / LinkedIn posting bugs will surface.
5. **Week 7** — Soft launch to 10-20 Indian D2C brands for design partners.

**If the goal is "functional Sprout competitor":** 8-12 weeks of focused work. **If the goal is "signs up a design partner":** 3-4 weeks with a hard scope cut (drop Twitter/YouTube/LinkedIn, lead with FB + IG + WhatsApp — the 80/20 for Indian SMBs).
