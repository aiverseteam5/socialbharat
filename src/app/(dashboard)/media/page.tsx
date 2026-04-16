"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FolderOpen } from "lucide-react";
import { logger } from "@/lib/logger";

interface MediaAsset {
  id: string;
  file_name: string;
  cdn_url: string | null;
  created_at: string;
}

export default function MediaPage() {
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMediaAssets();
  }, []);

  const fetchMediaAssets = async () => {
    try {
      const response = await fetch("/api/media");
      const data = await response.json();
      setMediaAssets(data.mediaAssets || []);
    } catch (error) {
      logger.error("Fetch media assets failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      fetchMediaAssets();
    } catch (error) {
      logger.error("Upload media file failed", error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading media...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Media Library</h1>
          <p className="text-muted-foreground">
            Manage your images and videos.
          </p>
        </div>
        <div>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleUpload}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload">
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </label>
        </div>
      </div>

      {mediaAssets.length === 0 ? (
        <Card className="p-8 text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No media assets yet</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {mediaAssets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <div className="aspect-square bg-gray-100">
                {asset.cdn_url &&
                asset.file_name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img
                    src={asset.cdn_url}
                    alt={asset.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <span className="text-xs">{asset.file_name}</span>
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs truncate">{asset.file_name}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
