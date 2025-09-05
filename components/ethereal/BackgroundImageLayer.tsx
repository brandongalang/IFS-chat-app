"use client"

// Attempts to show /ethereal-bg.jpg; remains silent if not found
export function BackgroundImageLayer() {
  return (
    <img
      src="/ethereal-bg.jpg"
      alt="background"
      className="absolute inset-0 h-full w-full object-cover z-0 blur-xl scale-105 opacity-90"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = "none"
      }}
      loading="eager"
      draggable={false}
    />
  )
}
