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
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        '2xl': '2rem',
        '3xl': '2.5rem',
        full: '9999px',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        softPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.88', transform: 'scale(1.01)' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        softPulse: 'softPulse 3.2s ease-in-out infinite',
        fadeIn: 'fadeIn 0.4s ease-out',
        scaleIn: 'scaleIn 0.3s ease-out',
        shimmer: 'shimmer 2s linear infinite'
      },
      colors: {
        // ===== LIGHT MODE WITH ORANGE ACCENTS =====

        // Primary brand colors - vibrant orange
        primary: {
          DEFAULT: '#F97316',       // Main orange - buttons, active states
          light: '#FB923C',         // Lighter variant
          dark: '#EA580C',          // Darker variant
          muted: '#FFF7ED',         // Very light orange for backgrounds
          foreground: '#FFFFFF'
        },

        // Warm accent - deeper orange for highlights
        warm: {
          DEFAULT: '#F97316',       // Vibrant orange
          light: '#FDBA74',         // Light orange
          dark: '#C2410C',          // Deep orange
          muted: '#FFF7ED',         // Very light orange bg
        },

        // Morning gradient colors - warm orange tones
        morning: {
          start: '#FFF7ED',         // Soft orange white
          mid: '#FFEDD5',           // Warm peach
          end: '#FED7AA',           // Light orange
          accent: '#F97316',        // Orange accent
        },

        // Evening gradient colors - amber/gold tones
        evening: {
          start: '#FEF3C7',         // Soft amber
          mid: '#FDE68A',           // Light gold
          end: '#FCD34D',           // Golden yellow
          accent: '#F59E0B',        // Amber accent
        },

        // Semantic backgrounds
        'hs-bg': {
          light: '#FFFFFF',         // Pure white (light mode)
          dark: '#0A0A0A',          // Near black (dark mode)
        },
        'hs-card': {
          light: '#FFFFFF',         // Pure white cards
          dark: '#171717',          // Dark gray
        },
        'hs-surface': {
          light: '#F8F8F8',         // Very light gray surface
          dark: '#262626',          // Dark surface
        },

        // Text colors
        'hs-text': {
          primary: '#1A1A1A',       // Near black (light mode)
          secondary: '#525252',     // Medium gray
          tertiary: '#737373',      // Light gray
          'primary-dark': '#FAFAFA',  // Near white (dark mode)
          'secondary-dark': '#A3A3A3', // Medium gray
          'tertiary-dark': '#737373',  // Darker gray
        },

        // Legacy mockup colors (kept for compatibility)
        'background-light': '#FFFFFF',
        'background-dark': '#0A0A0A',
        'text-primary-light': '#1A1A1A',
        'text-primary-dark': '#FAFAFA',
        'text-secondary-light': '#525252',
        'text-secondary-dark': '#A3A3A3',
        'card-light': '#FFFFFF',
        'card-dark': '#171717',
        'search-light': '#F8F8F8',
        'search-dark': '#262626',
        'chip-light': '#FFF7ED',
        'chip-dark': '#431407',
        'composer-light': '#FFFFFF',
        'composer-dark': '#171717',
        'placeholder-light': '#737373',
        'placeholder-dark': '#737373',

        // Accent colors for parts categories (orange-friendly palette)
        'accent-terracotta': '#EA580C',
        'accent-sage': '#65A30D',
        'accent-dusty-blue': '#0284C7',
        'accent-slate': '#64748B',
        'accent-ochre': '#D97706',
        'accent-mauve': '#A855F7',

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
        'subtle': '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
        'soft': '0 4px 16px 0 rgba(0, 0, 0, 0.06)',
        'warm': '0 4px 20px 0 rgba(249, 115, 22, 0.15)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 4px 12px 0 rgba(0, 0, 0, 0.03)',
        'card-hover': '0 2px 8px 0 rgba(0, 0, 0, 0.06), 0 8px 24px 0 rgba(0, 0, 0, 0.06)',
        'glow': '0 0 24px 0 rgba(249, 115, 22, 0.25)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
