"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEmail = searchParams.get("email");

  const [email, setEmail] = useState<string | null>(queryEmail);
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  // If the user arrives already verified, bounce them to the dashboard.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        if (!email) setEmail(data.user.email ?? null);
        if (data.user.email_confirmed_at) {
          router.replace("/dashboard");
        }
      }
    });
  }, [router, email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw new Error(error.message);
      setStatus("sent");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to resend email",
      );
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/register");
    router.refresh();
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-8 text-center">
        <Logo variant="default" size="md" />
      </div>

      <div className="max-w-md mx-auto space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900">Check your inbox</h2>
          <p className="mt-2 text-sm text-slate-500">
            We&apos;ve sent a verification link to
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {email ?? "your email"}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Click the link to activate your account. You can close this page
            once you&apos;re verified.
          </p>
        </div>

        <Button
          className="w-full gap-2 font-semibold text-white bg-brand-gradient-animated hover:opacity-95"
          disabled={!email || cooldown > 0 || status === "sending"}
          onClick={handleResend}
        >
          {status === "sending"
            ? "Sending…"
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Resend verification email"}
        </Button>

        {status === "sent" && (
          <p className="text-xs text-emerald-600">
            Verification email sent. Check your inbox.
          </p>
        )}
        {status === "error" && (
          <p className="text-xs text-destructive">{errorMsg}</p>
        )}

        <p className="text-xs text-slate-400">
          Wrong email?{" "}
          <button
            type="button"
            className="font-medium text-slate-600 hover:underline"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
