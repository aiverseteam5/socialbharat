import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://socialbharat.tynkai.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SocialBharat — India's AI Social Media Platform",
    template: "%s — SocialBharat",
  },
  description:
    "Manage WhatsApp Business, Instagram, Facebook with AI content in Hindi. From ₹499/month.",
  openGraph: {
    title: "SocialBharat — India's AI Social Media Platform",
    description:
      "WhatsApp Business inbox, AI in Hindi, 50+ Indian festivals. Built for Indian brands.",
    url: SITE_URL,
    siteName: "SocialBharat",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "SocialBharat",
    description: "India's AI social media platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
