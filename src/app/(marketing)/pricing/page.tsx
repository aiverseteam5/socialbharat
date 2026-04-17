"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
import IndianCurrencyDisplay from "@/components/common/IndianCurrencyDisplay";
import { logger } from "@/lib/logger";

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: {
    maxSocialProfiles: number;
    maxUsers: number;
    maxPostsPerMonth: number | null;
    maxScheduledPosts: number | null;
    aiContentGeneration: boolean;
    socialListening: boolean;
    customReports: boolean;
    approvalWorkflows: boolean;
    whatsappInbox: boolean;
    apiAccess: boolean;
  };
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      const response = await fetch("/api/billing/plans");
      const data = await response.json();
      setPlans(data.plans);
    } catch (error) {
      logger.error("Failed to fetch plans", error);
    } finally {
      setLoading(false);
    }
  }

  function getPrice(plan: Plan) {
    return billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  }

  function getYearlySavings(plan: Plan) {
    const yearlyMonthlyEquivalent = plan.yearlyPrice / 12;
    const monthlyPrice = plan.monthlyPrice;
    const monthlyEquivalent = Math.round(
      (yearlyMonthlyEquivalent / monthlyPrice) * 100,
    );
    return 100 - monthlyEquivalent;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <h1 className="text-2xl font-bold text-foreground">SocialBharat</h1>
          </Link>
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Choose the perfect plan for your business
          </p>

          <div className="inline-flex items-center bg-card rounded-lg p-1 border">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-md transition-colors ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-md transition-colors ${
                billingCycle === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly{" "}
              <span className="ml-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`p-6 flex flex-col ${
                  plan.id === "pro" ? "border-2 border-primary shadow-lg" : ""
                }`}
              >
                <div className="mb-4">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold">
                      <IndianCurrencyDisplay amount={getPrice(plan)} />
                    </span>
                    <span className="text-muted-foreground ml-2">
                      /{billingCycle === "monthly" ? "month" : "year"}
                    </span>
                  </div>
                  {billingCycle === "yearly" &&
                    plan.id !== "free" &&
                    plan.id !== "enterprise" && (
                      <p className="text-sm text-green-600 mt-1">
                        Save {getYearlySavings(plan)}% compared to monthly
                      </p>
                    )}
                </div>

                <ul className="flex-1 space-y-3 mb-6">
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-muted-foreground">
                      {plan.features.maxSocialProfiles === -1
                        ? "Unlimited"
                        : plan.features.maxSocialProfiles}{" "}
                      social profiles
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-muted-foreground">
                      {plan.features.maxUsers === -1
                        ? "Unlimited"
                        : plan.features.maxUsers}{" "}
                      team members
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-muted-foreground">
                      {plan.features.maxPostsPerMonth === -1
                        ? "Unlimited"
                        : plan.features.maxPostsPerMonth}{" "}
                      posts/month
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-muted-foreground">
                      {plan.features.aiContentGeneration
                        ? "AI content generation"
                        : "No AI content"}
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-muted-foreground">
                      {plan.features.whatsappInbox
                        ? "WhatsApp inbox"
                        : "No WhatsApp inbox"}
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-muted-foreground">
                      {plan.features.approvalWorkflows
                        ? "Approval workflows"
                        : "No approval workflows"}
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-muted-foreground">
                      {plan.features.socialListening
                        ? "Social listening"
                        : "No social listening"}
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-muted-foreground">
                      {plan.features.customReports
                        ? "Custom reports"
                        : "No custom reports"}
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-muted-foreground">
                      {plan.features.apiAccess ? "API access" : "No API access"}
                    </span>
                  </li>
                </ul>

                <Link
                  href={plan.id === "free" ? "/register" : "/register"}
                  className="w-full"
                >
                  <Button
                    className="w-full"
                    variant={plan.id === "pro" ? "default" : "outline"}
                  >
                    {plan.id === "free"
                      ? "Get Started Free"
                      : "Upgrade to " + plan.name}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Need a custom plan?
          </h2>
          <p className="text-muted-foreground mb-6">
            Contact us for enterprise pricing and custom solutions
          </p>
          <Button variant="outline">Contact Sales</Button>
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>All prices are in INR. GST extra as applicable.</p>
          <p className="mt-2">Yearly plans include 2 months free.</p>
        </div>
      </main>

      <footer className="border-t bg-card py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2025 SocialBharat. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
