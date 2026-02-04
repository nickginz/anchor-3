/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cad: {
          black: '#1a1a1a',
          dark: '#242424',
          gray: '#333333',
          light: '#4d4d4d',
          accent: '#007bff', // Example accent
        }
      }
    },
  },
  plugins: [],
}
