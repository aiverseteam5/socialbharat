"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ORANGE = "#FF6B35";

export default function OnboardingPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"individual" | "team" | null>(
    null,
  );
  const [autoCreating, setAutoCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("account_type") as
      | "individual"
      | "team"
      | null;
    setAccountType(stored ?? "team");

    if (stored === "individual") {
      void autoCreatePersonalOrg();
    }
  }, []);

  const autoCreatePersonalOrg = async () => {
    setAutoCreating(true);
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Workspace",
          preferred_language: "en",
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create workspace");
      }
      localStorage.setItem("sb_onboarding_done", "1");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setAutoCreating(false);
    }
  };

  if (accountType === "individual") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          {autoCreating ? (
            <>
              <Loader2
                className="mx-auto h-10 w-10 animate-spin"
                style={{ color: ORANGE }}
              />
              <p className="text-slate-600">Setting up your workspace…</p>
            </>
          ) : (
            <>
              <p className="text-destructive text-sm">{error}</p>
              <Button onClick={autoCreatePersonalOrg}>Try again</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (accountType === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return <TeamWorkspaceForm error={error} setError={setError} />;
}

// ---------- Team: single-screen workspace creation ----------

function TeamWorkspaceForm({
  error,
  setError,
}: {
  error: string;
  setError: (e: string) => void;
}) {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [role, setRole] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError("Organization name is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName.trim(),
          industry: role || undefined,
          team_size: teamSize || undefined,
          preferred_language: "en",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create workspace");
      localStorage.setItem("sb_onboarding_done", "1");
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create workspace",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Create Your Workspace
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Set up your team workspace to get started.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="orgName">
              Organization Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Marketing Pvt Ltd"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Your Role (optional)</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="founder">Founder</SelectItem>
                <SelectItem value="marketing_manager">
                  Marketing Manager
                </SelectItem>
                <SelectItem value="agency_owner">Agency Owner</SelectItem>
                <SelectItem value="social_media_manager">
                  Social Media Manager
                </SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="teamSize">Team Size (optional)</Label>
            <Select value={teamSize} onValueChange={setTeamSize}>
              <SelectTrigger id="teamSize">
                <SelectValue placeholder="How big is your team?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Just me</SelectItem>
                <SelectItem value="2-5">2–5 people</SelectItem>
                <SelectItem value="6-20">6–20 people</SelectItem>
                <SelectItem value="20+">20+ people</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full gap-2 font-semibold text-white"
            style={{ backgroundColor: ORANGE }}
            disabled={loading || !orgName.trim()}
            onClick={handleCreate}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                Create Workspace
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-slate-400">
          You can change these details later in settings.
        </p>
      </div>
    </div>
  );
}
