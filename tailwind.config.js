/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        govblue: {
          50: "#eff5fb",
          100: "#d9e6f4",
          500: "#1e3a8a",
          600: "#172e6e",
          700: "#0f2052",
          800: "#0a173d",
        },
        govgold: {
          400: "#e0b14a",
          500: "#c8961f",
          600: "#a87a14",
        },
      },
      fontFamily: {
        sans: ["'Sarabun'", "'Inter'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
