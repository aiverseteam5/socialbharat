"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  XCircle,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logger } from "@/lib/logger";

interface Props {
  verifyToken: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

interface FormData {
  phoneNumberId: string;
  accessToken: string;
  businessName: string;
}

interface FieldErrors {
  phoneNumberId?: string;
  accessToken?: string;
  businessName?: string;
}

interface ProfileRow {
  id: string;
  platform: string;
  is_healthy: boolean;
  metadata?: { phone_number_id?: string } | null;
}

const WEBHOOK_URL = "https://socialbharat.tynkai.com/api/webhooks/meta";
const TOTAL_STEPS = 5;

function validateForm(data: FormData): FieldErrors {
  const errors: FieldErrors = {};
  if (data.businessName.trim().length < 2) {
    errors.businessName = "Business name must be at least 2 characters";
  }
  if (!/^\d{10,}$/.test(data.phoneNumberId.trim())) {
    errors.phoneNumberId = "Phone Number ID must be at least 10 digits";
  }
  if (data.accessToken.trim().length < 20) {
    errors.accessToken = "Access token looks too short";
  }
  return errors;
}

function mapConnectError(
  status: number,
  body: { error?: string; code?: string },
): string {
  if (status === 401) return "Access token is invalid or expired";
  if (status === 403 && body.code === "PLAN_LIMIT_EXCEEDED") {
    return "Plan limit reached — upgrade to add more profiles";
  }
  if (status === 409) {
    return "This WhatsApp number is already connected";
  }
  if (status === 400) {
    if (body.error && /phone/i.test(body.error)) {
      return "Phone Number ID format incorrect";
    }
    return body.error || "Invalid request";
  }
  return "Couldn't connect to WhatsApp. Please try again.";
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export function WhatsAppSetupWizard({ verifyToken }: Props) {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState<FormData>({
    phoneNumberId: "",
    accessToken: "",
    businessName: "",
  });
  const [showToken, setShowToken] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [tokenHealthStatus, setTokenHealthStatus] = useState<
    "idle" | "checking" | "healthy" | "invalid" | "unknown"
  >("idle");
  const [copyState, setCopyState] = useState<{ url: boolean; token: boolean }>({
    url: false,
    token: false,
  });

  const handleCopy = async (text: string, key: "url" | "token") => {
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopyState((s) => ({ ...s, [key]: true }));
    setTimeout(() => {
      setCopyState((s) => ({ ...s, [key]: false }));
    }, 2000);
  };

  const handleConnect = async () => {
    setSubmitError(null);
    const errors = validateForm(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const existing = await fetch("/api/connectors/profiles");
      if (existing.ok) {
        const json = (await existing.json()) as { profiles?: ProfileRow[] };
        const duplicate = (json.profiles ?? []).some(
          (p) =>
            p.platform === "whatsapp" &&
            p.metadata?.phone_number_id === formData.phoneNumberId.trim(),
        );
        if (duplicate) {
          setSubmitError(
            "This WhatsApp number is already connected. Disconnect it first from Settings → Social Accounts.",
          );
          return;
        }
      }
    } catch (err) {
      logger.error("WhatsApp duplicate pre-check failed", err);
    }

    setConnectionStatus("connecting");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch("/api/connectors/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumberId: formData.phoneNumberId.trim(),
          accessToken: formData.accessToken.trim(),
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        setConnectionStatus("connected");
        setCurrentStep(3);
      } else {
        const body = await res
          .json()
          .catch(() => ({}) as { error?: string; code?: string });
        setConnectionStatus("error");
        setSubmitError(mapConnectError(res.status, body));
      }
    } catch (err) {
      setConnectionStatus("error");
      if (err instanceof DOMException && err.name === "AbortError") {
        setSubmitError(
          "Request timed out. Check your connection and try again.",
        );
      } else {
        setSubmitError("Network error. Please try again.");
        logger.error("WhatsApp connect request failed", err);
      }
    } finally {
      clearTimeout(timeout);
    }
  };

  useEffect(() => {
    if (currentStep !== 4) return;

    let cancelled = false;
    const check = async () => {
      setTokenHealthStatus("checking");
      try {
        const res = await fetch("/api/connectors/profiles");
        if (!res.ok) {
          if (!cancelled) setTokenHealthStatus("unknown");
          return;
        }
        const json = (await res.json()) as { profiles?: ProfileRow[] };
        const match = (json.profiles ?? []).find(
          (p) =>
            p.platform === "whatsapp" &&
            p.metadata?.phone_number_id === formData.phoneNumberId.trim(),
        );
        if (cancelled) return;
        if (!match) {
          setTokenHealthStatus("unknown");
        } else if (match.is_healthy) {
          setTokenHealthStatus("healthy");
          setTimeout(() => {
            if (!cancelled) setCurrentStep(5);
          }, 1500);
        } else {
          setTokenHealthStatus("invalid");
        }
      } catch (err) {
        logger.error("WhatsApp health check failed", err);
        if (!cancelled) setTokenHealthStatus("unknown");
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [currentStep, formData.phoneNumberId]);

  const recheckHealth = () => {
    setTokenHealthStatus("idle");
    setCurrentStep(4);
  };

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <FaWhatsapp className="h-5 w-5 text-emerald-600" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Connect WhatsApp Business
          </h1>
          <p className="text-sm text-slate-500">
            Step {currentStep} of {TOTAL_STEPS}
          </p>
        </div>
      </div>

      <div
        className="mb-8 flex items-center justify-center gap-2"
        aria-label={`Step ${currentStep} of ${TOTAL_STEPS}`}
      >
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < currentStep ? "bg-blue-600" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      <Card className="p-6">
        {currentStep === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Before you start
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You&apos;ll need a Meta developer account with a WhatsApp Business
              app configured. We&apos;ll guide you through the rest.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                A WhatsApp Business account
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                Phone Number ID from Meta App Dashboard
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                A permanent system-user access token
              </li>
            </ul>
            <div className="mt-6 flex flex-col gap-3">
              <Button onClick={() => setCurrentStep(2)}>
                I have a Meta dev account → Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <a
                href="https://developers.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-sm text-blue-600 hover:underline"
              >
                Create one on developers.facebook.com →
              </a>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Enter your credentials
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Find these in Meta App Dashboard → WhatsApp → API Setup.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  type="text"
                  className="mt-1"
                  placeholder="Acme Sweets"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
                  }
                  disabled={connectionStatus === "connecting"}
                />
                {fieldErrors.businessName && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.businessName}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                <Input
                  id="phoneNumberId"
                  type="text"
                  inputMode="numeric"
                  className="mt-1 font-mono"
                  placeholder="1234567890123456"
                  value={formData.phoneNumberId}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumberId: e.target.value })
                  }
                  disabled={connectionStatus === "connecting"}
                />
                {fieldErrors.phoneNumberId && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.phoneNumberId}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="accessToken">Access Token</Label>
                <div className="relative mt-1">
                  <Input
                    id="accessToken"
                    type={showToken ? "text" : "password"}
                    className="pr-10 font-mono"
                    placeholder="EAAG..."
                    value={formData.accessToken}
                    onChange={(e) =>
                      setFormData({ ...formData, accessToken: e.target.value })
                    }
                    disabled={connectionStatus === "connecting"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showToken ? "Hide token" : "Show token"}
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.accessToken && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.accessToken}
                  </p>
                )}
              </div>
            </div>

            {submitError && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                disabled={connectionStatus === "connecting"}
              >
                Back
              </Button>
              <Button
                onClick={handleConnect}
                disabled={connectionStatus === "connecting"}
                className="flex-1"
              >
                {connectionStatus === "connecting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  "Connect WhatsApp"
                )}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Configure the webhook
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Paste these into Meta App Dashboard → WhatsApp → Configuration →
              Webhook.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <Label>Callback URL</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700">
                    {WEBHOOK_URL}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(WEBHOOK_URL, "url")}
                  >
                    {copyState.url ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label>Verify Token</Label>
                {verifyToken ? (
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 truncate rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700">
                      {verifyToken}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(verifyToken, "token")}
                    >
                      {copyState.token ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      Verify token not configured on the server. Contact support
                      before completing this step.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>Open Meta App Dashboard → your app → WhatsApp.</li>
              <li>Click Configuration → Edit on the Webhook section.</li>
              <li>Paste the Callback URL and Verify Token above.</li>
              <li>Click Verify and Save.</li>
              <li>
                Subscribe to the <code className="font-mono">messages</code>{" "}
                webhook field.
              </li>
            </ol>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <Button onClick={() => setCurrentStep(4)} className="flex-1">
                I&apos;ve configured the webhook → Verify Connection
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Verifying connection
            </h2>

            <div className="mt-6 flex flex-col items-center justify-center py-6 text-center">
              {tokenHealthStatus === "checking" && (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                  <p className="mt-3 text-sm text-slate-600">
                    Checking your WhatsApp credentials…
                  </p>
                </>
              )}
              {tokenHealthStatus === "healthy" && (
                <>
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  <p className="mt-3 text-sm font-medium text-emerald-700">
                    Connection verified — all set!
                  </p>
                </>
              )}
              {tokenHealthStatus === "invalid" && (
                <>
                  <XCircle className="h-10 w-10 text-red-500" />
                  <p className="mt-3 text-sm font-medium text-red-700">
                    Credentials look invalid
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Double-check your Phone Number ID and access token.
                  </p>
                </>
              )}
              {tokenHealthStatus === "unknown" && (
                <>
                  <AlertTriangle className="h-10 w-10 text-amber-500" />
                  <p className="mt-3 text-sm font-medium text-amber-700">
                    Couldn&apos;t verify automatically
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Your profile is saved, but we couldn&apos;t confirm token
                    health.
                  </p>
                </>
              )}
            </div>

            {tokenHealthStatus !== "checking" &&
              tokenHealthStatus !== "healthy" && (
                <div className="mt-2 flex flex-col gap-2">
                  {tokenHealthStatus === "invalid" && (
                    <Button onClick={() => setCurrentStep(2)}>
                      Update Credentials
                    </Button>
                  )}
                  {tokenHealthStatus === "unknown" && (
                    <Button onClick={() => setCurrentStep(5)}>
                      Continue anyway →
                    </Button>
                  )}
                  <Button variant="outline" onClick={recheckHealth}>
                    Re-check
                  </Button>
                </div>
              )}
          </div>
        )}

        {currentStep === 5 && (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              WhatsApp Business connected
            </h2>
            {formData.businessName && (
              <p className="mt-1 text-sm text-slate-600">
                {formData.businessName}
              </p>
            )}
            <p className="mt-3 text-sm text-slate-500">
              You can now receive and reply to WhatsApp messages from your
              inbox.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={() => router.push("/whatsapp")}>
                Open Inbox
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/settings/social-accounts")}
              >
                Back to Settings
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
