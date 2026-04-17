import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  rows?: number;
}

export function LoadingState({ rows = 3 }: LoadingStateProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
