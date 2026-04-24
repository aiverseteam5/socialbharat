import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — SocialBharat",
  description:
    "The terms that govern your use of SocialBharat — India's AI social media management platform.",
};

const LAST_UPDATED = "April 24, 2026";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <div className="prose prose-slate max-w-none">
        <p>
          These Terms govern your use of SocialBharat (the
          &ldquo;Service&rdquo;), operated from Bengaluru, Karnataka, India. By
          creating an account or using the Service, you agree to these Terms.
        </p>

        <h2>1. Acceptance of terms</h2>
        <p>
          If you are accepting on behalf of an organisation, you confirm you
          have authority to bind that organisation. If you do not agree to any
          part of these Terms, do not use the Service.
        </p>

        <h2>2. Description of service</h2>
        <p>
          SocialBharat is a software-as-a-service platform that lets you
          publish, schedule, and analyse content across connected social media
          platforms; manage a shared inbox; and generate AI-assisted content.
          Features and pricing are subject to change, with advance notice for
          material changes.
        </p>

        <h2>3. User accounts and responsibilities</h2>
        <ul>
          <li>
            You are responsible for keeping your credentials secure and for all
            activity under your account.
          </li>
          <li>You must provide accurate, current information at sign-up.</li>
          <li>One account per person. No account sharing.</li>
          <li>
            You must be at least 18 years old, or have parental/guardian consent
            if required by applicable law.
          </li>
        </ul>

        <h2>4. Connected social media accounts</h2>
        <p>
          When you connect a third-party account (Facebook, Instagram, LinkedIn,
          X/Twitter, YouTube, WhatsApp Business, ShareChat, Moj, Google Business
          Profile), you grant SocialBharat permission to act on your behalf
          within the scopes you authorise.
        </p>
        <p>
          <strong>You remain responsible</strong> for complying with the terms
          of each connected platform, including their content policies, posting
          limits, and advertising rules. SocialBharat is not liable for
          violations of third-party platform terms committed through your
          account.
        </p>

        <h2>5. Prohibited uses</h2>
        <p>You may not use SocialBharat to:</p>
        <ul>
          <li>
            Send spam, unsolicited bulk messages, or content that violates
            anti-spam laws.
          </li>
          <li>
            Harass, threaten, defame, or incite violence against any person or
            group.
          </li>
          <li>
            Publish content that is illegal in India, violates someone&apos;s
            intellectual property, or infringes privacy.
          </li>
          <li>
            Publish content that promotes hate speech, terrorism, or is sexually
            explicit involving minors.
          </li>
          <li>
            Reverse engineer, scrape, or attempt to bypass rate limits or
            authentication.
          </li>
          <li>
            Use the Service to compete with SocialBharat or to train a competing
            AI product.
          </li>
        </ul>

        <h2>6. Intellectual property</h2>
        <p>
          <strong>Your content is yours.</strong> You retain all rights to the
          content you create or upload. You grant SocialBharat a limited licence
          to store, process, and transmit your content solely to provide the
          Service.
        </p>
        <p>
          <strong>Our platform is ours.</strong> SocialBharat, the SocialBharat
          logo, and the underlying software are owned by us. You may not copy,
          modify, or redistribute them.
        </p>

        <h2>7. Payments, taxes, and refunds</h2>
        <p>
          Paid plans are billed in Indian Rupees (INR) via Razorpay. GST is
          charged on all invoices to Indian customers as required by law.
          Monthly plans are non-refundable once the billing period has begun.
          Annual plans may be refunded on a pro-rata basis within 14 days of
          purchase.
        </p>

        <h2>8. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, SocialBharat&apos;s total
          liability for any claim arising out of or relating to the Service is
          limited to the fees you paid us in the 12 months preceding the claim.
          We are not liable for indirect, incidental, special, consequential, or
          punitive damages, including lost profits or lost data.
        </p>

        <h2>9. Termination</h2>
        <p>
          You may delete your account at any time. We may suspend or terminate
          accounts that violate these Terms, with or without notice depending on
          severity. On termination, your access ends immediately; data retention
          follows our Privacy Policy.
        </p>

        <h2>10. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of India. Any dispute will be
          resolved in the courts of Bengaluru, Karnataka, subject to any
          mandatory consumer rights you may have under Indian law.
        </p>

        <h2>11. Contact</h2>
        <p>
          Legal enquiries:{" "}
          <a href="mailto:contact@tynkai.com">contact@tynkai.com</a>
        </p>
      </div>
    </article>
  );
}
