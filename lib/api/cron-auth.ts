export function requireCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // In development, allow requests when CRON_SECRET is not configured
    return process.env.NODE_ENV !== 'production'
  }
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}
