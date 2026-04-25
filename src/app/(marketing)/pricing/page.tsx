"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

// Prices in paise
const CREATORS = [
  {
    id: "free",
    name: "Free",
    tagline: "Get started, no card needed",
    monthlyPaise: 0,
    yearlyPaise: 0,
    highlight: false,
    badge: null,
    features: [
      "3 social profiles",
      "30 posts/month",
      "Basic analytics (7 days)",
      "1 user only",
      "Community support",
    ],
    cta: "Start for Free",
    ctaHref: "/register",
    ctaVariant: "outline" as const,
  },
  {
    id: "creator",
    name: "Creator",
    tagline: "For serious creators and influencers",
    monthlyPaise: 29900,
    yearlyPaise: 299000,
    highlight: true,
    badge: "Most Popular",
    features: [
      "10 social profiles",
      "Unlimited posts",
      "AI content in Hindi & English (100/month)",
      "Analytics (90 days)",
      "WhatsApp inbox",
      "Festival templates (20 festivals)",
      "1 user",
      "Email support",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register",
    ctaVariant: "default" as const,
  },
  {
    id: "pro_creator",
    name: "Pro Creator",
    tagline: "For power users and content agencies",
    monthlyPaise: 69900,
    yearlyPaise: 699000,
    highlight: false,
    badge: null,
    features: [
      "20 social profiles",
      "Unlimited posts",
      "AI content unlimited",
      "Advanced analytics",
      "Social listening",
      "All festival templates",
      "Approval workflows",
      "3 users",
      "Priority support",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register",
    ctaVariant: "outline" as const,
  },
] as const;

const TEAMS = [
  {
    id: "starter_team",
    name: "Starter",
    tagline: "For small teams getting started",
    monthlyPaise: 99900,
    yearlyPaise: 999000,
    highlight: false,
    badge: null,
    features: [
      "5 social profiles",
      "3 team members",
      "Basic analytics",
      "WhatsApp inbox",
      "100 AI posts/month",
      "GST invoice",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register",
    ctaVariant: "outline" as const,
  },
  {
    id: "business",
    name: "Business",
    tagline: "For growing businesses and agencies",
    monthlyPaise: 249900,
    yearlyPaise: 2499000,
    highlight: true,
    badge: "Best Value",
    features: [
      "20 social profiles",
      "10 team members",
      "Advanced analytics + custom reports",
      "WhatsApp broadcast campaigns",
      "AI content unlimited",
      "Social listening",
      "Approval workflows",
      "All festival templates",
      "Competitor analysis",
      "Priority support",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register",
    ctaVariant: "default" as const,
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "For agencies managing multiple brands",
    monthlyPaise: null,
    yearlyPaise: null,
    highlight: false,
    badge: null,
    features: [
      "Unlimited profiles",
      "Unlimited users",
      "White-label reports",
      "Dedicated account manager",
      "SLA guarantee",
      "API access",
      "Custom onboarding",
    ],
    cta: "Talk to Sales",
    ctaHref: "mailto:sales@socialbharat.ai",
    ctaVariant: "outline" as const,
  },
] as const;

function formatPrice(
  paise: number | null,
  cycle: "monthly" | "annual",
): string {
  if (paise === null) return "Custom";
  if (paise === 0) return "₹0";
  const rupees = paise / 100;
  if (cycle === "annual") {
    // Show yearly total as monthly equivalent
    const monthly = Math.round(rupees / 12);
    return `₹${monthly.toLocaleString("en-IN")}`;
  }
  return `₹${rupees.toLocaleString("en-IN")}`;
}

function yearlyTotal(paise: number | null): string {
  if (paise === null || paise === 0) return "";
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN")}/year`;
}

type Plan = (typeof CREATORS)[number] | (typeof TEAMS)[number];

function PricingCard({
  plan,
  cycle,
}: {
  plan: Plan;
  cycle: "monthly" | "annual";
}) {
  const price = cycle === "monthly" ? plan.monthlyPaise : plan.yearlyPaise;
  const monthly = formatPrice(price, cycle);
  const yearly = cycle === "annual" ? yearlyTotal(plan.yearlyPaise) : null;

  return (
    <Card
      className={`relative flex flex-col p-6 ${
        plan.highlight
          ? "border-2 border-blue-600 shadow-xl"
          : "border border-border"
      }`}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-brand-gradient-animated text-white px-3 py-1 text-xs font-semibold border-0">
            {plan.badge}
          </Badge>
        </div>
      )}

      <div className="mb-5">
        <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{plan.tagline}</p>

        <div className="mt-4">
          {plan.monthlyPaise === null ? (
            <span className="text-4xl font-bold text-foreground">Custom</span>
          ) : (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">
                  {monthly}
                </span>
                {plan.monthlyPaise > 0 && (
                  <span className="text-muted-foreground text-sm">/month</span>
                )}
              </div>
              {yearly && (
                <p className="text-xs text-muted-foreground mt-1">
                  Billed as {yearly}
                  {cycle === "annual" && (
                    <span className="ml-1 text-emerald-600 font-medium">
                      · Save ₹
                      {(
                        (plan.monthlyPaise! * 12 - plan.yearlyPaise!) /
                        100
                      ).toLocaleString("en-IN")}
                    </span>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <ul className="flex-1 space-y-2.5 mb-6">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <span className="text-sm text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>

      <Button
        asChild
        variant={plan.ctaVariant}
        className={`w-full ${
          plan.highlight
            ? "bg-brand-gradient-animated hover:opacity-95 text-white border-0"
            : ""
        }`}
      >
        <Link href={plan.ctaHref}>{plan.cta}</Link>
      </Button>
    </Card>
  );
}

export default function PricingPage() {
  const [audience, setAudience] = useState<"creators" | "teams">("creators");
  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");

  const plans = audience === "creators" ? CREATORS : TEAMS;

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground">
            India-first pricing. Pay in ₹, billed via Razorpay.
          </p>
        </div>

        {/* Audience toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex gap-2 bg-card border rounded-xl p-1.5 shadow-sm">
            <button
              onClick={() => setAudience("creators")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                audience === "creators"
                  ? "bg-brand-gradient-animated text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              👤 For Creators &amp; Freelancers
            </button>
            <button
              onClick={() => setAudience("teams")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                audience === "teams"
                  ? "bg-brand-gradient-animated text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🏢 For Teams &amp; Businesses
            </button>
          </div>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center bg-card rounded-lg p-1 border gap-1">
            <button
              onClick={() => setCycle("monthly")}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                cycle === "monthly"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("annual")}
              className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                cycle === "annual"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-normal">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} cycle={cycle} />
          ))}
        </div>

        {/* Trust footer */}
        <div className="mt-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground font-medium">
            All plans include 14-day free trial · No credit card required ·
            Cancel anytime
          </p>
          <p className="text-sm text-muted-foreground">
            Pay via UPI, Cards, Net Banking, EMI · GST invoice auto-generated ·
            Powered by Razorpay 🇮🇳
          </p>
          <p className="text-sm text-muted-foreground">
            Questions? WhatsApp us:{" "}
            <a
              href="https://wa.me/91XXXXXXXXXX"
              className="underline hover:text-foreground"
            >
              +91 XXXXX XXXXX
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
