/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // New brand colors
        brandPrimary: "#4F46E5",  // Indigo-600
        brandSecondary: "#10B981", // Emerald-500
        brandAccent: "#6366F1",    // Indigo-500
        brandBackground: "#F3F4F6", // Gray-100
        brandText: "#1F2937",       // Gray-800
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
