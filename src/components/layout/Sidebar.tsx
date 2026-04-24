"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { t, getLocale } from "@/lib/i18n";
import { SIDEBAR_NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();
  const locale = getLocale();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-[#0f172a] shrink-0">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex items-center h-16 px-5 border-b border-slate-800"
      >
        <Image
          src="/logo-light.svg"
          alt="SocialBharat"
          width={160}
          height={32}
          priority
          className="h-7 w-auto"
        />
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {SIDEBAR_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const name = t(item.key, locale);
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.key}
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
              {name}
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
