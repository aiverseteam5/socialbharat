"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const PostComposer = dynamic(
  () =>
    import("@/components/publishing/PostComposer").then((m) => m.PostComposer),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false },
);

const PlatformPreview = dynamic(
  () =>
    import("@/components/publishing/PlatformPreview").then(
      (m) => m.PlatformPreview,
    ),
  { loading: () => <Skeleton className="h-48 w-full" />, ssr: false },
);

const FestivalSuggestions = dynamic(
  () =>
    import("@/components/publishing/FestivalSuggestions").then(
      (m) => m.FestivalSuggestions,
    ),
  { loading: () => <Skeleton className="h-24 w-full" />, ssr: false },
);

const AIContentAssist = dynamic(
  () =>
    import("@/components/publishing/AIContentAssist").then(
      (m) => m.AIContentAssist,
    ),
  { loading: () => <Skeleton className="h-32 w-full" />, ssr: false },
);

export default function ComposePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compose Post</h1>
        <p className="text-muted-foreground">
          Create and publish content to your social media accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <FestivalSuggestions />
          <PostComposer />
        </div>

        <div className="space-y-6">
          <AIContentAssist />
          <PlatformPreview />
        </div>
      </div>
    </div>
  );
}
