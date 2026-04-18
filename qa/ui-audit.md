# UI State Audit

**Date:** 2026-04-18
**Scope:** Every page, layout, visual design, navigation, in `src/app/`

---

## 1. Page-by-page audit

Legend: T=Tailwind, S=shadcn/ui, i18n=t() used, Btns=buttons wired, L=loading, E=error, Em=empty state

### (marketing)

| #   | Page                                                                           | T   | S                  | i18n                                                    | Btns                                                                                                                                                   | L             | E                      | Em  |
| --- | ------------------------------------------------------------------------------ | --- | ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------------------- | --- |
| 1   | [src/app/(marketing)/page.tsx](<src/app/(marketing)/page.tsx>)                 | YES | YES (Button)       | NO — hardcoded "SocialBharat", "Sign In", "Get Started" | YES — Link→/login, /register                                                                                                                           | NO            | NO                     | N/A |
| 2   | [src/app/(marketing)/pricing/page.tsx](<src/app/(marketing)/pricing/page.tsx>) | YES | YES (Card, Button) | NO — hardcoded headings & CTAs                          | YES — Monthly/Yearly toggle, "Get Started Free", "Contact Sales" wired; plan card buttons all go to `/register` (pricing tiers not differentiated yet) | YES (Loader2) | NO — `catch` only logs | N/A |

### (auth)

| #   | Page                                                                       | T   | S                               | i18n                                        | Btns                                                                           | L                            | E                     | Em  |
| --- | -------------------------------------------------------------------------- | --- | ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------- | --------------------- | --- |
| 3   | [src/app/(auth)/login/page.tsx](<src/app/(auth)/login/page.tsx>)           | YES | YES (Card, Tabs, Input, Button) | NO — hardcoded "Sign In", "Phone OTP", etc. | YES — Send OTP, Verify OTP, Email login, Google OAuth, Register link all wired | YES (button disabled states) | YES (`{error && <p>`) | N/A |
| 4   | [src/app/(auth)/register/page.tsx](<src/app/(auth)/register/page.tsx>)     | YES | YES                             | NO — hardcoded                              | YES — 3-step phone flow + email flow both wired                                | YES                          | YES                   | N/A |
| 5   | [src/app/(auth)/verify-otp/page.tsx](<src/app/(auth)/verify-otp/page.tsx>) | YES | YES                             | NO                                          | YES — Verify, Resend wired                                                     | YES                          | YES                   | N/A |

### (dashboard)

| #   | Page                                                                                                             | T      | S                                                   | i18n                                                             | Btns                                                                                                                       | L                                             | E                                                             | Em                                           |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| 6   | [src/app/(dashboard)/dashboard/page.tsx](<src/app/(dashboard)/dashboard/page.tsx>)                               | YES    | YES (Card, Button)                                  | YES (`t()`)                                                      | YES — 3 CTAs Link→compose/social-accounts/analytics                                                                        | N/A (server component, static)                | N/A                                                           | N/A                                          |
| 7   | [src/app/(dashboard)/onboarding/page.tsx](<src/app/(dashboard)/onboarding/page.tsx>)                             | YES    | YES (Card, Input, Select)                           | NO                                                               | YES — 4-step wizard wired, submits to `/api/orgs`                                                                          | YES (loading state on button)                 | YES                                                           | N/A                                          |
| 8   | [src/app/(dashboard)/inbox/page.tsx](<src/app/(dashboard)/inbox/page.tsx>)                                       | YES    | YES (Card)                                          | NO — "Select a conversation to get started." hardcoded           | YES — status change, reply, assign wired (assign is a stub)                                                                | partial — `isLoading` flag passed to list     | NO                                                            | YES — placeholder card when nothing selected |
| 9   | [src/app/(dashboard)/inbox/[conversationId]/page.tsx](<src/app/(dashboard)/inbox/[conversationId]/page.tsx>)     | YES    | YES                                                 | NO                                                               | YES — same as above                                                                                                        | partial                                       | NO                                                            | "Loading conversation..." placeholder        |
| 10  | [src/app/(dashboard)/media/page.tsx](<src/app/(dashboard)/media/page.tsx>)                                       | YES    | YES (Card, Button)                                  | NO — "Media Library", "Upload" hardcoded                         | YES — file upload wired, disconnect NOT wired for media                                                                    | "Loading media..." (plain text, not Skeleton) | NO                                                            | YES (FolderOpen icon + text)                 |
| 11  | [src/app/(dashboard)/whatsapp/page.tsx](<src/app/(dashboard)/whatsapp/page.tsx>)                                 | YES    | YES (Skeleton)                                      | NO — "WhatsApp Business" hardcoded                               | YES — template send wired                                                                                                  | YES (Skeleton x3)                             | NO — throws to caller                                         | handled inside `WhatsAppInbox`               |
| 12  | [src/app/(dashboard)/publishing/calendar/page.tsx](<src/app/(dashboard)/publishing/calendar/page.tsx>)           | sparse | delegates to `ContentCalendar`                      | NO — "Content Calendar" hardcoded                                | UNKNOWN — depends on ContentCalendar component                                                                             | delegated                                     | delegated                                                     | delegated                                    |
| 13  | [src/app/(dashboard)/publishing/compose/page.tsx](<src/app/(dashboard)/publishing/compose/page.tsx>)             | YES    | YES (Skeleton)                                      | NO                                                               | UNKNOWN — delegates to PostComposer, FestivalSuggestions, AIContentAssist, PlatformPreview                                 | YES (Skeleton for each dynamic import)        | NO (relies on children)                                       | N/A                                          |
| 14  | [src/app/(dashboard)/publishing/drafts/page.tsx](<src/app/(dashboard)/publishing/drafts/page.tsx>)               | YES    | YES (Card, Button)                                  | NO                                                               | partial — Delete wired, **Edit button is NOT wired** (no onClick, no href)                                                 | YES (LoadingState)                            | YES (ErrorState + retry)                                      | YES (EmptyState → /publishing/compose)       |
| 15  | [src/app/(dashboard)/listening/page.tsx](<src/app/(dashboard)/listening/page.tsx>)                               | YES    | YES (Card, Badge, Button, Skeleton, Dialog, Select) | YES (`t()` throughout)                                           | YES — create query, select query, view details all wired                                                                   | YES (Skeleton x3 patterns)                    | NO — only logs via `logger.error`                             | YES — "No queries / No mentions" text        |
| 16  | [src/app/(dashboard)/listening/queries/[id]/page.tsx](<src/app/(dashboard)/listening/queries/[id]/page.tsx>)     | YES    | YES                                                 | YES                                                              | YES — pagination, filters wired; mention "View" links open external                                                        | YES (Skeleton)                                | partial — query-not-found fallback, but fetch errors only log | YES                                          |
| 17  | [src/app/(dashboard)/analytics/page.tsx](<src/app/(dashboard)/analytics/page.tsx>)                               | sparse | Skeleton wrapper                                    | partial (`locale = "en"` hardcoded; ignores user locale)         | UNKNOWN — delegates to OverviewDashboard                                                                                   | YES (Skeleton)                                | delegated                                                     | delegated                                    |
| 18  | [src/app/(dashboard)/analytics/reports/page.tsx](<src/app/(dashboard)/analytics/reports/page.tsx>)               | YES    | YES                                                 | YES                                                              | YES — CSV / JSON / HTML export anchors wired                                                                               | YES                                           | NO — logs only                                                | YES — "No reports yet"                       |
| 19  | [src/app/(dashboard)/settings/team/page.tsx](<src/app/(dashboard)/settings/team/page.tsx>)                       | YES    | YES (Dialog, Table, Select)                         | NO — all strings hardcoded                                       | YES — invite, role change, remove member all wired with confirm dialogs                                                    | YES ("Loading..." row)                        | YES (`{error && <p>`)                                         | YES ("No team members yet")                  |
| 20  | [src/app/(dashboard)/settings/billing/page.tsx](<src/app/(dashboard)/settings/billing/page.tsx>)                 | YES    | YES (Card, Badge, Button)                           | NO — "Billing", "Current Plan", etc. hardcoded                   | YES — upgrade/cancel/invoice-PDF download wired, **but PDF download button has no onClick, only the Download icon**        | YES (Loader2 spinner)                         | NO — uses `alert()`                                           | YES ("No invoices yet")                      |
| 21  | [src/app/(dashboard)/settings/social-accounts/page.tsx](<src/app/(dashboard)/settings/social-accounts/page.tsx>) | YES    | YES                                                 | NO                                                               | YES — Connect redirects to `/api/connectors/{platform}/auth`, Disconnect wired. **"Setup WhatsApp" button has no onClick** | "Loading social accounts..." plain text       | NO                                                            | N/A (platforms list always shown)            |
| 22  | [src/app/(dashboard)/settings/privacy/page.tsx](<src/app/(dashboard)/settings/privacy/page.tsx>)                 | YES    | YES                                                 | NO — hardcoded despite settings.\* keys existing in locale files | YES — Export, Delete (2-step) wired, Cancel wired                                                                          | YES (Loader2 on both actions)                 | YES (deleteError shown; export error logs only)               | N/A                                          |

---

## 2. Visual design

### Tailwind config — brand colors ✅

Defined in [tailwind.config.ts:46-68](tailwind.config.ts#L46-L68):

```
brand:   50 → 950 (saffron, anchor #FF6B00 as 600)
sidebar: DEFAULT=#0f172a, hover=#1e293b, active=#1e293b,
         border=#1e293b, text=#cbd5e1, text-active=#f1f5f9
```

Plus `shadow-card`, `shadow-card-hover`, `animate-slide-up-fade`.

### CSS variables — theme ✅

Defined in [src/app/globals.css:5-52](src/app/globals.css#L5-L52). Full `:root` + `.dark` palette:

- `--background`, `--foreground`, `--card`, `--popover`, `--primary` (25 100% 50% = saffron), `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius: 0.5rem`
- Plus `.btn-press` and `.page-fade` utility classes.

### Sidebar dark-themed ✅

[src/components/layout/Sidebar.tsx:36](src/components/layout/Sidebar.tsx#L36):

```
<aside className="hidden md:flex flex-col w-64 h-screen bg-[#0f172a] shrink-0">
```

Uses `bg-slate-800` for hover/active, `text-slate-100/400`, brand accent bar on active (`bg-brand-500`). Matches Phase 7 spec.

### Metric cards — accent borders/shadows ✅

[src/components/analytics/MetricCard.tsx:62-64](src/components/analytics/MetricCard.tsx#L62-L64):

```
<Card className="relative overflow-hidden shadow-card hover:shadow-card-hover …">
  <span className={cn("absolute left-0 top-0 bottom-0 w-1", accentColor)} />
```

Accent color defaults to `bg-brand-500`. Trend badges use emerald / red / slate.

### Charts — brand palette ✅

[src/components/analytics/ChartContainer.tsx:39-46](src/components/analytics/ChartContainer.tsx#L39-L46):

```js
const PALETTE = [
  "#FF6B00" /* brand saffron */,
  "#1a1a2e" /* brand dark */,
  "#3b82f6" /* blue */,
  "#10b981" /* emerald */,
  "#f59e0b" /* amber */,
  "#8b5cf6" /* violet */,
];
```

---

## 3. Broken / missing navigation

### Broken nav destinations (no page.tsx exists)

| Source                                                      | Link text / href                         | Status                                                                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Sidebar.tsx:22](src/components/layout/Sidebar.tsx#L22)     | `nav.publishing` → `/publishing`         | ❌ **BROKEN** — no `src/app/(dashboard)/publishing/page.tsx`. Only `/publishing/compose`, `/publishing/calendar`, `/publishing/drafts` exist |
| [Sidebar.tsx:27](src/components/layout/Sidebar.tsx#L27)     | `nav.ai_studio` → `/dashboard/ai-studio` | ❌ **BROKEN** — no such page                                                                                                                 |
| [Sidebar.tsx:28](src/components/layout/Sidebar.tsx#L28)     | `nav.settings` → `/settings`             | ❌ **BROKEN** — only `/settings/team`, `/settings/billing`, `/settings/social-accounts`, `/settings/privacy` exist                           |
| [MobileNav.tsx:11](src/components/layout/MobileNav.tsx#L11) | `nav.publish` → `/publishing`            | ❌ **BROKEN** (same as above)                                                                                                                |
| [MobileNav.tsx:14](src/components/layout/MobileNav.tsx#L14) | `nav.settings` → `/settings`             | ❌ **BROKEN** (same as above)                                                                                                                |

### Unwired buttons (no onClick / no href)

| Component                                                                                             | Button                                        | Issue                                                                       |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| [Header.tsx:32-39](src/components/layout/Header.tsx#L32-L39)                                          | Mobile hamburger (Menu icon)                  | ❌ No onClick — doesn't open anything                                       |
| [Header.tsx:47-58](src/components/layout/Header.tsx#L47-L58)                                          | Notifications bell                            | ❌ No onClick — decorative only                                             |
| [drafts/page.tsx:86-88](<src/app/(dashboard)/publishing/drafts/page.tsx#L86-L88>)                     | "Edit draft" icon button                      | ❌ No onClick / no href                                                     |
| [billing/page.tsx:307-311](<src/app/(dashboard)/settings/billing/page.tsx#L307-L311>)                 | Invoice PDF download (Download icon)          | ❌ Button has no onClick (despite `pdf_url` being available)                |
| [social-accounts/page.tsx:143-145](<src/app/(dashboard)/settings/social-accounts/page.tsx#L143-L145>) | "Setup WhatsApp"                              | ❌ No onClick                                                               |
| [pricing/page.tsx:250](<src/app/(marketing)/pricing/page.tsx#L250>)                                   | "Contact Sales"                               | ❌ No onClick / href                                                        |
| [pricing/page.tsx:225-237](<src/app/(marketing)/pricing/page.tsx#L225-L237>)                          | Plan CTAs                                     | ⚠️ All Link to `/register` regardless of plan — no handoff of selected plan |
| [onboarding/page.tsx:174-177](<src/app/(dashboard)/onboarding/page.tsx#L174-L177>)                    | "Send Invitation" (when skipInvite unchecked) | ❌ `disabled` — unimplemented                                               |

### Working navigation (verified wired)

- Marketing → /login, /register
- Login / Register → /onboarding, /dashboard (via router.push)
- Dashboard cards → /publishing/compose, /settings/social-accounts, /analytics
- Sidebar working items: /dashboard, /inbox, /analytics, /listening, /media, /whatsapp
- Header dropdown → /settings/team (works, but sidebar's /settings link is still broken)
- MobileNav working items: /dashboard, /inbox, /analytics
- Settings/Team: Invite/Remove/Role-change dialogs
- Settings/Billing: Upgrade buttons → RazorpayCheckout modal, Cancel subscription
- Settings/Privacy: Export download, 2-step Delete
- Settings/Social-accounts: Connect → OAuth route, Disconnect DELETE

---

## 4. Layouts

### [src/app/layout.tsx](src/app/layout.tsx) (root)

- Imports `./globals.css` ✅
- Wraps children in `<Providers>` (React Query + Sentry init) and renders `<Toaster />`
- Body: `className="font-sans antialiased"` (no custom font imported — uses system sans)
- No `<html lang>` dynamic — hardcoded `"en"`
- Sets metadata: title "SocialBharat — India's Social Media Platform"

### [src/app/(marketing)/layout.tsx](<src/app/(marketing)/layout.tsx>)

- **Passthrough only** — `return <>{children}</>`. No header/nav/footer shell. Each marketing page must supply its own chrome. Both marketing pages currently do, but visually inconsistent (home vs pricing).

### [src/app/(auth)/layout.tsx](<src/app/(auth)/layout.tsx>)

- Full-screen centered card container with gradient background (`from-slate-50 to-slate-100`, dark variants)
- Renders centered "SocialBharat" heading + tagline, then children
- Styled ✅

### [src/app/(dashboard)/layout.tsx](<src/app/(dashboard)/layout.tsx>)

- Server component — calls `await requireAuth()` (redirects to /login if unauth'd) ✅
- Renders: `<Sidebar />` (hidden on mobile) + column (`<Header /> + <main>` scroll area) + `<MobileNav />` (fixed bottom, mobile only)
- Structure: `flex h-screen overflow-hidden`, main has `p-6 pb-20 md:pb-6` (extra bottom padding on mobile to clear MobileNav)

---

## Summary

**Working well**

- Dark sidebar, brand palette, chart palette, metric-card shadows — all Phase 7 visual specs met
- All dashboard, auth, and marketing pages use Tailwind + shadcn/ui consistently
- Loading/error/empty states are present on most data-driven pages (drafts, listening, reports, billing)
- Auth is enforced server-side via `requireAuth()` in the dashboard layout

**Gaps**

1. **i18n coverage is thin.** Only `dashboard`, `listening`, `analytics`, `nav/common` use `t()`. `login`, `register`, `onboarding`, `settings/*`, `media`, `whatsapp`, `inbox`, `marketing`, `pricing` are all hardcoded English. `analytics/page.tsx` hardcodes `locale = "en"`.
2. **5 broken nav links.** `/publishing`, `/settings`, `/dashboard/ai-studio` have no page — clicking them 404s.
3. **6 unwired buttons.** Mobile hamburger, notifications bell, Edit-draft, invoice PDF download, Setup WhatsApp, Contact Sales.
4. **Error handling inconsistent.** Several pages silently swallow fetch errors (only `logger.error`) — user sees nothing. Billing uses `alert()` instead of toast.
5. **Loading states inconsistent.** Mix of `Loader2`, `Skeleton`, and plain text ("Loading media…", "Loading social accounts…", "Loading...").
6. **No root `/` → `/dashboard` redirect** — unauthenticated users see marketing; authenticated users also see marketing unless they go directly to `/dashboard`.

No changes made. Report only.
