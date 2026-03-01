import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#edfcf4",
          100: "#d3f8e5",
          200: "#aaf0ce",
          300: "#73e3b0",
          400: "#3acf8d",
          500: "#16b872",
          600: "#0a9459",
          700: "#097549",
          800: "#0b5d3c",
          900: "#0a4d33",
          950: "#042b1d",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
