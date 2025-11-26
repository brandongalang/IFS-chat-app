import { animationDefaults } from './animation'

export type EtherealThemeVariant = {
  gradient?: string
}

export type EtherealTheme = {
  enabled: boolean
  imageUrl: string
  vignette: { inner: number; mid: number; outer: number }
  blobs: { x: number; y: number; size: number; color: string }[]
  fontFamilyVar: string
  text: {
    assistantOpacity: number
    userOpacity: number
    letterSpacingAssistant: string
    letterSpacingUser: string
  }
  animation: {
    wordDurationMs: number
    charDurationMs: number
    streamTickMs: number
    streamCharsPerTick: number
  }
  variants: Record<string, EtherealThemeVariant>
}

export const defaultEtherealTheme: EtherealTheme = {
  enabled: true,
  imageUrl: '/ethereal-bg.jpg',
  vignette: { inner: 0.02, mid: 0.05, outer: 0.08 },
  blobs: [
    { x: -140, y: -80, size: 520, color: '#FFF7ED' },
    { x: 140, y: 60, size: 460, color: '#FFEDD5' },
    { x: 20, y: 180, size: 620, color: '#FED7AA' },
  ],
  fontFamilyVar: '--font-ethereal',
  text: {
    assistantOpacity: 1.0,
    userOpacity: 1.0,
    letterSpacingAssistant: '0',
    letterSpacingUser: '0',
  },
  animation: {
    wordDurationMs: animationDefaults.wordDurationMs,
    charDurationMs: animationDefaults.charDurationMs,
    streamTickMs: 150,
    streamCharsPerTick: 8,
  },
  variants: {
    chat: {
      gradient: 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,247,237,1) 50%, rgba(255,237,213,1) 100%)',
    },
  },
}
