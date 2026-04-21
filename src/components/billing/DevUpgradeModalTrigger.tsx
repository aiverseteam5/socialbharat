"use client";

import { useUpgradeModal, FEATURE_GATES } from "@/hooks/useUpgradeModal";

export function DevUpgradeModalTrigger() {
  const open = useUpgradeModal((s) => s.openUpgradeModal);
  return (
    <button
      type="button"
      onClick={() => open(FEATURE_GATES.AI_CONTENT)}
      className="inline-flex items-center gap-2 rounded-md border border-dashed border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100"
    >
      <span>🧪</span>
      [Dev] Test Upgrade Modal
    </button>
  );
}
