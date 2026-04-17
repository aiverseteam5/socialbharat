import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <div className="flex h-full gap-0">
      <div className="w-80 border-r p-4 space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-3/4" />
        ))}
      </div>
    </div>
  );
}
