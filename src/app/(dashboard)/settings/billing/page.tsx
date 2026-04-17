"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IndianCurrencyDisplay } from "@/components/common/IndianCurrencyDisplay";
import { Loader2, Download, AlertCircle } from "lucide-react";
import RazorpayCheckout from "@/components/billing/RazorpayCheckout";
import { logger } from "@/lib/logger";

interface Invoice {
  id: string;
  invoice_number: string;
  base_amount: number;
  total_amount: number;
  currency: string;
  cgst: number;
  sgst: number;
  igst: number;
  status: string;
  created_at: string;
  pdf_url: string | null;
}

interface Subscription {
  plan: string;
  planExpiresAt: string | null;
  razorpayCustomerId: string | null;
  razorpaySubscriptionId: string | null;
  gstNumber: string | null;
  billingState: string | null;
  planLimits: Record<string, unknown> | null;
}

export default function BillingSettingsPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<
    "starter" | "pro" | "business"
  >("pro");

  useEffect(() => {
    fetchSubscription();
    fetchInvoices();
  }, []);

  async function fetchSubscription() {
    try {
      const response = await fetch("/api/billing/subscription");
      const data = await response.json();
      setSubscription(data);
    } catch (error) {
      logger.error("Failed to fetch subscription", error);
    }
  }

  async function fetchInvoices() {
    try {
      const response = await fetch("/api/billing/invoices");
      const data = await response.json();
      setInvoices(data.invoices);
    } catch (error) {
      logger.error("Failed to fetch invoices", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(plan: "starter" | "pro" | "business") {
    setSelectedPlan(plan);
    setShowCheckout(true);
  }

  async function handleCancelSubscription() {
    if (
      !confirm(
        "Are you sure you want to cancel your subscription? Your plan will downgrade to Free at the end of the current billing period.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/billing/subscription", {
        method: "DELETE",
      });
      if (response.ok) {
        alert("Subscription cancelled successfully");
        fetchSubscription();
      }
    } catch (error) {
      logger.error("Failed to cancel subscription", error);
      alert("Failed to cancel subscription");
    }
  }

  function getPlanName(plan: string) {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }

  function getPlanColor(plan: string) {
    switch (plan) {
      case "free":
        return "bg-gray-100 text-gray-800";
      case "starter":
        return "bg-blue-100 text-blue-800";
      case "pro":
        return "bg-purple-100 text-purple-800";
      case "business":
        return "bg-orange-100 text-orange-800";
      case "enterprise":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and invoices
        </p>
      </div>

      {showCheckout && (
        <RazorpayCheckout
          plan={selectedPlan}
          onClose={() => {
            setShowCheckout(false);
            fetchSubscription();
          }}
        />
      )}

      {/* Current Plan Card */}
      {subscription && (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Current Plan
              </h2>
              <Badge className={getPlanColor(subscription.plan)}>
                {getPlanName(subscription.plan)}
              </Badge>
            </div>
            {subscription.plan !== "free" && (
              <Button variant="outline" onClick={handleCancelSubscription}>
                Cancel Subscription
              </Button>
            )}
          </div>

          {subscription.planExpiresAt && (
            <p className="text-muted-foreground mb-4">
              Renews on{" "}
              {new Date(subscription.planExpiresAt).toLocaleDateString()}
            </p>
          )}

          {subscription.planLimits && (
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">
                  Social Profiles
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {subscription.planLimits.maxSocialProfiles === -1
                    ? "Unlimited"
                    : String(subscription.planLimits.maxSocialProfiles)}
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">
                  Team Members
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {subscription.planLimits.maxUsers === -1
                    ? "Unlimited"
                    : String(subscription.planLimits.maxUsers)}
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">
                  Posts/Month
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {subscription.planLimits.maxPostsPerMonth === -1
                    ? "Unlimited"
                    : String(subscription.planLimits.maxPostsPerMonth)}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            {subscription.plan === "free" && (
              <>
                <Button onClick={() => handleUpgrade("starter")}>
                  Upgrade to Starter
                </Button>
                <Button variant="outline" onClick={() => handleUpgrade("pro")}>
                  Upgrade to Pro
                </Button>
              </>
            )}
            {subscription.plan === "starter" && (
              <>
                <Button onClick={() => handleUpgrade("pro")}>
                  Upgrade to Pro
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleUpgrade("business")}
                >
                  Upgrade to Business
                </Button>
              </>
            )}
            {subscription.plan === "pro" && (
              <Button
                variant="outline"
                onClick={() => handleUpgrade("business")}
              >
                Upgrade to Business
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* GST Information */}
      {subscription &&
        (subscription.gstNumber || subscription.billingState) && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              GST Information
            </h3>
            <div className="space-y-2">
              {subscription.gstNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST Number</span>
                  <span className="font-medium">{subscription.gstNumber}</span>
                </div>
              )}
              {subscription.billingState && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing State</span>
                  <span className="font-medium">
                    {subscription.billingState}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}

      {/* Invoice History */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Invoice History
        </h3>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground">No invoices yet</p>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {invoice.invoice_number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-foreground">
                      <IndianCurrencyDisplay amount={invoice.total_amount} />
                    </p>
                    {invoice.status === "paid" && (
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-800 border-green-200"
                      >
                        Paid
                      </Badge>
                    )}
                  </div>
                  {invoice.pdf_url && (
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* GST Notice */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-foreground mb-1">
              GST Information
            </h4>
            <p className="text-sm text-muted-foreground">
              All prices are exclusive of GST. GST will be calculated based on
              your billing state during checkout. Intra-state transactions
              attract CGST + SGST (9% each), while inter-state transactions
              attract IGST (18%).
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
