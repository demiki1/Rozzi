/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdf3',
          100: '#d7f9e2',
          500: '#0f9d58',
          600: '#0c7f47',
          700: '#0a6539',
        },
      },
    },
  },
  plugins: [],
};
