import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a Unix timestamp to a Date object.
 * @param secs The Unix timestamp in seconds.
 * @returns A Date object.
 */
export const toDateTime = (secs: number) => {
  const t = new Date('1970-01-01T00:00:00Z') // Unix epoch start.
  t.setSeconds(secs)
  return t
}

export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel
    'http://localhost:3000/'
  // Make sure to include `https` in production URLs.
  url = url.includes('http') ? url : `https://${url}`
  // Make sure to include a trailing `/`.
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`
  return url
}