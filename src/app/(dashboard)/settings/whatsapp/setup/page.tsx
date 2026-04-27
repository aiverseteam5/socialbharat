import { WhatsAppSetupWizard } from "@/components/whatsapp/WhatsAppSetupWizard";

export default function WhatsAppSetupPage() {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
  return (
    <div className="mx-auto max-w-[560px] px-4 py-10">
      <WhatsAppSetupWizard verifyToken={verifyToken} />
    </div>
  );
}
