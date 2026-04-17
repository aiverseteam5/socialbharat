"use client";

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
import { Bell, Menu } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { t, getLocale } from "@/lib/i18n";

export function Header() {
  const { user, currentOrg, role, signOut } = useAuthStore();
  const router = useRouter();
  const locale = getLocale();

  const userInitial =
    user?.user_metadata?.full_name?.[0] || user?.email?.[0] || "U";
  const orgName = (currentOrg as { name?: string })?.name || "Organisation";

  return (
    <header className="bg-white border-b border-slate-200 h-16 px-4 flex items-center justify-between shrink-0">
      {/* Left: hamburger (mobile) */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-slate-500 hover:text-slate-900"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {/* Breadcrumb placeholder — left empty; page titles render within <main> */}
      </div>

      {/* Right: language, notifications, user */}
      <div className="flex items-center gap-1">
        <LanguageSwitcher />

        <Button
          variant="ghost"
          size="icon"
          className="relative text-slate-500 hover:text-slate-900"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 h-2 w-2 bg-brand-500 rounded-full ring-2 ring-white"
          />
        </Button>

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
            <DropdownMenuItem onClick={() => router.push("/settings/team")}>
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
