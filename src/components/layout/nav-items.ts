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
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { key: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "nav.publishing", href: "/publishing", icon: PenTool },
  { key: "nav.inbox", href: "/inbox", icon: Inbox },
  { key: "nav.leads", href: "/leads", icon: Users },
  { key: "nav.analytics", href: "/analytics", icon: BarChart3 },
  { key: "nav.listening", href: "/listening", icon: Radio },
  { key: "nav.media", href: "/media", icon: Image },
  { key: "nav.ai_studio", href: "/ai-agent", icon: Sparkles },
  { key: "nav.whatsapp", href: "/whatsapp", icon: MessageCircle },
  { key: "nav.settings", href: "/settings", icon: Settings },
];
