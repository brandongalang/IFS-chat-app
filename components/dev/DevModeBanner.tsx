import { cookies } from 'next/headers'
import { developmentConfig } from '@/mastra/config/development'

export default async function DevModeBanner() {
  if (!developmentConfig.enabled) return null
  
  const cookieStore = await cookies()
  const devUserId = cookieStore.get('ifs_dev_user_id')?.value || developmentConfig.defaultUserId || 'unknown'
  
  return (
    <div
      style={{
        background: '#fff3cd',
        color: '#664d03',
        padding: '8px 12px',
        borderBottom: '1px solid #ffe69c',
        fontSize: 13,
        fontWeight: 600,
      }}
      role="status"
      aria-live="polite"
    >
      DEV MODE ENABLED — Mock user: {devUserId}
    </div>
  )
}
