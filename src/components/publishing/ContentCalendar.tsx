"use client";

import { type ReactNode, useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { IndianFestival } from "@/types/database";

export type { IndianFestival };

interface CalendarPost {
  id: string;
  content: string;
  status: "draft" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
}

interface ContentCalendarProps {
  festivals?: IndianFestival[];
  onFestivalClick?: (festival: IndianFestival) => void;
  onDateChange?: (date: Date) => void;
  onViewChange?: (view: "month" | "week" | "day") => void;
}

type CalendarView = "month" | "week" | "day";

// 6 AM to 11 PM = hours 6–23
const HOUR_SLOTS = Array.from({ length: 18 }, (_, i) => i + 6);

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(hour: number): string {
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function getDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function getStatusColor(status: string): string {
  switch (status) {
    case "draft":
      return "bg-gray-400";
    case "scheduled":
      return "bg-blue-500";
    case "published":
      return "bg-emerald-500";
    case "failed":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

function PostPill({ post }: { post: CalendarPost }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post-${post.id}`,
    data: { post },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`text-xs p-1 rounded text-white truncate cursor-grab active:cursor-grabbing select-none transition-opacity ${getStatusColor(post.status)} ${isDragging ? "opacity-30" : ""}`}
    >
      {post.content.substring(0, 22)}…
    </div>
  );
}

function DroppableSlot({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ""} transition-colors ${isOver ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
    >
      {children}
    </div>
  );
}

export function ContentCalendar({
  festivals = [],
  onFestivalClick,
  onDateChange,
  onViewChange,
}: ContentCalendarProps = {}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [activePost, setActivePost] = useState<CalendarPost | null>(null);

  // Default to day view on mobile
  useEffect(() => {
    if (window.innerWidth < 768) setView("day");
  }, []);

  // Notify parent of date/view changes for festival fetching sync
  useEffect(() => {
    onDateChange?.(currentDate);
  }, [currentDate, onDateChange]);
  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  const fetchPosts = useCallback(async () => {
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
      const first = days[0]!;
      const last = days[6]!;
      const start = new Date(
        Date.UTC(first.getFullYear(), first.getMonth(), first.getDate()),
      );
      const end = new Date(
        Date.UTC(last.getFullYear(), last.getMonth(), last.getDate() + 1),
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

    const response = await fetch(
      `/api/posts/calendar?start_date=${startDate}&end_date=${endDate}`,
    );
    const data = (await response.json()) as { posts?: CalendarPost[] };
    setPosts(data.posts ?? []);
  }, [currentDate, view]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        if (view === "month")
          return new Date(d.getFullYear(), d.getMonth() + dir);
        if (view === "week") {
          d.setDate(d.getDate() + dir * 7);
          return d;
        }
        d.setDate(d.getDate() + dir);
        return d;
      });
    },
    [view],
  );

  const getHeaderText = useCallback((): string => {
    if (view === "month") {
      return currentDate.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
    }
    if (view === "week") {
      const days = getWeekDays(currentDate);
      const start = days[0]!.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });
      const end = days[6]!.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${start} – ${end}`;
    }
    return currentDate.toLocaleDateString("en-IN", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [view, currentDate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const post = (event.active.data.current as { post?: CalendarPost })?.post;
    if (post) setActivePost(post);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActivePost(null);
      const { active, over } = event;
      if (!over) return;

      const postId = String(active.id).replace("post-", "");
      const slotId = String(over.id);
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      let newScheduledAt: Date;

      if (slotId.startsWith("month-")) {
        const dateStr = slotId.slice("month-".length);
        const parts = dateStr.split("-").map(Number) as [
          number,
          number,
          number,
        ];
        const [y, m, d] = parts;
        const orig = post.scheduled_at ? new Date(post.scheduled_at) : null;
        newScheduledAt = new Date(
          y,
          m - 1,
          d,
          orig?.getHours() ?? 9,
          orig?.getMinutes() ?? 0,
        );
      } else if (slotId.startsWith("time-")) {
        const rest = slotId.slice("time-".length);
        const lastDash = rest.lastIndexOf("-");
        const dateStr = rest.slice(0, lastDash);
        const hour = Number(rest.slice(lastDash + 1));
        const parts = dateStr.split("-").map(Number) as [
          number,
          number,
          number,
        ];
        const [y, m, d] = parts;
        newScheduledAt = new Date(y, m - 1, d, hour, 0);
      } else {
        return;
      }

      const newIso = newScheduledAt.toISOString();

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, scheduled_at: newIso, status: "scheduled" }
            : p,
        ),
      );

      try {
        const res = await fetch(`/api/posts/${postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduled_at: newIso }),
        });
        if (!res.ok) void fetchPosts();
      } catch {
        void fetchPosts();
      }
    },
    [posts, fetchPosts],
  );

  const postsForDate = useCallback(
    (dateStr: string) =>
      posts.filter(
        (p) =>
          p.scheduled_at && getDateStr(new Date(p.scheduled_at)) === dateStr,
      ),
    [posts],
  );

  const postsForSlot = useCallback(
    (dateStr: string, hour: number) =>
      posts.filter((p) => {
        if (!p.scheduled_at) return false;
        const d = new Date(p.scheduled_at);
        return getDateStr(d) === dateStr && d.getHours() === hour;
      }),
    [posts],
  );

  const festivalsForDate = useCallback(
    (dateStr: string) => festivals.filter((f) => f.festival_date === dateStr),
    [festivals],
  );

  const renderMonthView = () => {
    const daysInMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    ).getDate();
    const firstDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    ).getDay();
    const cells = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(
        <div
          key={`empty-${i}`}
          className="p-2 border border-gray-200 bg-gray-50 min-h-[100px]"
        />,
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = getDateStr(
        new Date(currentDate.getFullYear(), currentDate.getMonth(), day),
      );
      const dayPosts = postsForDate(dateStr);
      const isToday = dateStr === getDateStr(new Date());

      const dayFestivals = festivalsForDate(dateStr);

      cells.push(
        <DroppableSlot
          key={day}
          id={`month-${dateStr}`}
          className="p-2 border border-gray-200 min-h-[100px]"
        >
          <span
            className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white" : ""}`}
          >
            {day}
          </span>
          {dayFestivals.length > 0 && (
            <div className="mt-0.5 space-y-0.5">
              {dayFestivals.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onFestivalClick?.(f)}
                  className="w-full text-left text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors truncate font-medium"
                >
                  🎉 {f.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 space-y-1">
            {dayPosts.slice(0, 3).map((post) => (
              <PostPill key={post.id} post={post} />
            ))}
            {dayPosts.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{dayPosts.length - 3} more
              </span>
            )}
          </div>
        </DroppableSlot>,
      );
    }

    return (
      <div className="grid grid-cols-7 gap-0 border border-gray-200">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="p-2 border border-gray-200 bg-gray-100 font-medium text-sm text-center"
          >
            {d}
          </div>
        ))}
        {cells}
      </div>
    );
  };

  const renderTimeGrid = (days: Date[]) => {
    const today = getDateStr(new Date());

    return (
      <div className="overflow-auto max-h-[600px]">
        {/* Day headers */}
        <div
          className="grid sticky top-0 bg-white z-10 border-b border-gray-200"
          style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}
        >
          <div className="p-2" />
          {days.map((day) => {
            const ds = getDateStr(day);
            const isToday = ds === today;
            const dayFestivals = festivalsForDate(ds);
            return (
              <div
                key={ds}
                className="p-2 text-center border-l border-gray-200"
              >
                <div className="text-xs text-gray-500">
                  {DAY_NAMES[day.getDay()]}
                </div>
                <div
                  className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-sm font-medium mt-0.5 ${isToday ? "bg-blue-600 text-white" : ""}`}
                >
                  {day.getDate()}
                </div>
                {dayFestivals.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {dayFestivals.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => onFestivalClick?.(f)}
                        className="w-full text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors truncate font-medium"
                      >
                        🎉 {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Hour rows */}
        {HOUR_SLOTS.map((hour) => (
          <div
            key={hour}
            className="grid min-h-[60px]"
            style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}
          >
            <div className="p-1 text-xs text-gray-400 text-right pr-2 pt-1 shrink-0">
              {formatHour(hour)}
            </div>
            {days.map((day) => {
              const ds = getDateStr(day);
              const slotPosts = postsForSlot(ds, hour);
              return (
                <DroppableSlot
                  key={`${ds}-${hour}`}
                  id={`time-${ds}-${hour}`}
                  className="border-l border-t border-gray-100 p-1 space-y-1 min-h-[60px]"
                >
                  {slotPosts.map((post) => (
                    <PostPill key={post.id} post={post} />
                  ))}
                </DroppableSlot>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">{getHeaderText()}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(["month", "week", "day"] as const).map((v) => (
          <Button
            key={v}
            variant={view === v ? "default" : "outline"}
            size="sm"
            onClick={() => setView(v)}
            className="capitalize"
          >
            {v}
          </Button>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={(event) => {
          void handleDragEnd(event);
        }}
      >
        {view === "month" && renderMonthView()}
        {view === "week" && renderTimeGrid(getWeekDays(currentDate))}
        {view === "day" && renderTimeGrid([currentDate])}

        <DragOverlay>
          {activePost ? (
            <div
              className={`text-xs p-1 rounded text-white truncate cursor-grabbing shadow-lg max-w-[160px] ${getStatusColor(activePost.status)}`}
            >
              {activePost.content.substring(0, 22)}…
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="flex flex-wrap gap-4 mt-4 text-sm">
        {[
          { label: "Draft", color: "bg-gray-400" },
          { label: "Scheduled", color: "bg-blue-500" },
          { label: "Published", color: "bg-emerald-500" },
          { label: "Failed", color: "bg-red-500" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-3 h-3 ${color} rounded`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
