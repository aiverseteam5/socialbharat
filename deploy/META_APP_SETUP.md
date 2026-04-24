# Meta App Review Setup

External configuration required in the Meta for Developers console before
submitting for app review. Run through this once per environment
(development / production).

The Meta app backs Facebook Pages, Instagram Business, and WhatsApp
Business integrations. We use a single Meta app for all three.

---

## 1. Create the app

1. Go to https://developers.facebook.com/apps → **Create App**
2. Use case: **Other** (we manage multiple platforms through the same app)
3. App type: **Business**
4. Name: `SocialBharat <env>` (e.g. `SocialBharat Production`)

---

## 2. App Dashboard → Settings → Basic

| Field                     | Value                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------ |
| **App Display Name**      | SocialBharat                                                                         |
| **App Contact Email**     | `contact@tynkai.com`                                                                 |
| **Privacy Policy URL**    | `https://socialbharat.tynkai.com/privacy`                                            |
| **Terms of Service URL**  | `https://socialbharat.tynkai.com/terms`                                              |
| **User Data Deletion**    | Data deletion callback URL: `https://socialbharat.tynkai.com/api/auth/data-deletion` |
| **App Domain**            | `socialbharat.tynkai.com`                                                            |
| **App Icon**              | 1024×1024 PNG — upload `public/brand/icon-1024.png`                                  |
| **Category**              | Business and Pages                                                                   |
| **Business Verification** | Complete once the app moves to production                                            |

Copy **App ID** and **App Secret** → save in env as `META_APP_ID` and
`META_APP_SECRET` (server-only).

---

## 3. Add products

Add each of these from the sidebar **Add Products**:

- **Facebook Login** (for the FB Page / IG Business connector)
- **Instagram Graph API** (shared with Facebook Login — same token)
- **WhatsApp Business Platform** (separate credentials)
- **Webhooks** (for page mentions, message events)

### Facebook Login → Settings

**Valid OAuth Redirect URIs** (add every env you care about):

- `http://localhost:3000/api/connectors/facebook/callback`
- `https://socialbharat.tynkai.com/api/connectors/facebook/callback`

> **Note:** `/api/connectors/facebook/callback` is the connector OAuth
> flow — it exchanges tokens with Facebook Graph directly and writes to
> `social_profiles`. It is intentionally separate from
> `/api/auth/callback` (which is Supabase's Google sign-in callback).

Enforce HTTPS, Client OAuth Login, Web OAuth Login: **ON**.

### WhatsApp Business → Configuration

Already documented in the WhatsApp onboarding runbook. Phone Number ID and
System User Access Token go into `WHATSAPP_PHONE_NUMBER_ID` and
`WHATSAPP_ACCESS_TOKEN`.

### Webhooks

Callback URL: `https://socialbharat.tynkai.com/api/webhooks/meta`
Verify Token: a random value we generate per env — store in
`META_WEBHOOK_VERIFY_TOKEN` and configure identically in the Meta
dashboard.

Subscribe to **Page** and **Instagram** object fields as documented in
the webhook route implementation.

---

## 4. Permissions to request for App Review

| Permission                  | Why we need it                                                        |
| --------------------------- | --------------------------------------------------------------------- |
| `pages_show_list`           | List the FB Pages the user manages so they can pick which to connect. |
| `pages_read_engagement`     | Read page metrics (impressions, reach, engagement) for analytics.     |
| `pages_manage_posts`        | Publish scheduled posts to connected Pages.                           |
| `pages_manage_metadata`     | Subscribe to the page&apos;s webhook for mentions & messages.         |
| `pages_messaging`           | Read and reply to Page DMs in the SocialBharat inbox.                 |
| `instagram_basic`           | Read connected IG Business account profile + media.                   |
| `instagram_content_publish` | Publish scheduled posts to IG Business.                               |
| `instagram_manage_insights` | Read IG post and account analytics.                                   |
| `instagram_manage_comments` | Read and reply to IG comments in the inbox.                           |
| `business_management`       | Let the user connect a Facebook Business Manager-owned Page.          |

For each permission Meta requires:

1. A **screen recording** showing the feature in use (publish a post,
   read analytics, reply to a comment, etc.). 30–90 seconds each.
2. A **written explanation** (2–3 sentences) of why the permission is
   necessary. Paste from the table above.
3. **Test credentials** for a test user with a test Page they can use
   to reproduce the feature.

Screen recordings and written blurbs are tracked in
`docs/meta-app-review-evidence/` (create when the submission is drafted).

---

## 5. Data Deletion Callback

Meta POSTs a `signed_request` payload to the **Data Deletion Callback**
URL when a user removes the app from Facebook. Our endpoint:

- Verifies the signature with `META_APP_SECRET` using HMAC-SHA256.
- Logs the request with the Facebook user ID and a UUID confirmation
  code.
- Returns `{ url, confirmation_code }` pointing to the public deletion
  status page.

Actual deletion is queued to a worker (Phase 3B). Until the worker is
live, the engineering team manually reconciles the log and performs the
deletion.

---

## 6. Verification checklist before submitting

```
[ ] App icon uploaded (1024×1024 PNG)
[ ] Privacy Policy URL returns 200 with real content
[ ] Terms of Service URL returns 200 with real content
[ ] Data Deletion instructions URL returns 200 with real content
[ ] Data Deletion callback URL accepts signed_request and returns confirmation
[ ] Redirect URI registered for every environment
[ ] Each requested permission has a screen recording and written blurb
[ ] Test user credentials provided
[ ] App Contact Email = contact@tynkai.com
[ ] Category = Business and Pages
```
