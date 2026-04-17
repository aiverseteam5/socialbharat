import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4 max-w-md mx-auto">
      <div className="rounded-full bg-slate-100 p-5">
        <Icon className="h-12 w-12 text-slate-300" strokeWidth={1.5} />
      </div>
      <div className="space-y-1.5">
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>
      {actionLabel && actionHref && (
        <Button
          asChild
          className="mt-1 active:scale-[0.98] transition-transform"
        >
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button
          onClick={onAction}
          className="mt-1 active:scale-[0.98] transition-transform"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
