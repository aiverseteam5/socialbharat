"use client";

import { usePublishing } from "@/hooks/usePublishing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import type { MediaUpload } from "@/stores/publishing-store";

export function PlatformPreview() {
  const { content, selectedPlatforms, mediaUploads } = usePublishing();

  if (selectedPlatforms.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Select platforms to see preview
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <Tabs defaultValue={selectedPlatforms[0]}>
        <TabsList className="w-full justify-start">
          {selectedPlatforms.map((platform) => (
            <TabsTrigger key={platform} value={platform}>
              {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        {selectedPlatforms.map((platform) => (
          <TabsContent key={platform} value={platform}>
            <PlatformCard
              platform={platform}
              content={content}
              mediaUploads={mediaUploads}
            />
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}

function PlatformCard({
  platform,
  content,
  mediaUploads,
}: {
  platform: string;
  content: string;
  mediaUploads: MediaUpload[];
}) {
  const getPlatformColor = (p: string) => {
    switch (p) {
      case "facebook":
        return "bg-blue-600";
      case "instagram":
        return "bg-gradient-to-br from-purple-600 to-pink-500";
      case "twitter":
        return "bg-sky-500";
      case "linkedin":
        return "bg-blue-700";
      case "youtube":
        return "bg-red-600";
      case "whatsapp":
        return "bg-emerald-500";
      default:
        return "bg-gray-600";
    }
  };

  const getPlatformIcon = (p: string) => {
    switch (p) {
      case "facebook":
        return "f";
      case "instagram":
        return "📷";
      case "twitter":
        return "𝕏";
      case "linkedin":
        return "in";
      case "youtube":
        return "▶";
      case "whatsapp":
        return "💬";
      default:
        return "📱";
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className={`${getPlatformColor(platform)} px-4 py-2 flex items-center gap-2`}
      >
        <span className="text-white font-bold">
          {getPlatformIcon(platform)}
        </span>
        <span className="text-white font-medium">
          {platform.charAt(0).toUpperCase() + platform.slice(1)}
        </span>
      </div>
      <div className="p-4 bg-white">
        {mediaUploads.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {mediaUploads.slice(0, 4).map((m) => {
              const previewUrl = m.thumbnailUrl || m.url;
              return (
                <div
                  key={m.tempId}
                  className="aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center text-xs text-muted-foreground"
                >
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={m.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="px-2 text-center">
                      {m.status === "uploading" ? "Uploading…" : m.file.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">
          {content || "Your post will appear here..."}
        </p>
      </div>
    </div>
  );
}
