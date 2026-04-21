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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [language, setLanguage] = useState("en");
  const [skipInvite, setSkipInvite] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);

  const handleNext = async () => {
    setError("");
    if (step === 1 && !orgName) {
      setError("Organization name is required");
      return;
    }
    if (step === 4) {
      if (!orgId) {
        await createOrg();
      } else {
        router.push("/dashboard");
      }
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setError("");
    if (step > 1) setStep(step - 1);
  };

  const createOrg = async (): Promise<string | null> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName,
          industry: industry || undefined,
          team_size: teamSize || undefined,
          preferred_language: language,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to create organization");
      setOrgId(data.organization.id);
      router.push("/dashboard");
      return data.organization.id;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create organization",
      );
      return null;
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async () => {
    setInviteMessage("");
    setError("");
    if (!EMAIL_RE.test(inviteEmail)) {
      setError("Enter a valid email address");
      return;
    }
    setInviteSending(true);
    try {
      // Create the org first if we haven't yet, so we can attach the invite to it.
      let currentOrgId = orgId;
      if (!currentOrgId) {
        const response = await fetch("/api/orgs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: orgName,
            industry: industry || undefined,
            team_size: teamSize || undefined,
            preferred_language: language,
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Failed to create organization");
        currentOrgId = data.organization.id as string;
        setOrgId(currentOrgId);
      }

      const inviteRes = await fetch(`/api/orgs/${currentOrgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: "editor" }),
      });
      const inviteData = await inviteRes.json();
      if (!inviteRes.ok)
        throw new Error(inviteData.error || "Failed to send invitation");
      setInviteMessage(
        inviteData.emailSent
          ? `Invitation sent to ${inviteEmail}`
          : `Invite created — share link: ${inviteData.inviteLink}`,
      );
      setInviteEmail("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send invitation",
      );
    } finally {
      setInviteSending(false);
    }
  };

  const progress = (step / 4) * 100;
  const isValidInviteEmail = EMAIL_RE.test(inviteEmail);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Setup Your Organization</CardTitle>
          <CardDescription>Step {step} of 4</CardDescription>
          <div className="w-full bg-secondary h-2 rounded-full mt-4">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Corporation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry (Optional)</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="media">Media & Entertainment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Team Size</Label>
                <Select value={teamSize} onValueChange={setTeamSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Just me</SelectItem>
                    <SelectItem value="2-5">2-5 people</SelectItem>
                    <SelectItem value="6-10">6-10 people</SelectItem>
                    <SelectItem value="11-25">11-25 people</SelectItem>
                    <SelectItem value="26-50">26-50 people</SelectItem>
                    <SelectItem value="51-100">51-100 people</SelectItem>
                    <SelectItem value="100+">100+ people</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Preferred Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="ta">Tamil</SelectItem>
                    <SelectItem value="te">Telugu</SelectItem>
                    <SelectItem value="bn">Bengali</SelectItem>
                    <SelectItem value="mr">Marathi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Invite Team Members (Optional)</Label>
                <p className="text-sm text-muted-foreground">
                  You can invite team members later from the settings page.
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="skipInvite"
                    checked={skipInvite}
                    onChange={(e) => setSkipInvite(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="skipInvite" className="cursor-pointer">
                    Skip for now
                  </Label>
                </div>
              </div>
              {!skipInvite && (
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={inviteSending}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!isValidInviteEmail || inviteSending || !orgName}
                    onClick={sendInvite}
                  >
                    {inviteSending ? "Sending…" : "Send Invitation"}
                  </Button>
                  {inviteMessage && (
                    <p className="text-sm text-muted-foreground">
                      {inviteMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                Back
              </Button>
            )}
            <Button onClick={handleNext} disabled={loading} className="flex-1">
              {loading ? "Creating..." : step === 4 ? "Complete Setup" : "Next"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
