import { headers } from 'next/headers';

/**
 * Returns the base URL of the application on the server side.
 */
export async function getServerBaseUrl() {
  let host: string | null = null;
  let protocol = 'https';

  try {
    const headersList = await headers();
    host = headersList.get('host');
    protocol = headersList.get('x-forwarded-proto') || 'https';
  } catch (e) {
    // headers() might throw during build or static generation in some Next.js versions
    console.warn('Failed to get headers in getServerBaseUrl:', e);
  }
  
  if (host) {
    return `${protocol}://${host}`;
  }
  
  // Vercel specific env var
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  
  // Fallbacks
  const fallback = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || 'https://johari.cloud';
  
  // Ensure protocol
  if (fallback && !fallback.startsWith('http')) {
    return `https://${fallback}`;
  }

  return fallback;
}
