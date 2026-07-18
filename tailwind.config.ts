import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Atelier warm scholarly palette
        paper: {
          50: "#FDFBF6",
          100: "#FBF7EE",
          200: "#F5EEE0",
          300: "#EDE3CF",
          400: "#E0D2B4",
        },
        ink: {
          50: "#F5F2EB",
          100: "#E8E2D5",
          200: "#C9C0AC",
          300: "#A89F8A",
          400: "#7C7361",
          500: "#5A5346",
          600: "#3D382E",
          700: "#2B271F",
          800: "#1F1C16",
          900: "#14120E",
        },
        ember: {
          50: "#FDF6EC",
          100: "#FAE8CC",
          200: "#F4CC8E",
          300: "#EDAE4E",
          400: "#E2942A",
          500: "#C8821A", // primary accent
          600: "#A56813",
          700: "#7E4F10",
          800: "#57370B",
          900: "#332106",
        },
        moss: {
          400: "#7BA67E",
          500: "#5B8A60",
          600: "#436B49",
        },
        cefr: {
          a1: "#5B8A60", // moss green - beginner/fresh
          a2: "#4A9E9C", // teal
          b1: "#C8821A", // amber - intermediate
          b2: "#B5552E", // warm rust - advanced
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3rem, 8vw, 6rem)", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(2.25rem, 5vw, 3.75rem)", { lineHeight: "1", letterSpacing: "-0.025em" }],
        "display-md": ["clamp(1.75rem, 3.5vw, 2.5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        "soft": "0 2px 8px -2px rgba(31, 28, 22, 0.06), 0 8px 24px -8px rgba(31, 28, 22, 0.08)",
        "soft-lg": "0 4px 16px -4px rgba(31, 28, 22, 0.08), 0 16px 48px -12px rgba(31, 28, 22, 0.12)",
        "ember": "0 4px 20px -4px rgba(200, 130, 26, 0.35)",
        "inset-line": "inset 0 -1px 0 0 rgba(31, 28, 22, 0.06)",
      },
      backgroundImage: {
        "paper-grain": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "shimmer": "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
