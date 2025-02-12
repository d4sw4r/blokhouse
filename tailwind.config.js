// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Define some custom brand colors
        brandWood: "#A0522D", // a warm wood tone
        brandRoof: "#B22222", // a strong red for the roof
        brandSnow: "#F0F8FF", // a cool, snowy white/blue tint
        // Add any additional colors you feel represent Blokhouse
      },
    },
  },
  plugins: [],
};
