import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import { t, getLocale } from "@/lib/i18n";

export default function NotFound() {
  const locale = getLocale();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="rounded-full bg-muted p-6">
        <FileQuestion className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">
          {t("common.not_found_title", locale)}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {t("common.not_found_desc", locale)}
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">{t("common.back_to_dashboard", locale)}</Link>
      </Button>
    </div>
  );
}
