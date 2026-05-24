/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#08080c',
        cardBg: 'rgba(20, 20, 28, 0.6)',
        cardBgSolid: '#14141c',
        accentRed: '#ff003c',
        accentRedHover: '#d00030',
        borderColor: 'rgba(255, 0, 60, 0.15)',
        textGray: '#a0a0ab',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        gaming: ['Outfit', 'sans-serif'],
      },
      boxShadow: {
        neonGlow: '0 0 15px rgba(255, 0, 60, 0.3)',
        neonGlowGreen: '0 0 15px rgba(0, 255, 60, 0.3)',
        neonHover: '0 0 25px rgba(255, 0, 60, 0.55)',
      }
    },
  },
  plugins: [],
}
