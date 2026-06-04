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
        midnight: '#0D0D0D',
        charcoal: '#1A1A2E',
        navy: '#16213E',
        amber: {
          DEFAULT: '#D4A853',
          light: '#E8C97A',
          dark: '#B08930',
          glow: 'rgba(212, 168, 83, 0.3)',
        },
        coral: '#E94560',
        slate: {
          750: '#293548',
        }
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'spin-slow-paused': 'spin 8s linear infinite paused',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(212, 168, 83, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(212, 168, 83, 0.4)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
};
