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
          50: '#FFF8F0',
          100: '#FFEFD6',
          200: '#FFD9A8',
          300: '#FFC078',
          400: '#FFA04A',
          500: '#E8722A',
          600: '#C85A18',
          700: '#A04410',
          800: '#7A340D',
          900: '#3D2B1F',
        },
        cream: '#FFF8F0',
        warm: {
          gray: '#F5EDE3',
          brown: '#3D2B1F',
          muted: '#8B7355',
        },
        mint: '#7EBF8E',
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'Georgia', 'serif'],
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '12px',
        'pill': '20px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 6px 16px rgba(0,0,0,0.12)',
        'warm': '0 2px 12px rgba(232,114,42,0.15)',
      },
    },
  },
  plugins: [],
};
