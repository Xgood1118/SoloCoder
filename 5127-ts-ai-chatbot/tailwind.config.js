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
        primary: '#4f6ef7',
        dark: {
          900: '#0f1225',
          800: '#1a1f36',
          700: '#252b45',
          600: '#2f3654',
        },
        light: {
          100: '#f5f6fa',
          200: '#e8eaf0',
          300: '#d1d5db',
        },
      },
      fontFamily: {
        sans: ['-apple-system', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
