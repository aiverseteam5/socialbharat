import Link from "next/link";
import { Twitter, Instagram, Linkedin, Youtube } from "lucide-react";

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
  { label: "Contact", href: "mailto:hello@socialbharat.ai" },
];
const LEGAL = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Cookie Policy", href: "#" },
  { label: "DPDP Compliance", href: "#" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-1 text-xl font-bold tracking-tight">
              <span className="text-slate-800">Social</span>
              <span style={{ color: "#FF6B35" }}>Bharat</span>
              <span aria-hidden>🇮🇳</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              India&apos;s AI Social Media OS
            </p>
            <p className="mt-6 text-xs text-slate-500">
              © 2026 SocialBharat. All rights reserved.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Made with <span style={{ color: "#FF6B35" }}>❤</span> in Bengaluru
              🇮🇳
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Product</h3>
            <ul className="mt-4 space-y-2">
              {PRODUCT.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-600 transition-colors hover:text-slate-900"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Company</h3>
            <ul className="mt-4 space-y-2">
              {COMPANY.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-600 transition-colors hover:text-slate-900"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Legal</h3>
            <ul className="mt-4 space-y-2">
              {LEGAL.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-600 transition-colors hover:text-slate-900"
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

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-100 pt-6 md:flex-row md:items-center">
          <p className="text-xs text-slate-500">
            SocialBharat is an AI-powered social media management platform for
            Indian brands.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="#"
              aria-label="Twitter"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Twitter className="h-4 w-4" />
            </Link>
            <Link
              href="#"
              aria-label="Instagram"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Instagram className="h-4 w-4" />
            </Link>
            <Link
              href="#"
              aria-label="LinkedIn"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Linkedin className="h-4 w-4" />
            </Link>
            <Link
              href="#"
              aria-label="YouTube"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Youtube className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
