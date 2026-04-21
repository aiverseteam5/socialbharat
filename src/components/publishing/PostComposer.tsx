"use client";

import { useState } from "react";
import { usePublishing } from "@/hooks/usePublishing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Clock, Save, X, Loader2, AlertCircle } from "lucide-react";
import {
  FaWhatsapp,
  FaInstagram,
  FaFacebook,
  FaLinkedin,
  FaYoutube,
  FaXTwitter,
} from "react-icons/fa6";
import type { IconType } from "react-icons";

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  youtube: 5000,
  whatsapp: 4096,
};

const PLATFORM_META: Record<
  string,
  { Icon: IconType; color: string; label: string }
> = {
  twitter: { Icon: FaXTwitter, color: "#000000", label: "Twitter/X" },
  facebook: { Icon: FaFacebook, color: "#1877F2", label: "Facebook" },
  instagram: { Icon: FaInstagram, color: "#E1306C", label: "Instagram" },
  linkedin: { Icon: FaLinkedin, color: "#0A66C2", label: "LinkedIn" },
  youtube: { Icon: FaYoutube, color: "#FF0000", label: "YouTube" },
  whatsapp: { Icon: FaWhatsapp, color: "#25D366", label: "WhatsApp" },
};

export function PostComposer() {
  const {
    content,
    selectedPlatforms,
    mediaUploads,
    scheduledAt,
    setContent,
    addPlatform,
    removePlatform,
    addMediaUpload,
    updateMediaUpload,
    removeMediaUpload,
    setScheduledAt,
    reset,
    canPublish,
    characterCount,
    hasUploadingMedia,
    uploadedMediaUrls,
  } = usePublishing();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentLimit =
    selectedPlatforms.length > 0
      ? Math.min(...selectedPlatforms.map((p) => PLATFORM_LIMITS[p] || 63206))
      : 63206;

  const uploadFile = async (file: File) => {
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addMediaUpload({ tempId, file, status: "uploading", progress: 0 });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errJson.error || "Upload failed");
      }

      const data = (await response.json()) as {
        mediaAsset: {
          id: string;
          cdn_url: string;
          thumbnail_url?: string | null;
        };
        publicUrl: string;
      };

      updateMediaUpload(tempId, {
        status: "uploaded",
        progress: 100,
        url: data.publicUrl,
        mediaAssetId: data.mediaAsset.id,
        thumbnailUrl: data.mediaAsset.thumbnail_url ?? undefined,
      });
    } catch (error) {
      updateMediaUpload(tempId, {
        status: "failed",
        progress: 0,
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  };

  const submitPost = async (status: "draft", schedule?: boolean) => {
    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        content,
        media_urls: uploadedMediaUrls,
        platforms: selectedPlatforms,
        status,
      };
      if (schedule && scheduledAt) {
        body.scheduled_at = scheduledAt.toISOString();
      }

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) return;

      if (schedule && scheduledAt) {
        const data = await response.json();
        await fetch(`/api/posts/${data.post.id}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduled_at: scheduledAt.toISOString() }),
        });
      }

      reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = () => submitPost("draft");
  const handleSchedule = () => {
    if (!scheduledAt) return;
    return submitPost("draft", true);
  };
  const handleSaveDraft = () => submitPost("draft");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => void uploadFile(file));
    // Reset input so re-selecting the same file re-triggers change
    e.target.value = "";
  };

  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      removePlatform(platform);
    } else {
      addPlatform(platform);
    }
  };

  return (
    <div className="space-y-4">
      <Textarea
        placeholder="What's on your mind?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[150px] text-lg"
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {characterCount} / {currentLimit}
          {characterCount > currentLimit && " (exceeds limit)"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.keys(PLATFORM_LIMITS).map((platform) => {
          const meta = PLATFORM_META[platform];
          if (!meta) return null;
          const selected = selectedPlatforms.includes(platform);
          return (
            <button
              key={platform}
              type="button"
              onClick={() => togglePlatform(platform)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                selected
                  ? "border-transparent text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              style={
                selected
                  ? { backgroundColor: meta.color, borderColor: meta.color }
                  : {}
              }
            >
              <meta.Icon
                size={14}
                color={selected ? "#fff" : meta.color}
                aria-hidden
              />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="border-2 border-dashed rounded-lg p-6">
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center cursor-pointer"
        >
          <span className="text-sm text-muted-foreground">
            Click to upload images or videos
          </span>
        </label>
        {mediaUploads.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {mediaUploads.map((m) => (
              <div
                key={m.tempId}
                className="flex items-center gap-2 bg-secondary px-2 py-1 rounded text-xs"
              >
                {m.status === "uploading" && (
                  <Loader2
                    className="w-3 h-3 animate-spin"
                    aria-label="Uploading"
                  />
                )}
                {m.status === "failed" && (
                  <AlertCircle
                    className="w-3 h-3 text-destructive"
                    aria-label="Upload failed"
                  />
                )}
                <span className="max-w-[180px] truncate">{m.file.name}</span>
                {m.status === "uploading" && (
                  <span className="text-muted-foreground">{m.progress}%</span>
                )}
                {m.status === "failed" && m.error && (
                  <span className="text-destructive">{m.error}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeMediaUpload(m.tempId)}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Remove ${m.file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          value={scheduledAt ? scheduledAt.toISOString().slice(0, 16) : ""}
          onChange={(e) =>
            setScheduledAt(e.target.value ? new Date(e.target.value) : null)
          }
          className="flex-1 px-3 py-2 border rounded-md"
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handlePublish}
          disabled={!canPublish || isSubmitting || hasUploadingMedia}
          className="flex-1"
        >
          <Send className="w-4 h-4 mr-2" />
          Publish Now
        </Button>

        <Button
          onClick={handleSchedule}
          disabled={
            !canPublish || !scheduledAt || isSubmitting || hasUploadingMedia
          }
          variant="outline"
          className="flex-1"
        >
          <Clock className="w-4 h-4 mr-2" />
          Schedule
        </Button>

        <Button
          onClick={handleSaveDraft}
          disabled={!content || isSubmitting || hasUploadingMedia}
          variant="secondary"
          className="flex-1"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Draft
        </Button>
      </div>
    </div>
  );
}
