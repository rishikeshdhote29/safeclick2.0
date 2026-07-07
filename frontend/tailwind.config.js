/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 0 1px rgba(96,165,250,0.25), 0 20px 50px rgba(15,23,42,0.35)',
      },
    },
  },
  plugins: [],
};

