"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, FileText } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { logger } from "@/lib/logger";

interface DraftPost {
  id: string;
  content: string;
  created_at: string;
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/posts?status=draft");
      if (!response.ok) throw new Error("Failed to load drafts");
      const data = await response.json();
      setDrafts(data.posts || []);
    } catch (err) {
      logger.error("Fetch drafts failed", err);
      setError("Unable to load drafts.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;
    try {
      await fetch(`/api/posts/${id}`, { method: "DELETE" });
      setDrafts(drafts.filter((d) => d.id !== id));
    } catch (err) {
      logger.error("Delete draft failed", err, { draftId: id });
    }
  };

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState message={error} onRetry={fetchDrafts} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Drafts</h1>
        <p className="text-muted-foreground">Manage your unpublished posts.</p>
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No drafts yet"
          description="Posts you save as drafts will appear here."
          actionLabel="Compose a Post"
          actionHref="/publishing/compose"
        />
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <Card key={draft.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-3">
                    {draft.content.substring(0, 200)}
                    {draft.content.length > 200 ? "…" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {new Date(draft.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" aria-label="Edit draft">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(draft.id)}
                    aria-label="Delete draft"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
