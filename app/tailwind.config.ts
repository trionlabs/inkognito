import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          bg: "#0a0a0a",
          surface: "#141414",
          border: "#2e2e2e",
          "border-strong": "#404040",
          muted: "#a0a0a0",
          subtle: "#b8b8b8",
          text: "#d4d4d4",
          bright: "#f5f5f5",
          pipe: "#383838",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        mono: ["var(--font-ibm-mono)", "Menlo", "monospace"],
        sans: ["var(--font-ibm-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
