"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  PenTool,
  Inbox,
  BarChart3,
  Radio,
  Image,
  Sparkles,
  Settings
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Publishing', href: '/dashboard/publishing', icon: PenTool },
  { name: 'Inbox', href: '/dashboard/inbox', icon: Inbox },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Listening', href: '/dashboard/listening', icon: Radio },
  { name: 'Media', href: '/dashboard/media', icon: Image },
  { name: 'AI Studio', href: '/dashboard/ai-studio', icon: Sparkles },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden md:flex flex-col w-64 border-r bg-card h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground">SocialBharat</h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
