"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";

const CREATORS = [
  {
    name: "Free",
    monthly: 0,
    yearly: 0,
    features: [
      "3 social profiles",
      "30 posts/month",
      "Basic analytics",
      "1 user",
    ],
    ctaStyle: "ghost" as const,
  },
  {
    name: "Creator",
    monthly: 299,
    yearly: 2490,
    highlight: true,
    badge: "Most Popular",
    features: [
      "10 social profiles",
      "Unlimited posts",
      "AI content in Hindi & English",
      "WhatsApp inbox",
      "Festival templates",
    ],
    ctaStyle: "solid" as const,
  },
  {
    name: "Pro Creator",
    monthly: 699,
    yearly: 5990,
    features: [
      "20 social profiles",
      "AI content unlimited",
      "Advanced analytics",
      "Social listening",
      "3 users",
    ],
    ctaStyle: "ghost" as const,
  },
];

const TEAMS = [
  {
    name: "Starter",
    monthly: 999,
    yearly: 7990,
    features: ["5 profiles", "3 team members", "WhatsApp inbox", "GST invoice"],
    ctaStyle: "ghost" as const,
  },
  {
    name: "Business",
    monthly: 2499,
    yearly: 19990,
    highlight: true,
    badge: "Best Value",
    features: [
      "20 profiles",
      "10 team members",
      "WhatsApp broadcast",
      "AI unlimited",
      "Approval workflows",
    ],
    ctaStyle: "solid" as const,
  },
  {
    name: "Agency",
    monthly: null,
    yearly: null,
    features: [
      "Unlimited profiles",
      "Unlimited members",
      "White-label",
      "API access",
    ],
    ctaStyle: "ghost" as const,
  },
];

export function PricingCards() {
  const [audience, setAudience] = useState<"creators" | "teams">("creators");
  const [yearly, setYearly] = useState(false);
  const plans = audience === "creators" ? CREATORS : TEAMS;

  return (
    <div>
      {/* Audience toggle */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex gap-1 rounded-xl border bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setAudience("creators")}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
              audience === "creators"
                ? "bg-[#FF6B35] text-white shadow"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            👤 Creators &amp; Freelancers
          </button>
          <button
            type="button"
            onClick={() => setAudience("teams")}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
              audience === "teams"
                ? "bg-[#FF6B35] text-white shadow"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            🏢 Teams &amp; Businesses
          </button>
        </div>
      </div>

      {/* Billing toggle */}
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
        {plans.map((plan) => {
          const price =
            plan.monthly === null
              ? null
              : yearly
                ? Math.round((plan.yearly ?? 0) / 12)
                : plan.monthly;
          return (
            <div
              key={plan.name}
              className={[
                "relative flex flex-col rounded-2xl bg-white p-8 transition-all",
                plan.highlight
                  ? "shadow-lg md:-translate-y-2"
                  : "border border-slate-200 shadow-sm hover:shadow-md",
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
                  {plan.badge}
                </span>
              )}
              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                {price === null ? (
                  <span className="text-2xl font-bold text-slate-900">
                    Custom
                  </span>
                ) : price === 0 ? (
                  <span className="text-3xl font-bold text-slate-900">
                    Free
                  </span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-slate-900">
                      ₹{price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm text-slate-500">/mo</span>
                  </>
                )}
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={[
                  "mt-7 rounded-md px-4 py-2.5 text-center text-sm font-semibold transition-all active:scale-[0.98]",
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
                {price === null
                  ? "Contact Sales"
                  : price === 0
                    ? "Start for Free"
                    : "Start Free Trial"}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        All plans include 14-day free trial · No credit card required · GST
        invoice auto-generated
      </p>
      <p className="mt-2 text-center text-sm">
        <Link
          href="/pricing"
          className="font-medium underline"
          style={{ color: "#FF6B35" }}
        >
          See full feature comparison →
        </Link>
      </p>
    </div>
  );
}
