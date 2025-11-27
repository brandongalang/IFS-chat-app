import logger from '@/lib/logger';

export function track(event: string, props?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
    logger.info({ event, props }, '[analytics]');
  }
}
