import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0f172a", soft: "#334155", mute: "#64748b" },
        line: "#e2e8f0",
        surface: "#f8fafc",
        brand: { 50: "#eef4ff", 100: "#dbe7ff", 500: "#2563eb", 600: "#1d4ed8", 700: "#1e40af" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: { card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)" },
    },
  },
  plugins: [],
} satisfies Config;
