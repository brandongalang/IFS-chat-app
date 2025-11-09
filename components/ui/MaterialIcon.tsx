/**
 * MaterialIcon - Wrapper component for Material Symbols icons
 * 
 * Provides type safety and consistent styling for Material Symbols icons.
 * Usage:
 *   <MaterialIcon name="home" />
 *   <MaterialIcon name="psychology" filled />
 *   <MaterialIcon name="edit_note" className="text-2xl" />
 */

import { cn } from '@/lib/utils'

export interface MaterialIconProps {
  /**
   * Material Symbols icon name (e.g., "home", "psychology", "edit_note")
   */
  name: string
  /**
   * Whether to use filled variant (FILL=1)
   */
  filled?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Icon size in pixels (default: 24)
   */
  size?: number
}

export function MaterialIcon({
  name,
  filled = false,
  className,
  size = 24,
}: MaterialIconProps) {
  return (
    <span
      className={cn('material-symbols-outlined', className)}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  )
}

