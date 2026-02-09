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
        health: {
          excellent: "#10b981",
          good: "#34d399",
          moderate: "#fbbf24",
          caution: "#f97316",
          danger: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
export default config;
