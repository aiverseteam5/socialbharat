"use client";

import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Sparkles, Check, ArrowRight } from "lucide-react";
import { useUpgradeModal, type RequiredPlan } from "@/hooks/useUpgradeModal";

const PLAN_META: Record<
  RequiredPlan,
  { label: string; price: number; benefits: string[] }
> = {
  starter: {
    label: "Starter",
    price: 499,
    benefits: [
      "5 social media profiles",
      "WhatsApp Business inbox",
      "Full analytics dashboard",
      "2 team members",
    ],
  },
  pro: {
    label: "Pro",
    price: 1499,
    benefits: [
      "AI content in 22 Indian languages",
      "WhatsApp broadcast campaigns",
      "Social listening & brand monitoring",
      "Festival campaign templates",
    ],
  },
  business: {
    label: "Business",
    price: 4999,
    benefits: [
      "Multi-step approval workflows",
      "White-label reports",
      "Unlimited AI content",
      "Priority support + account manager",
    ],
  },
};

export function UpgradeModal() {
  const {
    isOpen,
    featureName,
    featureDescription,
    requiredPlan,
    closeUpgradeModal,
  } = useUpgradeModal();

  const plan = PLAN_META[requiredPlan];

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeUpgradeModal();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div
            className="rounded-t-xl p-6 text-white"
            style={{
              background: "linear-gradient(135deg, #1A1A2E 0%, #2D2D4E 100%)",
            }}
          >
            <Sparkles className="h-6 w-6 text-orange-400" aria-hidden />
            <DialogPrimitive.Title className="mt-3 text-xl font-bold text-white">
              {featureName}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-slate-300">
              Upgrade to {plan.label} to unlock this feature
            </DialogPrimitive.Description>
          </div>

          <div className="p-6">
            <p className="text-sm leading-relaxed text-slate-600">
              {featureDescription}
            </p>

            <h3 className="mt-6 text-sm font-semibold text-slate-800">
              With {plan.label} you also get:
            </h3>
            <ul className="mt-3 space-y-2">
              {plan.benefits.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500"
                    aria-hidden
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div>
                <p className="text-sm font-medium text-orange-700">
                  {plan.label}
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  ₹{plan.price.toLocaleString("en-IN")}
                  <span className="ml-0.5 text-sm font-semibold text-orange-500">
                    /month
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Billed monthly · GST invoice included
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                Save 20% yearly
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 px-6 pb-6">
            <Link
              href="/settings/billing"
              onClick={closeUpgradeModal}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-orange-600 hover:shadow-lg active:scale-[0.99]"
            >
              Upgrade to {plan.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/pricing"
              onClick={closeUpgradeModal}
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              See all plans
            </Link>
            <button
              type="button"
              onClick={closeUpgradeModal}
              className="mx-auto cursor-pointer text-xs text-slate-400 transition-colors hover:text-slate-600"
            >
              Maybe later
            </button>
            <p className="-mt-1 text-center text-xs text-slate-400">
              14-day free trial · Cancel anytime · No credit card required
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
