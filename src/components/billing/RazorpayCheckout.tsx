"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import IndianCurrencyDisplay from "@/components/common/IndianCurrencyDisplay";

interface RazorpayCheckoutProps {
  plan: "starter" | "pro" | "business";
  onClose: () => void;
}

export default function RazorpayCheckout({
  plan,
  onClose,
}: RazorpayCheckoutProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [billingState, setBillingState] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderDetails, setOrderDetails] = useState<{
    key: string;
    amount: number;
    currency: string;
    orderId: string;
    gstBreakdown: {
      baseAmount: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalAmount: number;
      isInterState: boolean;
    };
  } | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          billingCycle,
          billingState: billingState || undefined,
          gstNumber: gstNumber || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      if (data.requiresPayment === false) {
        // Free plan, no payment needed
        onClose();
        return;
      }

      setOrderDetails(data);
      openRazorpayCheckout(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  function openRazorpayCheckout(order: {
    key: string;
    amount: number;
    currency: string;
    orderId: string;
  }) {
    const options = {
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      name: "SocialBharat",
      description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan (${billingCycle})`,
      order_id: order.orderId,
      handler: async function () {
        // Payment successful
        // The webhook will handle the actual plan upgrade
        onClose();
      },
      prefill: {
        name: "",
        email: "",
        contact: "",
      },
      theme: {
        color: "#6366f1",
      },
      modal: {
        ondismiss: function () {
          onClose();
        },
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  }

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Upgrade to {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Billing Cycle */}
          <div>
            <Label>Billing Cycle</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={billingCycle === "monthly" ? "default" : "outline"}
                onClick={() => setBillingCycle("monthly")}
                className="flex-1"
              >
                Monthly
              </Button>
              <Button
                type="button"
                variant={billingCycle === "yearly" ? "default" : "outline"}
                onClick={() => setBillingCycle("yearly")}
                className="flex-1"
              >
                Yearly (Save 20%)
              </Button>
            </div>
          </div>

          {/* Billing State */}
          <div>
            <Label htmlFor="billingState">Billing State (Optional)</Label>
            <Input
              id="billingState"
              placeholder="e.g., Karnataka, Maharashtra"
              value={billingState}
              onChange={(e) => setBillingState(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required for GST calculation
            </p>
          </div>

          {/* GST Number */}
          <div>
            <Label htmlFor="gstNumber">GST Number (Optional)</Label>
            <Input
              id="gstNumber"
              placeholder="e.g., 29ABCDE1234F1Z5"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              For GST invoices
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {orderDetails && orderDetails.gstBreakdown && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Amount</span>
                <span>
                  <IndianCurrencyDisplay
                    amount={orderDetails.gstBreakdown.baseAmount}
                  />
                </span>
              </div>
              {orderDetails.gstBreakdown.cgst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CGST (9%)</span>
                  <span>
                    <IndianCurrencyDisplay
                      amount={orderDetails.gstBreakdown.cgst}
                    />
                  </span>
                </div>
              )}
              {orderDetails.gstBreakdown.sgst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SGST (9%)</span>
                  <span>
                    <IndianCurrencyDisplay
                      amount={orderDetails.gstBreakdown.sgst}
                    />
                  </span>
                </div>
              )}
              {orderDetails.gstBreakdown.igst > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IGST (18%)</span>
                  <span>
                    <IndianCurrencyDisplay
                      amount={orderDetails.gstBreakdown.igst}
                    />
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-2 mt-2">
                <span>Total</span>
                <span>
                  <IndianCurrencyDisplay
                    amount={orderDetails.gstBreakdown.totalAmount}
                  />
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleCheckout}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Proceed to Pay"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
