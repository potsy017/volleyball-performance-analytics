/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#C8E600',
        'primary-dark': '#9AB000',
        'primary-light': '#E0FF4F',
        bg: {
          base: '#0A0B0E',
          card: '#13151A',
          nav: '#0D0F13',
          hover: '#1A1D24',
        },
        accent: {
          green: '#4CAF50',
          yellow: '#F5C400',
          red: '#F44336',
          blue: '#2196F3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
