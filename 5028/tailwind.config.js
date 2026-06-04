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
        ocean: {
          50: "#E8F4F8",
          100: "#BBE1FA",
          200: "#8EC8E8",
          300: "#5DAED6",
          400: "#2E94C4",
          500: "#0F4C75",
          600: "#0D3F61",
          700: "#0A324D",
          800: "#072539",
          900: "#041825",
        },
        coral: {
          50: "#FFF0EB",
          100: "#FFD6C7",
          200: "#FFBCA3",
          300: "#FFA27F",
          400: "#FF885B",
          500: "#FF6B35",
          600: "#E55A25",
          700: "#CC4A18",
          800: "#B23A0C",
          900: "#992A00",
        },
        teal: {
          500: "#1B9AAA",
          600: "#158A99",
        },
        sand: {
          50: "#FEFCF8",
          100: "#FDF8ED",
          200: "#FAF0D7",
          300: "#F5E4B8",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(15, 76, 117, 0.08)",
        "card-hover": "0 4px 20px rgba(15, 76, 117, 0.15)",
        float: "0 8px 30px rgba(15, 76, 117, 0.12)",
      },
    },
  },
  plugins: [],
};
