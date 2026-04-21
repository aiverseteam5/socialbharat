"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, PenSquare } from "lucide-react";
import { usePublishingStore } from "@/stores/publishing-store";
import type { IndianFestival } from "@/types/database";

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const festDate = new Date(dateStr + "T00:00:00");
  return Math.round((festDate.getTime() - today.getTime()) / 86_400_000);
}

const TYPE_COLORS: Record<string, string> = {
  national: "bg-orange-100 text-orange-700",
  religious: "bg-purple-100 text-purple-700",
  commercial: "bg-blue-100 text-blue-700",
  regional: "bg-green-100 text-green-700",
  sporting: "bg-red-100 text-red-700",
};

export function UpcomingFestivalsWidget() {
  const router = useRouter();
  const { setFestivalContext } = usePublishingStore();
  const [festivals, setFestivals] = useState<IndianFestival[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/festivals/upcoming");
        if (!res.ok) return;
        const data = (await res.json()) as { festivals: IndianFestival[] };
        setFestivals((data.festivals ?? []).slice(0, 7));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreatePost = (festival: IndianFestival) => {
    setFestivalContext(festival.name);
    router.push("/publishing/compose");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-orange-500" />
            Upcoming Festivals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (festivals.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-orange-500" />
          Upcoming Festivals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {festivals.map((festival) => {
          const days = daysUntil(festival.festival_date);
          const colorClass =
            TYPE_COLORS[festival.type] ?? "bg-gray-100 text-gray-600";
          return (
            <div key={festival.id} className="flex items-start gap-3 group">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {festival.name}
                  </span>
                  {festival.name_hi && (
                    <span className="text-xs text-slate-400">
                      {festival.name_hi}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">
                    {new Date(
                      festival.festival_date + "T00:00:00",
                    ).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                    {" · "}
                    {days === 0
                      ? "Today"
                      : days === 1
                        ? "Tomorrow"
                        : `${days} days`}
                  </span>
                  <Badge
                    className={`text-[10px] px-1.5 py-0 ${colorClass} border-0`}
                  >
                    {festival.type}
                  </Badge>
                </div>
                {festival.suggested_hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {festival.suggested_hashtags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[10px] text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => handleCreatePost(festival)}
                title="Create post for this festival"
              >
                <PenSquare className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2 text-xs"
          onClick={() => router.push("/publishing/calendar")}
        >
          View full calendar
        </Button>
      </CardContent>
    </Card>
  );
}
