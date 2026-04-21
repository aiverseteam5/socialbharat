import { create } from "zustand";

export type RequiredPlan = "starter" | "pro" | "business";

export interface FeatureGate {
  featureName: string;
  featureDescription: string;
  requiredPlan: RequiredPlan;
}

export const FEATURE_GATES = {
  AI_CONTENT: {
    featureName: "AI Content Generation",
    featureDescription:
      "Generate posts, captions, and hashtags in Hindi, Hinglish, Tamil, Telugu, and 18 more Indian languages using advanced AI.",
    requiredPlan: "pro",
  },
  SOCIAL_LISTENING: {
    featureName: "Social Listening",
    featureDescription:
      "Monitor brand mentions, track keywords, and get sentiment analysis across Twitter, Facebook, and Instagram.",
    requiredPlan: "pro",
  },
  CUSTOM_REPORTS: {
    featureName: "Custom Report Builder",
    featureDescription:
      "Build and schedule custom analytics reports with your brand colors. Export as PDF, CSV, or XLSX.",
    requiredPlan: "pro",
  },
  WHATSAPP_BROADCAST: {
    featureName: "WhatsApp Broadcasts",
    featureDescription:
      "Send template messages to your entire WhatsApp contact list. Drive re-engagement and sales.",
    requiredPlan: "pro",
  },
  APPROVAL_WORKFLOWS: {
    featureName: "Approval Workflows",
    featureDescription:
      "Set up multi-step content approval chains so nothing goes live without the right eyes on it.",
    requiredPlan: "business",
  },
  TEAM_MEMBERS: {
    featureName: "Additional Team Members",
    featureDescription:
      "Invite more than 1 team member and collaborate on social media management.",
    requiredPlan: "starter",
  },
} as const satisfies Record<string, FeatureGate>;

export type FeatureGateKey = keyof typeof FEATURE_GATES;

interface UpgradeModalState {
  isOpen: boolean;
  featureName: string;
  featureDescription: string;
  requiredPlan: RequiredPlan;
  openUpgradeModal: (feature: FeatureGate | FeatureGateKey) => void;
  closeUpgradeModal: () => void;
}

const DEFAULT_FEATURE: FeatureGate = FEATURE_GATES.AI_CONTENT;

export const useUpgradeModal = create<UpgradeModalState>((set) => ({
  isOpen: false,
  featureName: DEFAULT_FEATURE.featureName,
  featureDescription: DEFAULT_FEATURE.featureDescription,
  requiredPlan: DEFAULT_FEATURE.requiredPlan,
  openUpgradeModal: (feature) => {
    const gate: FeatureGate =
      typeof feature === "string" ? FEATURE_GATES[feature] : feature;
    set({
      isOpen: true,
      featureName: gate.featureName,
      featureDescription: gate.featureDescription,
      requiredPlan: gate.requiredPlan,
    });
  },
  closeUpgradeModal: () => set({ isOpen: false }),
}));
