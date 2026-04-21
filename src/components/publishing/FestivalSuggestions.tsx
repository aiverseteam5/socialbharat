"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { usePublishing } from "@/hooks/usePublishing";
import { logger } from "@/lib/logger";
import type { IndianFestival } from "@/types/database";

export function FestivalSuggestions() {
  const [festivals, setFestivals] = useState<IndianFestival[]>([]);
  const { setFestivalContext, setContent } = usePublishing();

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/festivals?days=14");
        const data = (await response.json()) as { festivals: IndianFestival[] };
        setFestivals(data.festivals ?? []);
      } catch (error) {
        logger.error("Load upcoming festivals failed", error);
      }
    })();
  }, []);

  const handleGenerateContent = (festival: IndianFestival) => {
    setFestivalContext(festival.name);
    setContent(
      `🎉 ${festival.name}${festival.name_hi ? ` (${festival.name_hi})` : ""} is coming up! ${festival.suggested_hashtags.join(" ")}`,
    );
  };

  if (festivals.length === 0) {
    return null;
  }

  const f = festivals[0]!;

  return (
    <Card className="p-4 bg-gradient-to-r from-orange-100 to-yellow-100 border-orange-300">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-orange-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-orange-900">Upcoming Festival</h3>
          <div className="mt-2">
            <p className="text-sm text-orange-800">
              <span className="font-medium">{f.name}</span>
              {f.name_hi && (
                <span className="ml-2 text-orange-700">({f.name_hi})</span>
              )}
            </p>
            <p className="text-xs text-orange-700 mt-1">
              {new Date(f.festival_date + "T00:00:00").toLocaleDateString(
                "en-IN",
                {
                  month: "short",
                  day: "numeric",
                },
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {f.suggested_hashtags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-orange-200 px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => handleGenerateContent(f)}
            >
              Generate Content
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
