import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SocialBharat",
  description:
    "How SocialBharat collects, uses, stores, and protects your data. Compliant with India's DPDP Act.",
};

const LAST_UPDATED = "April 24, 2026";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <div className="prose prose-slate max-w-none">
        <p>
          SocialBharat (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates an
          AI-powered social media management platform for Indian businesses and
          creators. This Privacy Policy explains what data we collect, how we
          use it, and your rights under India&apos;s Digital Personal Data
          Protection Act, 2023 (DPDP Act).
        </p>

        <h2>1. Data we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> your name, email address,
            phone number (if provided), and password hash.
          </li>
          <li>
            <strong>Connected social media accounts:</strong> when you link a
            Facebook Page, Instagram Business account, LinkedIn Page, Twitter /
            X account, YouTube channel, WhatsApp Business number, ShareChat or
            Moj profile, we store access tokens, account IDs, and profile
            metadata (page name, avatar, follower count).
          </li>
          <li>
            <strong>Content you create:</strong> posts, drafts, media uploads,
            AI prompts, comments, and replies you author through SocialBharat.
          </li>
          <li>
            <strong>Platform engagement data:</strong> metrics and messages
            pulled from the platforms you connect — comments, direct messages,
            impressions, clicks, engagement rates.
          </li>
          <li>
            <strong>Billing information:</strong> GSTIN (optional), billing
            address, invoice history. Payment card details are handled by our
            payment processor (Razorpay) and never stored on our servers.
          </li>
          <li>
            <strong>Usage data:</strong> log-in timestamps, feature usage,
            approximate location (derived from IP), device and browser
            information.
          </li>
        </ul>

        <h2>2. How we use your data</h2>
        <ul>
          <li>
            To provide the social media management service you signed up for.
          </li>
          <li>
            To authenticate you and authenticate on your behalf with connected
            platforms (e.g. posting to your Facebook Page).
          </li>
          <li>
            To generate AI content suggestions, reply suggestions, and
            analytics.
          </li>
          <li>
            To issue GST-compliant invoices and process payments via Razorpay.
          </li>
          <li>
            To send operational emails (verification, receipts, security
            alerts).
          </li>
          <li>To detect abuse, fraud, and violations of our Terms.</li>
        </ul>

        <h2>3. Data sharing</h2>
        <p>
          We <strong>do not sell your data</strong>. We share data only in the
          following cases:
        </p>
        <ul>
          <li>
            <strong>With platforms you connect</strong> (Meta, X, LinkedIn,
            Google, WhatsApp, etc.) — strictly to execute the actions you
            request (publish a post, read your analytics).
          </li>
          <li>
            <strong>With service providers</strong> we rely on: Supabase
            (database, authentication, file storage), Razorpay (payments),
            Resend (transactional email), MSG91 (OTP/SMS), Anthropic and OpenAI
            (AI content generation — only the prompts you submit), and Sentry
            (error tracking).
          </li>
          <li>
            <strong>When required by law</strong> — to comply with a valid court
            order, subpoena, or government request in India.
          </li>
        </ul>

        <h2>4. Data retention</h2>
        <ul>
          <li>
            <strong>Active accounts:</strong> we retain your data for as long as
            your account is active.
          </li>
          <li>
            <strong>Deleted accounts:</strong> we delete personal data within 30
            days of account deletion. Invoices and transaction records are
            retained for 8 years to comply with Indian tax law.
          </li>
          <li>
            <strong>Backups:</strong> deleted data may persist in encrypted
            backups for up to 90 days before being purged.
          </li>
        </ul>

        <h2>5. Data residency and security</h2>
        <p>
          All user data is stored in Supabase&apos;s{" "}
          <strong>ap-south-1 (Mumbai) region</strong>. Access tokens for
          connected platforms are encrypted at rest using AES-256-GCM. All
          traffic is over TLS 1.2+.
        </p>

        <h2>6. Your rights under the DPDP Act</h2>
        <p>As a data principal in India, you have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate data via Settings &rarr; Profile.</li>
          <li>
            Export your data (posts, media, analytics) in a portable format.
          </li>
          <li>
            Delete your account and all associated personal data — via Settings
            &rarr; Privacy &rarr; Delete Account, or by emailing us (see contact
            below).
          </li>
          <li>Withdraw consent for optional processing at any time.</li>
        </ul>

        <h2>7. Cookies</h2>
        <p>
          We use strictly necessary cookies for authentication and session
          management, and first-party analytics cookies to understand aggregate
          product usage. We do not use third-party advertising cookies.
        </p>

        <h2>8. Children</h2>
        <p>
          SocialBharat is not directed to users under 18. We do not knowingly
          collect data from anyone under 18.
        </p>

        <h2>9. Changes to this policy</h2>
        <p>
          We will notify you by email at least 14 days before any material
          change takes effect.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions, requests, or complaints? Email us at{" "}
          <a href="mailto:contact@tynkai.com">contact@tynkai.com</a>.
        </p>
        <p>
          <strong>SocialBharat</strong>
          <br />
          Bengaluru, Karnataka, India
        </p>
      </div>
    </article>
  );
}
