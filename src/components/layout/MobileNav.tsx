"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, PenTool, Inbox, BarChart3, Settings } from 'lucide-react'

const navItems = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Publish', href: '/dashboard/publishing', icon: PenTool },
  { name: 'Inbox', href: '/dashboard/inbox', icon: Inbox },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card h-16 flex items-center justify-around px-2 z-50">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-md transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs">{item.name}</span>
          </Link>
        )
      })}
    </div>
  )
}
