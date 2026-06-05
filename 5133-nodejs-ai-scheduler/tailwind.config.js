/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        brand: {
          bg: "#0F1117",
          surface: "#1A1D27",
          border: "#2A2D3A",
          text: "#E1E4EB",
          muted: "#6B7280",
          cyan: "#00E5FF",
          amber: "#FFB300",
          red: "#FF5252",
          green: "#4CAF50",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Noto Sans SC", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
