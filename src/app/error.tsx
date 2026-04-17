"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to Sentry when available
    if (typeof window !== "undefined" && "Sentry" in window) {
      (
        window as unknown as {
          Sentry: { captureException: (e: unknown) => void };
        }
      ).Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Something went wrong</h2>
            <p className="text-muted-foreground max-w-md">
              An unexpected error occurred. Our team has been notified.
            </p>
          </div>
          <Button onClick={reset}>Try Again</Button>
        </div>
      </body>
    </html>
  );
}
