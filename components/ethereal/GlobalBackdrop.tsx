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
    <div className="pointer-events-none fixed inset-0 -z-30 overflow-hidden" style={{ opacity: 'var(--eth-enabled, 1)' }}>
      <BackgroundImageLayer />
      {variantGradientKey ? <VariantGradientLayer variantKey={variantGradientKey} /> : null}
      <GradientBackdrop />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.10)_0%,rgba(0,0,0,0.22)_55%,rgba(0,0,0,0.38)_100%)]" />
    </div>
  )
}

function BackgroundImageLayer() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        id="ethereal-bg-img"
        src="/ethereal-bg.jpg"
        alt="background"
        className="absolute inset-0 h-full w-full object-cover z-0 blur-xl scale-105 opacity-90"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        loading="eager"
        draggable={false}
      />
    </>
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
  const blobs = useMemo(
    () => [
      { x: -140, y: -80, size: 520, color: '#1f3a3f' },
      { x: 140, y: 60, size: 460, color: '#2a4d52' },
      { x: 20, y: 180, size: 620, color: '#d39a78' },
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
              opacity: 0.5,
              width: b.size,
              height: b.size,
              left: `calc(50% - ${b.size / 2}px)`,
              top: `calc(50% - ${b.size / 2}px)`,
              borderRadius: b.size,
              background: `radial-gradient(closest-side, ${b.color} 0%, rgba(0,0,0,0) 70%)`,
              filter: 'blur(60px)'
            }}
          />
        ) : (
          <motion.div
            key={i}
            initial={{ x: b.x, y: b.y, opacity: 0.4 }}
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
              background: `radial-gradient(closest-side, ${b.color} 0%, rgba(0,0,0,0) 70%)`,
              filter: 'blur(60px)'
            }}
          />
        )
      ))}
    </div>
  )
}
