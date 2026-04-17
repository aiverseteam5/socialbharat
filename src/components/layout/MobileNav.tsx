"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, PenTool, Inbox, BarChart3, Settings } from "lucide-react";

const navItems = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Publish", href: "/publishing", icon: PenTool },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white h-16 flex items-center justify-around px-1 z-50 shadow-[0_-1px_3px_0_rgb(0_0_0_/_0.06)]"
      aria-label="Mobile navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[52px]",
              isActive
                ? "text-brand-600"
                : "text-slate-400 hover:text-slate-700",
            )}
            aria-label={item.name}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-transform duration-150",
                isActive && "scale-110",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium",
                isActive && "font-semibold",
              )}
            >
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
