import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* SocialBharat brand palette — electric blue, #3B82F6 as 500 */
        brand: {
          "50": "#EFF6FF",
          "100": "#DBEAFE",
          "200": "#BFDBFE",
          "300": "#93C5FD",
          "400": "#60A5FA",
          "500": "#3B82F6",
          "600": "#2563EB",
          "700": "#1D4ED8",
          "800": "#1E40AF",
          "900": "#1E3A8A",
          "950": "#172554",
        },
        /* Accent purple — for gradient pair-stops with brand */
        accent2: {
          "50": "#F5F3FF",
          "100": "#EDE9FE",
          "200": "#DDD6FE",
          "300": "#C4B5FD",
          "400": "#A78BFA",
          "500": "#8B5CF6",
          "600": "#7C3AED",
          "700": "#6D28D9",
          "800": "#5B21B6",
          "900": "#4C1D95",
        },
        /* Sidebar specific tokens */
        sidebar: {
          DEFAULT: "#0B1220" /* deep navy */,
          hover: "#111A2E",
          active: "#172238",
          border: "#172238",
          text: "#94A3B8" /* slate-400 */,
          "text-active": "#F8FAFC" /* slate-50 */,
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover":
          "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        glow: "0 10px 40px -10px rgb(59 130 246 / 0.45)",
        "glow-purple": "0 10px 40px -10px rgb(139 92 246 / 0.45)",
        "glow-lg": "0 20px 60px -12px rgb(59 130 246 / 0.35)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
        "brand-radial":
          "radial-gradient(circle at 30% 20%, rgba(59,130,246,0.18), transparent 55%), radial-gradient(circle at 80% 70%, rgba(139,92,246,0.18), transparent 55%)",
      },
      keyframes: {
        "slide-up-fade": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "slide-up-fade": "slide-up-fade 0.18s ease-out",
        "gradient-shift": "gradient-shift 8s ease infinite",
        float: "float 4s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;
