import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion — SocialBharat",
  description:
    "How to delete your SocialBharat data, including data associated with connected Facebook, Instagram, and other platform accounts.",
};

export default function DataDeletionPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Data Deletion
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          How to permanently delete your SocialBharat account and associated
          data.
        </p>
      </header>

      <div className="prose prose-slate max-w-none">
        <h2>Option 1 — In-app deletion (fastest)</h2>
        <ol>
          <li>Sign in to your SocialBharat account.</li>
          <li>
            Go to <strong>Settings &rarr; Privacy &rarr; Delete Account</strong>
            .
          </li>
          <li>
            Confirm your password. Your account and all associated personal data
            will be queued for deletion immediately.
          </li>
        </ol>

        <h2>Option 2 — Email request</h2>
        <p>
          If you cannot access your account, email us at{" "}
          <a href="mailto:contact@tynkai.com">contact@tynkai.com</a> with the
          subject line <strong>&ldquo;Data Deletion Request&rdquo;</strong> from
          the email address associated with your SocialBharat account.
        </p>
        <p>
          We will verify your identity, delete your data within 30 days, and
          send a written confirmation to your email.
        </p>

        <h2>What gets deleted</h2>
        <ul>
          <li>Your account profile (name, email, phone).</li>
          <li>
            All posts, drafts, media uploads, AI prompts, and comments you
            authored.
          </li>
          <li>
            Access tokens for connected social media accounts (Facebook,
            Instagram, LinkedIn, X/Twitter, YouTube, WhatsApp Business,
            ShareChat, Moj). Revoking the tokens disconnects our access to those
            platforms.
          </li>
          <li>
            Analytics and engagement data pulled from connected platforms.
          </li>
          <li>Team membership records.</li>
        </ul>

        <h2>What we retain (by law)</h2>
        <ul>
          <li>
            Invoices and payment transaction records — retained for 8 years to
            comply with Indian tax law.
          </li>
          <li>
            Audit-trail entries required for fraud detection or regulatory
            reporting.
          </li>
        </ul>

        <h2>Platform-specific notes</h2>
        <p>
          <strong>Facebook / Instagram / WhatsApp Business:</strong> deleting
          your SocialBharat account revokes the access tokens we hold for these
          Meta platforms. To remove SocialBharat from your Facebook
          account&apos;s list of connected apps:
        </p>
        <ol>
          <li>
            Go to{" "}
            <a
              href="https://www.facebook.com/settings?tab=business_tools"
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook &rarr; Settings &rarr; Business Integrations
            </a>
            .
          </li>
          <li>Find &ldquo;SocialBharat&rdquo; in the list.</li>
          <li>
            Click <strong>Remove</strong>.
          </li>
        </ol>

        <h2>Contact</h2>
        <p>
          Questions about deletion?{" "}
          <a href="mailto:contact@tynkai.com">contact@tynkai.com</a>
        </p>
      </div>
    </article>
  );
}
