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
  vignette: { inner: 0.10, mid: 0.22, outer: 0.38 },
  blobs: [
    { x: -140, y: -80, size: 520, color: '#1f3a3f' },
    { x: 140, y: 60, size: 460, color: '#2a4d52' },
    { x: 20, y: 180, size: 620, color: '#d39a78' },
  ],
  fontFamilyVar: '--font-ethereal',
  text: {
    assistantOpacity: 0.85,
    userOpacity: 0.80,
    letterSpacingAssistant: '0',
    letterSpacingUser: '0',
  },
  animation: {
    wordDurationMs: 2000,
    charDurationMs: 1000,
    streamTickMs: 150,
    streamCharsPerTick: 8,
  },
  variants: {
    chat: {
      gradient: 'linear-gradient(180deg, rgba(4,13,16,1) 0%, rgba(14,26,30,1) 50%, rgba(10,20,22,1) 100%)',
    },
  },
}
