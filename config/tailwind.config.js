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
        // ===== HEADSPACE-INSPIRED DESIGN SYSTEM =====

        // Primary brand colors - calming teal/sage
        primary: {
          DEFAULT: '#3D8B7A',       // Main teal - buttons, active states
          light: '#5BA899',         // Lighter variant
          dark: '#2D6B5E',          // Darker variant
          muted: '#E8F4F1',         // Very light teal for backgrounds
          foreground: '#FFFFFF'
        },

        // Warm accent - coral/orange for highlights
        warm: {
          DEFAULT: '#F4A261',       // Warm coral
          light: '#F7BC8A',         // Light coral
          dark: '#E8854A',          // Darker coral
          muted: '#FEF4EB',         // Very light coral bg
        },

        // Morning gradient colors
        morning: {
          start: '#FFE5D4',         // Soft peach
          mid: '#FFECD9',           // Warm cream
          end: '#FFF8F0',           // Light warm white
          accent: '#F4A261',        // Coral accent
        },

        // Evening gradient colors
        evening: {
          start: '#E8DFF5',         // Soft lavender
          mid: '#DED6F0',           // Light purple
          end: '#F5F3F8',           // Very light purple
          accent: '#9B8AB8',        // Muted purple accent
        },

        // Semantic backgrounds
        'hs-bg': {
          light: '#FBF9F7',         // Warm cream (light mode)
          dark: '#1A1A1A',          // Charcoal (dark mode)
        },
        'hs-card': {
          light: '#FFFFFF',         // Pure white cards
          dark: '#262626',          // Warm dark gray
        },
        'hs-surface': {
          light: '#F5F3F0',         // Slightly darker surface
          dark: '#2D2D2D',          // Lighter dark surface
        },

        // Text colors
        'hs-text': {
          primary: '#2D3436',       // Soft black (light mode)
          secondary: '#6B7280',     // Medium gray
          tertiary: '#9CA3AF',      // Light gray
          'primary-dark': '#F0EDEB',  // Warm white (dark mode)
          'secondary-dark': '#A8A29E', // Warm gray
          'tertiary-dark': '#78716C',  // Darker warm gray
        },

        // Legacy mockup colors (kept for compatibility)
        'background-light': '#FBF9F7',
        'background-dark': '#1A1A1A',
        'text-primary-light': '#2D3436',
        'text-primary-dark': '#F0EDEB',
        'text-secondary-light': '#6B7280',
        'text-secondary-dark': '#A8A29E',
        'card-light': '#FFFFFF',
        'card-dark': '#262626',
        'search-light': '#F5F3F0',
        'search-dark': '#2D2D2D',
        'chip-light': '#E8F4F1',
        'chip-dark': '#2D4A44',
        'composer-light': '#FFFFFF',
        'composer-dark': '#2A2E2C',
        'placeholder-light': '#9CA3AF',
        'placeholder-dark': '#78716C',

        // Accent colors for parts categories (updated warmer tones)
        'accent-terracotta': '#E07A5F',
        'accent-sage': '#81B29A',
        'accent-dusty-blue': '#7BA3B8',
        'accent-slate': '#6B7F8C',
        'accent-ochre': '#D4A03D',
        'accent-mauve': '#A07DA8',

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
        'warm': '0 4px 20px 0 rgba(244, 162, 97, 0.15)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 4px 12px 0 rgba(0, 0, 0, 0.03)',
        'card-hover': '0 2px 8px 0 rgba(0, 0, 0, 0.06), 0 8px 24px 0 rgba(0, 0, 0, 0.06)',
        'glow': '0 0 24px 0 rgba(61, 139, 122, 0.2)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
