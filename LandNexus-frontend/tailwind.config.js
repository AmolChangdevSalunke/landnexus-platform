/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#071528',
          900: '#0B1F3A',
          800: '#102A4C',
          700: '#163A63',
          600: '#1D4C7C',
        },
        blue: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          600: '#1D4ED8',
          700: '#1E40AF',
        },
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          600: '#D97706',
          700: '#B45309',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          600: '#0284C7',
          700: '#0369A1',
        },
        status: {
          draft: '#6B7280',
          submitted: '#1D4ED8',
          scrutiny: '#4338CA',
          clarification: '#B45309',
          recommended: '#0F766E',
          approved: '#15803D',
          rejected: '#B91C1C',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 31, 58, 0.06), 0 8px 24px rgba(11, 31, 58, 0.04)',
      },
    },
  },
  plugins: [],
}
