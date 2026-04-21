"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";

interface Plan {
  name: string;
  badge: string;
  badgeClass: string;
  monthly: number;
  yearly: number;
  yearlyNote: string;
  features: string[];
  highlight?: boolean;
  ctaStyle: "solid" | "ghost";
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    badge: "For Small Businesses",
    badgeClass: "bg-slate-100 text-slate-700",
    monthly: 499,
    yearly: 4990,
    yearlyNote: "Save ₹1,000",
    features: [
      "5 social profiles",
      "2 team members",
      "Basic analytics",
      "WhatsApp inbox",
      "AI content (50 posts/month)",
    ],
    ctaStyle: "ghost",
  },
  {
    name: "Pro",
    badge: "Most Popular",
    badgeClass: "bg-orange-100 text-orange-700",
    monthly: 1499,
    yearly: 14390,
    yearlyNote: "Save ₹3,598",
    features: [
      "15 social profiles",
      "5 team members",
      "Advanced analytics",
      "WhatsApp inbox + broadcast",
      "AI content (200 posts/month)",
      "Social listening",
      "Festival campaign templates",
      "Approval workflows",
    ],
    highlight: true,
    ctaStyle: "solid",
  },
  {
    name: "Business",
    badge: "For Agencies",
    badgeClass: "bg-slate-100 text-slate-700",
    monthly: 4999,
    yearly: 47990,
    yearlyNote: "Save ₹11,998",
    features: [
      "30 social profiles",
      "10 team members",
      "White-label reports",
      "Custom approval chains",
      "Priority support",
      "All AI features unlimited",
      "Competitor analysis",
      "API access (coming soon)",
      "Dedicated account manager",
      "Onboarding concierge",
    ],
    ctaStyle: "ghost",
  },
];

export function PricingCards() {
  const [yearly, setYearly] = useState(false);

  return (
    <div>
      <div className="mb-10 flex items-center justify-center gap-3">
        <span
          className={`text-sm font-medium ${yearly ? "text-slate-500" : "text-slate-900"}`}
        >
          Monthly
        </span>
        <button
          type="button"
          onClick={() => setYearly((v) => !v)}
          className="relative h-7 w-14 rounded-full transition-colors"
          style={{ backgroundColor: yearly ? "#FF6B35" : "#CBD5E1" }}
          aria-label="Toggle billing period"
        >
          <span
            className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
            style={{
              transform: yearly ? "translateX(28px)" : "translateX(2px)",
            }}
          />
        </button>
        <span
          className={`text-sm font-medium ${yearly ? "text-slate-900" : "text-slate-500"}`}
        >
          Yearly
        </span>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
          Save 20%
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const displayPrice = yearly
            ? Math.round(plan.yearly / 12)
            : plan.monthly;
          return (
            <div
              key={plan.name}
              className={[
                "relative flex flex-col rounded-2xl bg-white p-8 transition-all",
                plan.highlight
                  ? "shadow-lg md:-translate-y-2"
                  : "shadow-sm border border-slate-200 hover:shadow-md",
              ].join(" ")}
              style={
                plan.highlight ? { border: "2px solid #FF6B35" } : undefined
              }
            >
              {plan.highlight && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white shadow"
                  style={{ backgroundColor: "#FF6B35" }}
                >
                  Most Popular
                </span>
              )}
              <span
                className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${plan.badgeClass}`}
              >
                {plan.badge}
              </span>
              <h3 className="mt-4 text-2xl font-bold text-slate-900">
                {plan.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">
                  ₹{displayPrice.toLocaleString("en-IN")}
                </span>
                <span className="text-sm text-slate-500">/mo</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {yearly
                  ? `₹${plan.yearly.toLocaleString("en-IN")}/year · ${plan.yearlyNote}`
                  : `Billed monthly`}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 flex-shrink-0"
                      style={{ color: "#10B981" }}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={[
                  "mt-8 rounded-md px-4 py-2.5 text-center text-sm font-semibold transition-all active:scale-[0.98]",
                  plan.ctaStyle === "solid"
                    ? "text-white shadow hover:shadow-md"
                    : "border border-slate-300 text-slate-900 hover:bg-slate-50",
                ].join(" ")}
                style={
                  plan.ctaStyle === "solid"
                    ? { backgroundColor: "#FF6B35" }
                    : undefined
                }
              >
                Start Free Trial
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        All plans include 14-day free trial · No credit card required · Cancel
        anytime · GST invoice generated automatically
      </p>
    </div>
  );
}
