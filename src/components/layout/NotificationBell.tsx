"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  UserPlus,
  CreditCard,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import type { NotificationType } from "@/lib/notifications/send";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotifIcon({ type }: { type: string }) {
  const t = type as NotificationType;
  const cls = "w-4 h-4 shrink-0";
  if (t === "post_published")
    return <CheckCircle className={`${cls} text-emerald-500`} />;
  if (t === "post_failed")
    return <AlertCircle className={`${cls} text-red-500`} />;
  if (t === "post_approved")
    return <FileCheck className={`${cls} text-blue-500`} />;
  if (t === "post_rejected")
    return <AlertCircle className={`${cls} text-amber-500`} />;
  if (t === "post_approval_requested")
    return <FileCheck className={`${cls} text-purple-500`} />;
  if (t === "inbox_message")
    return <MessageSquare className={`${cls} text-sky-500`} />;
  if (t === "team_member_invited" || t === "team_member_joined")
    return <UserPlus className={`${cls} text-violet-500`} />;
  if (t === "payment_received")
    return <CreditCard className={`${cls} text-emerald-500`} />;
  return <Bell className={`${cls} text-gray-400`} />;
}

export function NotificationBell() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=15");
    if (!res.ok) return;
    const data = (await res.json()) as {
      notifications: Notification[];
      unread_count: number;
    };
    setNotifications(data.notifications);
    setUnreadCount(data.unread_count);
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new as Notification;
          setNotifications((prev) => [notif, ...prev.slice(0, 14)]);
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "PUT" });
  }, []);

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) void fetchNotifications();
    },
    [fetchNotifications],
  );

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-slate-500" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-slate-900">
            Notifications
          </span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No notifications yet
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!notif.is_read ? "bg-blue-50/40" : ""}`}
                onClick={() => {
                  if (!notif.is_read) void markRead(notif.id);
                  if (notif.link) window.location.href = notif.link;
                }}
              >
                <div className="mt-0.5">
                  <NotifIcon type={notif.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-snug truncate ${!notif.is_read ? "font-semibold text-slate-900" : "text-slate-700"}`}
                  >
                    {notif.title}
                  </p>
                  {notif.body && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {notif.body}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    {timeAgo(notif.created_at)}
                  </p>
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                )}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
