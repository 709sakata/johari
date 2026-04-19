import { headers } from 'next/headers';

/**
 * Returns the base URL of the application on the server side.
 */
export async function getServerBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  
  if (host) {
    return `${protocol}://${host}`;
  }
  
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  return 'https://johari.cloud';
}
