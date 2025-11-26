'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { defaultEtherealTheme as T } from '@/config/etherealTheme'

export function GlobalBackdrop() {
  const pathname = usePathname()
  const variantGradientKey = useMemo(() => {
    if (!pathname) return null
    const normalized = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    if (normalized === '/chat' && T.variants.chat?.gradient) return 'chat'
    return null
  }, [pathname])

  return (
    <div className="pointer-events-none fixed inset-0 -z-30 overflow-hidden bg-white" style={{ opacity: 'var(--eth-enabled, 1)' }}>
      {variantGradientKey ? <VariantGradientLayer variantKey={variantGradientKey} /> : null}
      <GradientBackdrop />
    </div>
  )
}

function VariantGradientLayer({ variantKey }: { variantKey: string }) {
  return (
    <div
      className="absolute inset-0 z-0"
      style={{ background: `var(--eth-variant-${variantKey}-gradient, transparent)` }}
    />
  )
}

function GradientBackdrop() {
  // Light mode gradient with subtle orange accents
  const blobs = useMemo(
    () => [
      { x: -140, y: -80, size: 520, color: '#FFF7ED' },  // soft orange white
      { x: 140, y: 60, size: 460, color: '#FFEDD5' },   // warm peach
      { x: 20, y: 180, size: 620, color: '#FED7AA' },   // light orange
    ],
    []
  )

  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setReduceMotion(mq.matches)
    handler()
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  return (
    <div className="absolute inset-0 -z-10">
      {blobs.map((b, i) => (
        reduceMotion ? (
          <div
            key={i}
            className="absolute -z-20 blur-3xl"
            style={{
              opacity: 0.6,
              width: b.size,
              height: b.size,
              left: `calc(50% - ${b.size / 2}px)`,
              top: `calc(50% - ${b.size / 2}px)`,
              borderRadius: b.size,
              background: `radial-gradient(closest-side, ${b.color} 0%, rgba(255,255,255,0) 70%)`,
              filter: 'blur(60px)'
            }}
          />
        ) : (
          <motion.div
            key={i}
            initial={{ x: b.x, y: b.y, opacity: 0.5 }}
            animate={{
              x: [b.x, b.x + (i % 2 === 0 ? 30 : -20), b.x],
              y: [b.y, b.y + (i % 2 === 0 ? -20 : 30), b.y],
              transition: { duration: 20 + i * 3, repeat: Infinity, ease: 'easeInOut' }
            }}
            className="absolute -z-20 blur-3xl"
            style={{
              width: b.size,
              height: b.size,
              left: `calc(50% - ${b.size / 2}px)`,
              top: `calc(50% - ${b.size / 2}px)`,
              borderRadius: b.size,
              background: `radial-gradient(closest-side, ${b.color} 0%, rgba(255,255,255,0) 70%)`,
              filter: 'blur(60px)'
            }}
          />
        )
      ))}
    </div>
  )
}
