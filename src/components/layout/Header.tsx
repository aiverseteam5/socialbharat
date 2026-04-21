"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { t, getLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV_ITEMS } from "./nav-items";

export function Header() {
  const { user, currentOrg, role, signOut } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userInitial =
    user?.user_metadata?.full_name?.[0] || user?.email?.[0] || "U";
  const orgName = (currentOrg as { name?: string })?.name || "Organisation";

  return (
    <header className="bg-white border-b border-slate-200 h-16 px-4 flex items-center justify-between shrink-0">
      {/* Left: hamburger (mobile) */}
      <div className="flex items-center gap-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-slate-500 hover:text-slate-900"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-[#0f172a] p-0 w-64">
            <div className="flex items-center gap-2.5 h-16 px-5 border-b border-slate-800">
              <div className="h-7 w-7 rounded-md bg-brand-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xs leading-none">
                  SB
                </span>
              </div>
              <span className="font-semibold text-slate-100 tracking-tight text-sm">
                Social<span className="text-brand-400">Bharat</span>
              </span>
            </div>
            <nav className="px-3 py-4 space-y-0.5">
              {SIDEBAR_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const name = t(item.key, locale);
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-slate-800 text-slate-100"
                        : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-brand-400" : "text-slate-500",
                      )}
                    />
                    {name}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
        {/* Breadcrumb placeholder — left empty; page titles render within <main> */}
      </div>

      {/* Right: language, notifications, user */}
      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full p-0 ml-1"
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user?.user_metadata?.avatar_url}
                  alt={user?.user_metadata?.full_name || "User"}
                />
                <AvatarFallback className="bg-brand-100 text-brand-700 font-semibold text-xs">
                  {userInitial.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none text-slate-900">
                  {user?.user_metadata?.full_name || "User"}
                </p>
                <p className="text-xs leading-none text-slate-500">
                  {user?.email || user?.phone || ""}
                </p>
                <p className="text-xs leading-none text-slate-400">
                  {orgName}
                  {role
                    ? ` · ${role.charAt(0).toUpperCase()}${role.slice(1)}`
                    : ""}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              {t("nav.settings", locale)}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-red-600 focus:text-red-600"
            >
              {t("common.sign_out", locale)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
