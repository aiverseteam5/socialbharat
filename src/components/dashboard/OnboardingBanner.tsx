"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, UserPlus, Plug } from "lucide-react";

const DISMISS_KEY = "sb_banner_dismissed";

export function OnboardingBanner({
  accountType,
}: {
  accountType: "individual" | "team" | string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  if (accountType === "individual") {
    return (
      <Banner
        icon={<Plug className="h-5 w-5 text-blue-600" />}
        bg="bg-blue-50 border-blue-200"
        text={
          <>
            <span className="font-semibold text-blue-900">
              Connect your first social account
            </span>{" "}
            <span className="text-blue-700">
              to start publishing and tracking analytics.
            </span>
          </>
        }
        cta={
          <Link
            href="/settings/social-accounts"
            className="shrink-0 rounded-lg bg-brand-gradient-animated px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-95"
          >
            Connect Account
          </Link>
        }
        onDismiss={dismiss}
      />
    );
  }

  return (
    <Banner
      icon={<UserPlus className="h-5 w-5 text-blue-600" />}
      bg="bg-blue-50 border-blue-200"
      text={
        <>
          <span className="font-semibold text-blue-900">Invite your team</span>{" "}
          <span className="text-blue-700">
            to collaborate on posts, campaigns, and analytics.
          </span>
        </>
      }
      cta={
        <Link
          href="/settings/team"
          className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600"
        >
          Invite Team
        </Link>
      }
      onDismiss={dismiss}
    />
  );
}

function Banner({
  icon,
  bg,
  text,
  cta,
  onDismiss,
}: {
  icon: React.ReactNode;
  bg: string;
  text: React.ReactNode;
  cta: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${bg}`}
    >
      <span className="shrink-0">{icon}</span>
      <p className="flex-1 text-sm leading-snug">{text}</p>
      {cta}
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 text-slate-400 transition hover:text-slate-600"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
