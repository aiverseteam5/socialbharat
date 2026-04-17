import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Unable to load content</p>
          <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
