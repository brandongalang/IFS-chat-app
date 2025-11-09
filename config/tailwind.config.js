const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    path.join(projectRoot, 'components/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(projectRoot, 'app/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(projectRoot, 'app/_shared/**/*.{js,ts,jsx,tsx,mdx}')
  ],
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        softPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.88', transform: 'scale(1.01)' }
        }
      },
      animation: {
        softPulse: 'softPulse 3.2s ease-in-out infinite'
      },
      colors: {
        // Mockup design system colors
        primary: {
          DEFAULT: '#7C9A92', // Today screen primary
          journal: '#A3B1A0', // Journal screen primary
          garden: '#13ecec', // Garden screen primary
          foreground: '#FFFFFF'
        },
        'background-light': '#F8F8F7',
        'background-dark': '#121212',
        'text-primary-light': '#333333',
        'text-primary-dark': '#E0E0E0',
        'text-secondary-light': '#888888',
        'text-secondary-dark': '#A0A0A0',
        'card-light': '#FFFFFF',
        'card-dark': '#1C1C1E',
        'search-light': '#EAE8E4',
        'search-dark': '#203434',
        'chip-light': '#EAEFE9',
        'chip-dark': '#363D39',
        'composer-light': '#FFFFFF',
        'composer-dark': '#2A2E2C',
        'placeholder-light': '#8A9BA8',
        'placeholder-dark': '#8A9BA8',
        // Accent colors for parts categories
        'accent-terracotta': '#E2725B',
        'accent-sage': '#87ae73',
        'accent-dusty-blue': '#6b8eA3',
        'accent-slate': '#708090',
        'accent-ochre': '#cc7722',
        'accent-mauve': '#917293',
        // Legacy shadcn colors (kept for compatibility)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      boxShadow: {
        'subtle': '0 4px 12px 0 rgba(0, 0, 0, 0.05)',
        'soft': '0 4px 12px 0 rgba(0, 0, 0, 0.05)',
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
