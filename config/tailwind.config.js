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
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        'redesign-display': ['Epilogue', 'sans-serif']
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
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
        },
        'redesign-primary': '#bca37f',
        'redesign-background-light': '#fdfaf6',
        'redesign-background-dark': '#1e1b18',
        'redesign-text-light': '#4a443c',
        'redesign-text-dark': '#e0dcd7',
        'redesign-card-light': '#f8f5f0',
        'redesign-card-dark': '#2a2622',
        'redesign-accent-light': '#d4c3a7',
        'redesign-accent-dark': '#a38e6d'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
