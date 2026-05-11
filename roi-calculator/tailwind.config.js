/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Anton"', '"Bebas Neue"', 'Impact', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0a0a0a',
        panel: '#111111',
        rail: '#1a1a1a',
        muted: '#9ca3af',
        accent: '#facc15',
      },
    },
  },
  plugins: [],
}
