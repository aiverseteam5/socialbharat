"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PenTool,
  Inbox,
  BarChart3,
  Radio,
  Image,
  Sparkles,
  Settings,
  MessageCircle,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Publishing", href: "/publishing", icon: PenTool },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Listening", href: "/listening", icon: Radio },
  { name: "Media", href: "/media", icon: Image },
  { name: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
  { name: "AI Studio", href: "/dashboard/ai-studio", icon: Sparkles },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-[#0f172a] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 h-16 px-5 border-b border-slate-800">
        <div className="h-7 w-7 rounded-md bg-brand-600 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs leading-none">SB</span>
        </div>
        <span className="font-semibold text-slate-100 tracking-tight text-sm">
          Social<span className="text-brand-400">Bharat</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200",
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand-500" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors duration-200",
                  isActive
                    ? "text-brand-400"
                    : "text-slate-500 group-hover:text-slate-300",
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">
          SocialBharat v1.0
        </p>
      </div>
    </aside>
  );
}
