/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.js',
    './scripts/generate-instant-shell.mjs'
  ],
  theme: {
    extend: {
      spacing: {
        '7.5': '1.875rem',
        '8.5': '2.125rem'
      },
      screens: {
        xs: '420px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      colors: {
        brand: {
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5'
        }
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'none' }
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out forwards',
        shimmer: 'shimmer 1.8s infinite'
      }
    }
  },
  safelist: [
    'animate-fadeIn',
    'animate-shimmer',
    'text-indigo-500',
    'text-emerald-500',
    'text-blue-500',
    'text-rose-500',
    'text-amber-500',
    'text-red-500',
    'text-cyan-500',
    'text-orange-500'
  ],
  plugins: []
};
