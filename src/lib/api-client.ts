import {
  FEATURE_GATES,
  useUpgradeModal,
  type FeatureGate,
  type FeatureGateKey,
} from "@/hooks/useUpgradeModal";

interface PlanLimitBody {
  error?: string;
  code?: string;
  feature?: FeatureGateKey;
  limit?: { current: number; max: number };
}

export interface FetchWithPlanGateOptions extends RequestInit {
  /**
   * Feature gate to surface if the server returns 403 PLAN_LIMIT_EXCEEDED.
   * - FeatureGateKey (e.g. "AI_CONTENT") looks up a pre-defined gate
   * - FeatureGate object for ad-hoc gates
   * - omit to rely on `body.feature` from the server response
   */
  featureGate?: FeatureGateKey | FeatureGate;
}

/**
 * Thin wrapper around fetch that opens the global upgrade modal when a
 * 403 PLAN_LIMIT_EXCEEDED is returned. The caller still gets the Response
 * back (with the body already consumed) and should handle non-2xx as usual.
 *
 * Client-side only — it touches the Zustand store directly.
 */
export async function fetchWithPlanGate(
  input: RequestInfo | URL,
  options: FetchWithPlanGateOptions = {},
): Promise<Response> {
  const { featureGate, ...init } = options;
  const response = await fetch(input, init);

  if (response.status !== 403) return response;

  const cloned = response.clone();
  let body: PlanLimitBody | null = null;
  try {
    body = (await cloned.json()) as PlanLimitBody;
  } catch {
    return response;
  }

  if (body?.code !== "PLAN_LIMIT_EXCEEDED") return response;

  const gate = resolveGate(featureGate, body.feature);
  if (gate) {
    useUpgradeModal.getState().openUpgradeModal(gate);
  }

  return response;
}

function resolveGate(
  explicit: FeatureGateKey | FeatureGate | undefined,
  fromBody: FeatureGateKey | undefined,
): FeatureGate | null {
  if (typeof explicit === "string") return FEATURE_GATES[explicit];
  if (explicit) return explicit;
  if (fromBody && fromBody in FEATURE_GATES) return FEATURE_GATES[fromBody];
  return null;
}
