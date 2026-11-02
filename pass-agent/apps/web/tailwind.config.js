/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        saffron: { 500: "#f59e0b", 600: "#d97706" },
        navy: { 700: "#1e3a8a", 800: "#172554", 900: "#0b1533" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
