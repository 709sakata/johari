import { headers } from 'next/headers';

/**
 * Returns the base URL of the application on the server side.
 */
export async function getServerBaseUrl() {
  // Priority 1: Environment variable (Explicitly set by user/developer)
  // This is the most reliable for SEO as it's stable.
  const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL;
  if (envBaseUrl && envBaseUrl.includes('johari.cloud')) {
    return envBaseUrl.startsWith('http') ? envBaseUrl : `https://${envBaseUrl}`;
  }

  let host: string | null = null;
  let protocol = 'https';

  try {
    const headersList = await headers();
    host = headersList.get('host');
    protocol = headersList.get('x-forwarded-proto') || 'https';
  } catch (e) {
    // headers() might throw during build or static generation
    console.warn('Failed to get headers in getServerBaseUrl:', e);
  }
  
  // Priority 2: Use detected host if available
  if (host) {
    return `${protocol}://${host}`;
  }
  
  // Priority 3: Vercel specific env var
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  
  // Fallback
  return envBaseUrl ? (envBaseUrl.startsWith('http') ? envBaseUrl : `https://${envBaseUrl}`) : 'https://johari.cloud';
}
