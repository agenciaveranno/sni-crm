import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: { center: true, padding: '1.5rem' },
    extend: {
      fontFamily: {
        sans: ['var(--font-figtree)', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1B4FA8',
          light: '#4F8EF7',
          dark: '#0F3272',
          foreground: '#FFFFFF',
        },
        bg: '#F5F6FA',
        surface: '#FFFFFF',
        border: '#E2E8F0',
        muted: {
          DEFAULT: '#F5F6FA',
          foreground: '#64748B',
        },
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#0284C7',
        ink: '#1A1A1A',
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 50, 114, 0.04), 0 2px 8px rgba(15, 50, 114, 0.04)',
        topbar: '0 1px 3px rgba(15, 50, 114, 0.06)',
      },
    },
  },
  plugins: [animate],
}

export default config
