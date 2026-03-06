import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          primary: "#C0392B",  // Roof red — main brand color
          wood:    "#8B5E3C",  // Log brown — secondary
          dark:    "#4A3728",  // Dark wood — accents
          server:  "#1A2B4A", // Server window — CMDB accent
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
