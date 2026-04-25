"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/ui/logo";

const UPCOMING_FESTIVALS = [
  {
    name: "Akshaya Tritiya",
    date: "Apr 30",
    emoji: "🪔",
    tip: "Gold & jewellery brands see 5× engagement today",
  },
  {
    name: "Eid ul-Fitr",
    date: "Mar 30",
    emoji: "🌙",
    tip: "Schedule greetings 24 hrs ahead for max reach",
  },
  {
    name: "Buddha Purnima",
    date: "May 12",
    emoji: "☸️",
    tip: "Mindfulness & wellness content performs well",
  },
  {
    name: "Ganga Dussehra",
    date: "Jun 5",
    emoji: "🏔️",
    tip: "Travel & spirituality posts trend heavily",
  },
];

function FestivalPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between h-full bg-[#0F172A] rounded-2xl p-8 text-white">
      <div>
        <Logo variant="white" size="lg" />
        <p className="mt-3 text-sm text-slate-400">
          India&apos;s AI-powered social media platform
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold text-lg text-white">Upcoming Festivals</h2>
        {UPCOMING_FESTIVALS.map((f) => (
          <div
            key={f.name}
            className="bg-white/5 ring-1 ring-white/10 rounded-xl p-4 space-y-1"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{f.emoji}</span>
              <div>
                <p className="font-semibold text-sm text-white">{f.name}</p>
                <p className="text-xs text-slate-400">{f.date}</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{f.tip}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/5 ring-1 ring-white/10 rounded-xl p-4">
        <p className="text-sm font-medium text-white">
          🚀 Join 10,000+ Indian brands
        </p>
        <p className="text-xs text-slate-400 mt-1">
          scheduling smarter with SocialBharat
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(300);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send OTP");
      setOtpSent(true);
      setCountdown(300);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otp.join("") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to verify OTP");
      router.push(data.isNewUser ? "/onboarding" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
    } catch {
      setError("Google login failed");
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      const next = document.getElementById(
        `otp-${index + 1}`,
      ) as HTMLInputElement;
      next?.focus();
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-4xl mx-auto grid lg:grid-cols-2 gap-6 items-stretch">
      <FestivalPanel />

      <div className="flex flex-col justify-center">
        <div className="mb-6 text-center lg:text-left lg:hidden">
          <Logo variant="default" size="sm" />
          <p className="text-sm text-slate-500 mt-2">
            India&apos;s Social Media Platform
          </p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Choose your sign-in method</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="phone" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="phone">Phone OTP</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>
              <TabsContent value="phone" className="space-y-4 mt-4">
                {!otpSent ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+91XXXXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleSendOtp}
                      disabled={loading}
                      className="w-full bg-brand-gradient-animated text-white font-semibold hover:opacity-95"
                    >
                      {loading ? "Sending..." : "Send OTP"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Enter OTP</Label>
                      <div className="flex gap-2">
                        {otp.map((digit, index) => (
                          <Input
                            key={index}
                            id={`otp-${index}`}
                            type="text"
                            maxLength={1}
                            value={digit}
                            onChange={(e) =>
                              handleOtpChange(index, e.target.value)
                            }
                            className="w-10 h-10 text-center text-lg"
                          />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires in {formatCountdown(countdown)}
                      </p>
                    </div>
                    <Button
                      onClick={handleVerifyOtp}
                      disabled={loading}
                      className="w-full bg-brand-gradient-animated text-white font-semibold hover:opacity-95"
                    >
                      {loading ? "Verifying..." : "Verify OTP"}
                    </Button>
                    <Button
                      variant="link"
                      onClick={() => setOtpSent(false)}
                      className="w-full text-blue-600 hover:text-blue-700"
                    >
                      Change phone number
                    </Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="email" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleEmailLogin}
                    disabled={loading}
                    className="w-full bg-brand-gradient-animated text-white font-semibold hover:opacity-95"
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            <div className="mt-6 space-y-4">
              <Button
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Continue with Google
              </Button>
              <div className="text-center text-sm">
                <a
                  href="/register"
                  className="text-blue-600 hover:text-blue-700"
                >
                  Don&apos;t have an account? Register
                </a>
              </div>
            </div>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
