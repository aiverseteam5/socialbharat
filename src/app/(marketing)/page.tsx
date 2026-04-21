import type { Metadata } from "next";
import Link from "next/link";
import { PricingCards } from "@/components/marketing/PricingCards";
import {
  ArrowRight,
  Check,
  Play,
  Star,
  X,
  Link2,
  PenLine,
  Rocket,
} from "lucide-react";
import {
  FaWhatsapp,
  FaInstagram,
  FaFacebook,
  FaLinkedin,
  FaYoutube,
} from "react-icons/fa6";
import { FaXTwitter } from "react-icons/fa6";

export const metadata: Metadata = {
  title: "SocialBharat — India's AI Social Media Management Platform",
  description:
    "Manage WhatsApp Business, Instagram, Facebook + AI content in Hindi. From ₹499/month.",
  openGraph: {
    title: "SocialBharat — India's AI Social Media Management Platform",
    description:
      "Manage WhatsApp Business, Instagram, Facebook + AI content in Hindi. From ₹499/month.",
    type: "website",
  },
};

const BRAND = "#FF6B35";
const BRAND_DARK = "#1A1A2E";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <SocialProofBar />
      <FeaturesGrid />
      <HowItWorks />
      <Comparison />
      <Pricing />
      <Testimonials />
      <FinalCta />
    </>
  );
}

// ---------- Section 2: Hero ----------

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        minHeight: "90vh",
        background:
          "radial-gradient(ellipse at top, #E8F4FD 0%, #FFFFFF 60%, #FFFFFF 100%)",
      }}
    >
      <div className="bg-grid-pattern absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 md:grid-cols-5 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="md:col-span-3">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              color: BRAND,
              backgroundColor: "#FFF4EC",
              borderColor: "#FFD4B8",
            }}
          >
            🤖 AI-Powered · India&apos;s #1 Social Media Tool
          </span>

          <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900 md:text-6xl">
            Manage All Your Social Media
            <br />
            <span style={{ color: BRAND }}>In Every Indian Language</span>
          </h1>

          <p className="mt-5 max-w-xl text-xl text-slate-600">
            WhatsApp Business inbox, AI content in Hindi &amp; Hinglish, 50+
            festival templates, and analytics — all for ₹499/month. Built for
            Indian brands.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
              style={{ backgroundColor: BRAND }}
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-900 transition-all hover:bg-slate-50"
            >
              <Play className="h-4 w-4" style={{ color: BRAND }} />
              See How It Works
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" /> No credit card
              required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" /> 14-day free trial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" /> Cancel anytime
            </span>
          </div>

          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Publish to all platforms from one place
            </p>
            <div className="mt-3 flex items-center gap-5">
              <PlatformIcon
                Icon={FaWhatsapp}
                color="#25D366"
                label="WhatsApp"
              />
              <PlatformIcon
                Icon={FaInstagram}
                color="#E1306C"
                label="Instagram"
              />
              <PlatformIcon
                Icon={FaFacebook}
                color="#1877F2"
                label="Facebook"
              />
              <PlatformIcon
                Icon={FaXTwitter}
                color="#000000"
                label="Twitter/X"
                className="hidden sm:flex"
              />
              <PlatformIcon
                Icon={FaLinkedin}
                color="#0A66C2"
                label="LinkedIn"
                className="hidden sm:flex"
              />
              <PlatformIcon
                Icon={FaYoutube}
                color="#FF0000"
                label="YouTube"
                className="hidden sm:flex"
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

function PlatformIcon({
  Icon,
  color,
  label,
  className = "",
}: {
  Icon: React.ComponentType<{
    size?: number;
    color?: string;
    "aria-label"?: string;
  }>;
  color: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      title={label}
      className={`inline-flex grayscale transition-all duration-200 hover:grayscale-0 ${className}`}
    >
      <Icon size={32} color={color} aria-label={label} />
    </span>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      <div className="absolute -right-2 -top-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-red-600 shadow">
        <span
          className="animate-live-pulse inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "#EF4444" }}
        />
        Live
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs text-slate-400">SocialBharat Dashboard</span>
          <span className="w-8" />
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCard emoji="📊" value="12.4K" label="Reach" />
            <StatCard emoji="❤️" value="847" label="Likes" />
            <StatCard emoji="💬" value="234" label="Replies" />
          </div>

          <div className="rounded-lg border border-slate-100 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Upcoming Posts
            </p>
            <div className="mt-2 space-y-2">
              <SchedulePreviewRow
                color="#E4405F"
                text="Diwali sale — 30% off everything"
                time="Today 6PM"
              />
              <SchedulePreviewRow
                color="#1DA1F2"
                text="Thread: 5 hacks for Indian founders 🇮🇳"
                time="Tomorrow 9AM"
              />
              <SchedulePreviewRow
                color="#25D366"
                text="Broadcast: weekly offer to 2.4K customers"
                time="Fri 11AM"
              />
            </div>
          </div>

          <div
            className="flex items-center justify-between rounded-lg p-3 text-white"
            style={{
              background: "linear-gradient(135deg, #FF6B35 0%, #FF9466 100%)",
            }}
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              <span>✨</span>
              <span>Diwali is in 12 days — Create campaign in Hindi?</span>
            </div>
            <button className="rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold text-orange-600 shadow">
              Generate
            </button>
          </div>
        </div>
      </div>

      <div
        className="animate-toast absolute -bottom-5 -left-4 z-10 flex max-w-[260px] items-start gap-2.5 rounded-xl bg-white p-3 shadow-xl"
        style={{ border: "1px solid #E2E8F0" }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-base">
          💬
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900">
            New WhatsApp message
          </p>
          <p className="truncate text-xs text-slate-500">
            Priya S. — &ldquo;Hi, is this item available?&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  emoji,
  value,
  label,
}: {
  emoji: string;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-100">
      <div className="text-xs text-slate-500">
        <span className="mr-1" aria-hidden>
          {emoji}
        </span>
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function SchedulePreviewRow({
  color,
  text,
  time,
}: {
  color: string;
  text: string;
  time: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 truncate text-xs text-slate-700">{text}</span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ backgroundColor: "#FFF4EC", color: BRAND }}
      >
        {time}
      </span>
    </div>
  );
}

// ---------- Section 3: Social Proof Bar ----------

const BRANDS = [
  "FabIndia Style",
  "Chai Point",
  "Boat Accessories",
  "Moksha Naturals",
  "Slice Fashion",
  "Urban Tadka",
];

function SocialProofBar() {
  return (
    <section className="bg-slate-900 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 sm:px-6 md:flex-row md:gap-10 lg:px-8">
        <p className="flex-shrink-0 text-sm font-semibold text-slate-300">
          Trusted by <span className="text-white">500+ Indian brands</span>
        </p>
        <div className="relative w-full overflow-hidden">
          <div className="animate-marquee flex gap-3">
            {[...BRANDS, ...BRANDS].map((brand, i) => (
              <span
                key={`${brand}-${i}`}
                className="inline-flex flex-shrink-0 items-center rounded-full bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-300"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Section 4: Features grid ----------

const FEATURES = [
  {
    icon: "💬",
    title: "WhatsApp Business Inbox",
    desc: "Reply to customer WhatsApp messages from your dashboard. India's #1 messaging channel, finally in your social media tool.",
    badge: "India-Only Feature 🇮🇳",
    badgeClass: "bg-green-100 text-green-700",
  },
  {
    icon: "🤖",
    title: "AI Content in Hindi & Hinglish",
    desc: "Generate captions, hashtags, and replies in Hindi, Hinglish, Tamil, Telugu. Not Google Translate — real AI trained for Indian content.",
    badge: "22 Languages",
    badgeClass: "bg-orange-100 text-orange-700",
  },
  {
    icon: "🎉",
    title: "Festival Calendar Intelligence",
    desc: "50+ Indian festivals with pre-built content ideas, hashtags, and best posting times. Never miss a Diwali campaign again.",
    badge: "50+ Festivals",
    badgeClass: "bg-amber-100 text-amber-700",
  },
  {
    icon: "📊",
    title: "Analytics That Make Sense",
    desc: "Track performance across Instagram, Facebook, WhatsApp, and YouTube. India industry benchmarks so you know how you compare.",
  },
  {
    icon: "👥",
    title: "Team Collaboration",
    desc: "Invite your team, set roles, create approval workflows. Your social media manager approves before anything goes live.",
  },
  {
    icon: "💳",
    title: "Pay in INR via UPI",
    desc: "Plans starting ₹499/month. Pay via UPI, cards, or net banking. GST-compliant invoices for your business.",
    badge: "Razorpay Powered",
    badgeClass: "bg-blue-100 text-blue-700",
  },
];

function FeaturesGrid() {
  return (
    <section id="features" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Built for India. Not Translated for India.
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Every feature designed from the ground up for Indian brands,
            languages, and customers.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:border-orange-200 hover:shadow-md"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
                style={{ backgroundColor: "#FFF4EC" }}
              >
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {f.desc}
              </p>
              {f.badge && (
                <span
                  className={`mt-4 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${f.badgeClass}`}
                >
                  {f.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Section 5: How it works ----------

const STEPS = [
  {
    n: 1,
    icon: Link2,
    emoji: "🔗",
    title: "Connect Your Accounts",
    desc: "Link Instagram, Facebook, WhatsApp Business, Twitter, LinkedIn with one click via secure OAuth.",
  },
  {
    n: 2,
    icon: PenLine,
    emoji: "✏️",
    title: "Create or Generate Content",
    desc: "Write posts yourself or let AI generate captions in Hindi, Hinglish, or English. Add media, hashtags, schedule.",
  },
  {
    n: 3,
    icon: Rocket,
    emoji: "🚀",
    title: "Publish & Monitor",
    desc: "Posts go out automatically. Monitor replies in your unified inbox. Track analytics in one dashboard.",
  },
];

function HowItWorks() {
  return (
    <section id="demo" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Go Live in 10 Minutes
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Three steps. No agencies. No consultants. Just results.
          </p>
        </div>

        <div className="relative mt-14">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-8 hidden md:block"
            style={{
              height: 2,
              background:
                "repeating-linear-gradient(to right, #CBD5E1 0 6px, transparent 6px 14px)",
              marginInline: "16.66%",
            }}
          />
          <div className="relative grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex flex-col items-center text-center">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md ring-8 ring-slate-50"
                  style={{ backgroundColor: BRAND }}
                >
                  {s.n}
                </div>
                <div className="mt-4 text-3xl" aria-hidden>
                  {s.emoji}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Section 6: Comparison ----------

const COMPARISON_ROWS: {
  feature: string;
  us: string;
  them: string;
}[] = [
  { feature: "WhatsApp Business Inbox", us: "Built-in", them: "Not available" },
  {
    feature: "AI in Hindi/Regional Languages",
    us: "22 languages",
    them: "English only",
  },
  {
    feature: "Festival Calendar",
    us: "50+ Indian festivals",
    them: "Not available",
  },
  {
    feature: "UPI / Razorpay Payments",
    us: "All Indian methods",
    them: "USD only",
  },
  { feature: "GST Invoicing", us: "Auto-generated", them: "Not available" },
  { feature: "ShareChat / Moj", us: "Coming soon", them: "Never" },
  { feature: "Pricing", us: "From ₹499/mo", them: "From ₹20,000/mo*" },
  {
    feature: "Data Residency",
    us: "India (Mumbai)",
    them: "USA servers",
  },
];

function Comparison() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Why Choose SocialBharat?
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Feature-by-feature, we beat the US giants at serving Indian
            businesses.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-6">
                  Feature
                </th>
                <th
                  className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider sm:px-6"
                  style={{ color: BRAND, backgroundColor: "#FFF4EC" }}
                >
                  SocialBharat
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-6">
                  Sprout / Hootsuite
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature} className="bg-white">
                  <td className="px-4 py-4 font-medium text-slate-900 sm:px-6">
                    {row.feature}
                  </td>
                  <td
                    className="px-4 py-4 sm:px-6"
                    style={{ backgroundColor: "#FFF9F4" }}
                  >
                    <span className="inline-flex items-center gap-2 text-slate-900">
                      <Check
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: "#10B981" }}
                      />
                      {row.us}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600 sm:px-6">
                    <span className="inline-flex items-center gap-2">
                      <X className="h-4 w-4 flex-shrink-0 text-red-400" />
                      {row.them}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          * Competitor pricing converted at approximate exchange rate
        </p>
      </div>
    </section>
  );
}

// ---------- Section 7: Pricing ----------

function Pricing() {
  return (
    <section id="pricing" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Simple, Honest Pricing in INR
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            No hidden fees. No USD conversion surprises. GST invoice included.
          </p>
        </div>

        <div className="mt-12">
          <PricingCards />
        </div>
      </div>
    </section>
  );
}

// ---------- Section 8: Testimonials ----------

{
  /* Representative testimonials — composite personas based on Indian SMB brand profiles. Replace with real customer quotes once available. */
}

const TESTIMONIALS = [
  {
    quote:
      "SocialBharat saved us 15 hours a week. The WhatsApp inbox integration alone was worth it — all our customer messages in one place.",
    name: "Rahul Sharma",
    role: "Founder, Moksha Naturals",
    city: "Bengaluru",
  },
  {
    quote:
      "Finally an Indian tool that gets it. Hindi AI content, festival templates, UPI billing — everything we needed.",
    name: "Priya Mehta",
    role: "Marketing Manager, Urban Tadka",
    city: "Mumbai",
  },
  {
    quote:
      "Our agency manages 20+ clients. SocialBharat's approval workflows and regional language support made us 3x more efficient.",
    name: "Amit Patel",
    role: "Director, DigiGrow Agency",
    city: "Ahmedabad",
  },
];

function Testimonials() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            What Indian Brands Say
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            From D2C founders to agencies managing 20+ clients.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
            >
              <div className="flex gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-500">
                  {t.role} · {t.city}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Section 9: Final CTA ----------

function FinalCta() {
  return (
    <section
      className="py-24 text-center text-white"
      style={{
        background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #2D2D4E 100%)`,
      }}
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
          🇮🇳 Made in India
        </span>
        <h2 className="mt-6 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Ready to Manage Social Media the Indian Way?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-xl text-slate-300">
          Join 500+ Indian brands. Start your 14-day free trial today.
        </p>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-base font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
            style={{ color: BRAND }}
          >
            Start Free Trial — It&apos;s Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="mailto:demo@socialbharat.ai"
            className="inline-flex items-center justify-center rounded-lg border border-white/40 px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-white/10"
          >
            Schedule a Demo
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-400">
          No credit card required · Setup in 10 minutes · Cancel anytime
        </p>
      </div>
    </section>
  );
}
