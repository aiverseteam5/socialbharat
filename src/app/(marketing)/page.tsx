import type { Metadata } from "next";
import Link from "next/link";
import { PricingCards } from "@/components/marketing/PricingCards";
import { LogoGlyph } from "@/components/ui/logo";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  IndianRupee,
  Languages,
  Link2,
  PenLine,
  Play,
  Rocket,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import {
  FaWhatsapp,
  FaInstagram,
  FaFacebook,
  FaLinkedin,
  FaYoutube,
} from "react-icons/fa6";
import { FaXTwitter } from "react-icons/fa6";

type IconType = React.ComponentType<{
  className?: string;
  strokeWidth?: number | string;
  size?: number | string;
}>;

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

const BRAND = "#3B82F6";
const BRAND_DARK = "#0B1220";

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
    <section className="bg-mesh-brand relative overflow-hidden">
      {/* Decorative grid */}
      <div className="bg-grid-pattern absolute inset-0" />

      {/* Floating glow orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-brand-400/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full bg-accent2-400/30 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-24 pt-20 sm:px-6 md:grid-cols-5 lg:px-8 lg:pb-32 lg:pt-28">
        <div className="md:col-span-3">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-brand-200 px-3 py-1.5 text-xs font-semibold shadow-sm"
            style={{
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(139,92,246,0.10) 100%)",
              color: "#1D4ED8",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "#2563EB" }} />
            AI-Powered · India&apos;s #1 Social Media Platform
          </span>

          <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
            One Vision.
            <br />
            <span className="text-gradient-brand">Many Solutions.</span>
            <br />
            Built for Bharat.
          </h1>

          <p className="mt-6 max-w-xl text-xl leading-relaxed text-slate-600">
            WhatsApp Business inbox, AI content in Hindi &amp; Hinglish, 50+
            festival templates, and analytics — all for ₹499/month. Made for
            Indian brands, powered by{" "}
            <span className="font-semibold text-slate-800">TynkAI</span>.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/register"
              className="bg-brand-gradient-animated shadow-brand-glow group inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-base font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#demo"
              className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-4 text-base font-semibold text-slate-900 shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 transition-colors group-hover:bg-brand-100">
                <Play className="h-3 w-3 fill-brand-600 text-brand-600" />
              </span>
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
          <HeroLogoShowcase />
        </div>
      </div>
    </section>
  );
}

function HeroLogoShowcase() {
  return (
    <div className="relative">
      {/* Glow ring behind the tile */}
      <div
        aria-hidden
        className="absolute inset-0 -m-6 rounded-[40px] bg-brand-gradient opacity-30 blur-3xl"
      />

      <div className="glass-panel relative rounded-3xl p-8 shadow-glow-lg">
        <div className="flex flex-col items-center text-center">
          <LogoGlyph size={168} className="animate-float drop-shadow-2xl" />

          <h2 className="mt-7 text-3xl tracking-tight">
            <span className="font-light text-[#1E293B]">Social</span>
            <span className="font-bold text-[#2563EB]">Bharat</span>
          </h2>

          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Powered by TynkAI
          </p>

          <div className="mt-6 grid w-full grid-cols-3 gap-2 text-center">
            <ShowcaseStat value="500M+" label="WhatsApp users" />
            <ShowcaseStat value="6" label="Indian languages" />
            <ShowcaseStat value="50+" label="Festivals" />
          </div>
        </div>
      </div>

      <div className="glass-panel animate-toast absolute -bottom-5 -left-4 z-10 flex max-w-[260px] items-start gap-2.5 rounded-xl p-3 shadow-card-hover">
        <span className="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-white">
          <Sparkles className="h-4 w-4" />
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

function ShowcaseStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/60 p-3 ring-1 ring-slate-200/70">
      <p className="text-gradient-brand text-xl font-bold">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
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

interface Feature {
  Icon: IconType;
  iconGradient: string;
  title: string;
  desc: string;
  badge?: string;
  badgeClass?: string;
}

const FEATURES: Feature[] = [
  {
    Icon: FaWhatsapp,
    iconGradient: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
    title: "WhatsApp Business Inbox",
    desc: "Reply to customer WhatsApp messages from your dashboard. India's #1 messaging channel, finally in your social media tool.",
    badge: "India-First Feature",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
  {
    Icon: Languages,
    iconGradient: "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)",
    title: "AI Content in Hindi & Hinglish",
    desc: "Generate captions, hashtags, and replies in Hindi, Hinglish, Tamil, Telugu. Not Google Translate — real AI trained for Indian content.",
    badge: "22 Languages",
    badgeClass: "bg-purple-100 text-purple-700",
  },
  {
    Icon: CalendarDays,
    iconGradient: "linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)",
    title: "Festival Calendar Intelligence",
    desc: "50+ Indian festivals with pre-built content ideas, hashtags, and best posting times. Never miss a Diwali campaign again.",
    badge: "50+ Festivals",
    badgeClass: "bg-amber-100 text-amber-700",
  },
  {
    Icon: BarChart3,
    iconGradient: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
    title: "Analytics That Make Sense",
    desc: "Track performance across Instagram, Facebook, WhatsApp, and YouTube. India industry benchmarks so you know how you compare.",
  },
  {
    Icon: Users,
    iconGradient: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
    title: "Team Collaboration",
    desc: "Invite your team, set roles, create approval workflows. Your social media manager approves before anything goes live.",
  },
  {
    Icon: IndianRupee,
    iconGradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
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
              className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-md"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-md transition-transform duration-200 group-hover:scale-105"
                style={{ background: f.iconGradient }}
              >
                <f.Icon className="h-6 w-6" />
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

interface Step {
  n: number;
  Icon: IconType;
  gradient: string;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  {
    n: 1,
    Icon: Link2,
    gradient: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
    title: "Connect Your Accounts",
    desc: "Link Instagram, Facebook, WhatsApp Business, Twitter, LinkedIn with one click via secure OAuth.",
  },
  {
    n: 2,
    Icon: PenLine,
    gradient: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
    title: "Create or Generate Content",
    desc: "Write posts yourself or let AI generate captions in Hindi, Hinglish, or English. Add media, hashtags, schedule.",
  },
  {
    n: 3,
    Icon: Rocket,
    gradient: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
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
                <div className="relative">
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-2xl text-white shadow-lg ring-8 ring-slate-50"
                    style={{ background: s.gradient }}
                  >
                    <s.Icon className="h-9 w-9" strokeWidth={1.75} />
                  </div>
                  <span
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-50 bg-white text-xs font-bold shadow-sm"
                    style={{ color: "#2563EB" }}
                  >
                    {s.n}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">
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
                  style={{ color: "#1D4ED8", backgroundColor: "#EFF6FF" }}
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
                    style={{ backgroundColor: "#F8FAFF" }}
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
