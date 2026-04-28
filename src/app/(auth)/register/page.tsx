"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { User, Building2, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/client";

type AccountType = "individual" | "team";
type Step = 0 | 1;

const BRAND_BLUE = "#2563EB";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const persistPlan = () => {
    const plan = searchParams.get("plan");
    if (plan) localStorage.setItem("intendedPlan", plan);
  };

  const handleContinueFromPath = () => {
    if (!accountType) return;
    localStorage.setItem("account_type", accountType);
    persistPlan();
    setStep(1);
  };

  const handleGoogleSignIn = async () => {
    if (!accountType) return;
    localStorage.setItem("account_type", accountType);
    persistPlan();
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?account_type=${accountType}`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  };

  const handleRegister = async () => {
    if (!accountType) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          account_type: accountType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      // Email verification required: send user to verify-email page.
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inner =
    step === 0 ? (
      <PathSelection
        selected={accountType}
        onSelect={setAccountType}
        onContinue={handleContinueFromPath}
      />
    ) : (
      <SignUpForm
        accountType={accountType!}
        fullName={fullName}
        email={email}
        password={password}
        setFullName={setFullName}
        setEmail={setEmail}
        setPassword={setPassword}
        loading={loading}
        error={error}
        onRegister={handleRegister}
        onGoogle={handleGoogleSignIn}
        onBack={() => setStep(0)}
      />
    );

  return (
    <div className="flex flex-col items-center">
      <div className="mb-8 text-center">
        <Logo variant="default" size="md" />
        <p className="text-sm text-slate-600 mt-2">
          India&apos;s Social Media Platform
        </p>
      </div>
      {inner}
    </div>
  );
}

// ---------- Step 0: Path Selection ----------

function PathSelection({
  selected,
  onSelect,
  onContinue,
}: {
  selected: AccountType | null;
  onSelect: (t: AccountType) => void;
  onContinue: () => void;
}) {
  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-900">Choose your path</h2>
        <p className="mt-1 text-sm text-slate-500">
          We&apos;ll tailor your experience to fit your needs.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PathCard
          icon={<User className="h-10 w-10" />}
          title="Individual / Creator"
          subtitle="For freelancers, influencers, and solo creators"
          tags="Personal brands • Content creators • Freelancers"
          selected={selected === "individual"}
          onSelect={() => onSelect("individual")}
        />
        <PathCard
          icon={<Building2 className="h-10 w-10" />}
          title="Team / Business"
          subtitle="For SMBs, agencies, and growing teams"
          tags="Businesses • Marketing agencies • D2C brands"
          selected={selected === "team"}
          onSelect={() => onSelect("team")}
        />
      </div>

      <Button
        className="w-full gap-2 font-semibold text-white bg-brand-gradient-animated hover:opacity-95"
        disabled={!selected}
        onClick={onContinue}
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PathCard({
  icon,
  title,
  subtitle,
  tags,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tags: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all hover:border-blue-300"
      style={
        selected
          ? { borderColor: BRAND_BLUE, backgroundColor: "#EFF6FF" }
          : { borderColor: "#E2E8F0", backgroundColor: "#fff" }
      }
    >
      {selected && (
        <span
          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: BRAND_BLUE }}
        >
          <Check className="h-3 w-3" />
        </span>
      )}
      <span style={{ color: selected ? BRAND_BLUE : "#64748B" }}>{icon}</span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>
      <p className="mt-2 text-[10px] font-medium text-slate-400">{tags}</p>
    </button>
  );
}

// ---------- Step 1: Sign Up Form ----------

function SignUpForm({
  accountType,
  fullName,
  email,
  password,
  setFullName,
  setEmail,
  setPassword,
  loading,
  error,
  onRegister,
  onGoogle,
  onBack,
}: {
  accountType: AccountType;
  fullName: string;
  email: string;
  password: string;
  setFullName: (v: string) => void;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  loading: boolean;
  error: string;
  onRegister: () => void;
  onGoogle: () => void;
  onBack: () => void;
}) {
  const isTeam = accountType === "team";
  const canSubmit =
    fullName.length >= 2 && email.length > 0 && password.length >= 8;

  return (
    <div className="max-w-md mx-auto space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-slate-400 hover:text-slate-600"
      >
        ← Back
      </button>

      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Create your account
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {isTeam
            ? "Start your team workspace — free for 14 days."
            : "Start publishing smarter — free for 14 days."}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-3 border-slate-300 font-medium"
        onClick={onGoogle}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          />
        </svg>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <hr className="flex-1 border-slate-200" />
        <span className="text-xs text-slate-400">or</span>
        <hr className="flex-1 border-slate-200" />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Rahul Sharma"
            autoComplete="name"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">{isTeam ? "Work Email" : "Email"}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isTeam ? "you@yourcompany.com" : "you@example.com"}
            autoComplete="email"
          />
          {isTeam && (
            <p className="text-xs text-slate-400">
              Use your work email for team features
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        className="w-full gap-2 font-semibold text-white bg-brand-gradient-animated hover:opacity-95"
        disabled={loading || !canSubmit}
        onClick={onRegister}
      >
        {loading ? "Creating Account…" : "Create Account"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </Button>

      <p className="text-center text-xs text-slate-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
