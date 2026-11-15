/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        hrms: {
          primary: '#102746',
          'primary-hover': '#19375E',
          accent: '#244A78',
          'accent-light': '#EAF2FB',
          canvas: '#F5F8FC',
          surface: '#FFFFFF',
          border: '#DCE5F0',
          text: '#1B2B43',
          muted: '#5A6B82',
          subtle: '#8C9BAE',
          success: '#0E7A4A',
          'success-light': '#E8F6EF',
          warning: '#B25E09',
          'warning-light': '#FEF3E6',
          danger: '#C53030',
          'danger-light': '#FDF0F0',
          info: '#1A56DB',
          'info-light': '#EDF2FE'
        },
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#1b3a5b',
          800: '#152e4a',
          900: '#102746',
          950: '#0a192f',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'hrms-card': '0 1px 3px 0 rgba(16, 39, 70, 0.06), 0 1px 2px 0 rgba(16, 39, 70, 0.04)',
        'hrms-dropdown': '0 10px 15px -3px rgba(16, 39, 70, 0.08), 0 4px 6px -2px rgba(16, 39, 70, 0.04)',
        'hrms-modal': '0 20px 25px -5px rgba(16, 39, 70, 0.12), 0 10px 10px -5px rgba(16, 39, 70, 0.06)',
      }
    },
  },
  plugins: [],
}
