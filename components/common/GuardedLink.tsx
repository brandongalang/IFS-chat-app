"use client"

import * as React from 'react'
import Link, { LinkProps } from 'next/link'
import { featureKeyForPathname, statusForPath, type FeatureKey } from '@/config/features'
import { useComingSoon } from './ComingSoonProvider'

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  LinkProps & {
    featureOverride?: FeatureKey
  }

function hrefToPath(href: LinkProps['href']): string {
  if (typeof href === 'string') return href
  const path = href.pathname ?? '/'

  const params = new URLSearchParams()
  const query = (href as Extract<LinkProps['href'], { query?: unknown }>).query as
    | Record<string, unknown>
    | undefined

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v == null) continue
          params.append(key, String(v))
        }
      } else {
        params.set(key, String(value))
      }
    }
  }

  const search = params.toString() ? `?${params.toString()}` : ''
  return `${path}${search}`
}

export const GuardedLink = React.forwardRef<HTMLAnchorElement, Props>(
  ({ href, onClick, featureOverride, ...rest }, ref) => {
    const { openComingSoon } = useComingSoon()
    const path = hrefToPath(href)
    const targetKey = featureOverride ?? featureKeyForPathname(path)
    const { status } = statusForPath(path)

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Modifier keys should still be allowed but we block navigation and show dialog instead
        if (status !== 'enabled') {
          e.preventDefault()
          openComingSoon(targetKey)
          return
        }
        onClick?.(e)
      },
      [status, targetKey, openComingSoon, onClick]
    )

    return <Link ref={ref} href={href} onClick={handleClick} {...rest} />
  }
)
GuardedLink.displayName = 'GuardedLink'

