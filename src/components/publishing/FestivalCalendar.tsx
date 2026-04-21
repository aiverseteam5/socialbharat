"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ContentCalendar } from "./ContentCalendar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Hash, Lightbulb, PenSquare } from "lucide-react";
import { usePublishingStore } from "@/stores/publishing-store";
import type { IndianFestival } from "@/types/database";

function formatTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${suffix}`;
}

function getWeekDays(anchor: Date): Date[] {
  const day = anchor.getDay();
  const sunday = new Date(anchor);
  sunday.setDate(anchor.getDate() - day);
  sunday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

export function FestivalCalendar() {
  const router = useRouter();
  const { setFestivalContext } = usePublishingStore();
  const [selectedFestival, setSelectedFestival] =
    useState<IndianFestival | null>(null);
  const [festivals, setFestivals] = useState<IndianFestival[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");

  const fetchFestivals = useCallback(async () => {
    let startDate: string, endDate: string;

    if (view === "month") {
      const start = new Date(
        Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), 1),
      );
      const end = new Date(
        Date.UTC(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
      );
      startDate = start.toISOString().split("T")[0]!;
      endDate = end.toISOString().split("T")[0]!;
    } else if (view === "week") {
      const days = getWeekDays(currentDate);
      const start = new Date(
        Date.UTC(
          days[0]!.getFullYear(),
          days[0]!.getMonth(),
          days[0]!.getDate(),
        ),
      );
      const end = new Date(
        Date.UTC(
          days[6]!.getFullYear(),
          days[6]!.getMonth(),
          days[6]!.getDate() + 1,
        ),
      );
      startDate = start.toISOString().split("T")[0]!;
      endDate = end.toISOString().split("T")[0]!;
    } else {
      const start = new Date(
        Date.UTC(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
        ),
      );
      const end = new Date(
        Date.UTC(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() + 1,
        ),
      );
      startDate = start.toISOString().split("T")[0]!;
      endDate = end.toISOString().split("T")[0]!;
    }

    const res = await fetch(
      `/api/festivals?start_date=${startDate}&end_date=${endDate}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as { festivals: IndianFestival[] };
    setFestivals(data.festivals ?? []);
  }, [currentDate, view]);

  useEffect(() => {
    void fetchFestivals();
  }, [fetchFestivals]);

  const handleCreatePost = useCallback(
    (festival: IndianFestival) => {
      setFestivalContext(festival.name);
      router.push("/publishing/compose");
    },
    [setFestivalContext, router],
  );

  return (
    <>
      <ContentCalendar
        festivals={festivals}
        onFestivalClick={setSelectedFestival}
        onDateChange={setCurrentDate}
        onViewChange={setView}
      />

      <Sheet
        open={!!selectedFestival}
        onOpenChange={(open) => {
          if (!open) setSelectedFestival(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
        >
          {selectedFestival && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-xl">
                  {selectedFestival.name}
                  {selectedFestival.name_hi && (
                    <span className="ml-2 text-base font-normal text-slate-500">
                      ({selectedFestival.name_hi})
                    </span>
                  )}
                </SheetTitle>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>
                    {new Date(
                      selectedFestival.festival_date + "T00:00:00",
                    ).toLocaleDateString("en-IN", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <Badge variant="secondary" className="capitalize">
                    {selectedFestival.type}
                  </Badge>
                </div>
              </SheetHeader>

              {/* Best posting window */}
              {(selectedFestival.best_posting_start ??
                selectedFestival.best_posting_end) && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Best Posting Window (IST)
                  </h4>
                  <p className="text-sm text-slate-600">
                    {formatTime(selectedFestival.best_posting_start)} –{" "}
                    {formatTime(selectedFestival.best_posting_end)}
                  </p>
                </div>
              )}

              {/* Suggested hashtags */}
              {selectedFestival.suggested_hashtags.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Hash className="w-4 h-4 text-purple-500" />
                    Suggested Hashtags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFestival.suggested_hashtags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Content ideas */}
              {selectedFestival.content_ideas.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    Content Ideas
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedFestival.content_ideas.map((idea, i) => (
                      <li key={i} className="text-sm text-slate-600 flex gap-2">
                        <span className="text-slate-400 shrink-0">
                          {i + 1}.
                        </span>
                        {idea}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => handleCreatePost(selectedFestival)}
              >
                <PenSquare className="w-4 h-4 mr-2" />
                Create Post for This Festival
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
