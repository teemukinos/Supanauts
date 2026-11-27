import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { eventMediaBase } from './lib/event-media';

export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && process.env.VERCEL_ENV === 'production') {
    const url = eventMediaBase && URL.canParse(eventMediaBase) ? new URL(eventMediaBase) : null;
    const siteHosts = [
      'supanauts.com',
      'www.supanauts.com',
      'supanauts.vercel.app',
      'supanauts-tkinos.vercel.app',
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
    ];
    if (
      !url ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      /[?#]/.test(url.href) ||
      siteHosts.includes(url.hostname)
    ) {
      throw new Error(
        'Set NEXT_PUBLIC_EVENT_MEDIA_BASE_URL to a separate public HTTPS media origin for production. ' +
        'Git deployments do not include site/public/media.',
      );
    }
  }

  return { devIndicators: false };
}
