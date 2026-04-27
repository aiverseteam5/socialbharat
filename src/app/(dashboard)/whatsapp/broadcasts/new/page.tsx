import { BroadcastWizard } from "@/components/whatsapp/BroadcastWizard";

export default function NewBroadcastPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New broadcast</h1>
        <p className="text-sm text-muted-foreground">
          Send a Meta-approved template to a segment. Opted-out contacts are
          always excluded.
        </p>
      </div>
      <BroadcastWizard />
    </div>
  );
}
