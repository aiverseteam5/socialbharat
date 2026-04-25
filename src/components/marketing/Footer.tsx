import Link from "next/link";
import { Twitter, Instagram, Linkedin, Youtube } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const PRODUCT = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "API (coming soon)", href: "#" },
  { label: "Changelog", href: "#" },
];
const COMPANY = [
  { label: "About", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Careers", href: "#" },
  { label: "Press", href: "#" },
  { label: "Contact", href: "mailto:contact@tynkai.com" },
];
const LEGAL = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Data Deletion", href: "/data-deletion" },
];

export function MarketingFooter() {
  return (
    <footer className="bg-[#0F172A] text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo variant="white" size="sm" />
            <p className="mt-4 text-sm text-slate-400">
              India&apos;s AI Social Media Platform
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400 ring-1 ring-emerald-500/20">
              Powered by TynkAI
            </span>
            <p className="mt-6 text-xs text-slate-500">
              © 2026 SocialBharat. All rights reserved.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Product</h3>
            <ul className="mt-4 space-y-2">
              {PRODUCT.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-2">
              {COMPANY.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Legal</h3>
            <ul className="mt-4 space-y-2">
              {LEGAL.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2 text-xs text-slate-500">
                GST: 29XXXXXXXXX1ZX
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center">
          <p className="text-xs text-slate-500">
            SocialBharat is an AI-powered social media management platform for
            Indian brands.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="#"
              aria-label="Twitter"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Twitter className="h-4 w-4" />
            </Link>
            <Link
              href="#"
              aria-label="Instagram"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Instagram className="h-4 w-4" />
            </Link>
            <Link
              href="#"
              aria-label="LinkedIn"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Linkedin className="h-4 w-4" />
            </Link>
            <Link
              href="#"
              aria-label="YouTube"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Youtube className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
