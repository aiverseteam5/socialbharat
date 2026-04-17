import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { t, getLocale } from "@/lib/i18n";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const locale = getLocale();
  const displayMessage =
    message ??
    `${t("common.something_went_wrong", locale)}. ${t("common.please_try_again", locale)}`;

  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            {t("common.unable_to_load", locale)}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {displayMessage}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            {t("common.try_again", locale)}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
