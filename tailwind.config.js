/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/contexts/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F97316', // Orange-500
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        sidebar: {
          DEFAULT: '#FFFFFF',
          hover: '#FFF7ED', // Orange-50
          active: '#FEF2F2', // Light Orange/Red tint
          text: '#64748B', // Slate-500
          activeText: '#F97316',
        },
        card: {
          DEFAULT: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
