export function requireCronAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  
  // In development, allow requests when CRON_SECRET is not configured
  if (!cronSecret) {
    return process.env.NODE_ENV !== 'production'
  }
  
  // Check for Vercel Cron authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) {
    return true
  }
  
  // For Vercel Cron, also check the cron-specific header
  const cronHeader = req.headers.get('x-vercel-cron-secret')
  if (cronHeader === cronSecret) {
    return true
  }
  
  return false
}
