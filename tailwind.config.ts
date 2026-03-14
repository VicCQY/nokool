import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#DC2626",
          ink: "#0A0A0A",
          paper: "#FAFAFA",
          charcoal: "#1C1917",
        },
        slate: "#64748B",
        "muted-red": "#FEE2E2",
        cream: "#F5F0EB",
        "cool-gray": "#F3F4F6",
        status: {
          fulfilled: "#16A34A",
          "in-progress": "#2563EB",
          partial: "#D97706",
          "not-started": "#9CA3AF",
          broken: "#DC2626",
        },
        grade: {
          A: "#16A34A",
          B: "#2563EB",
          C: "#D97706",
          D: "#EA580C",
          F: "#DC2626",
        },
      },
      fontFamily: {
        headline: ["var(--font-dm-serif)", "serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
