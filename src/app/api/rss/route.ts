import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedUrl = searchParams.get('url');

  if (!feedUrl) {
    return NextResponse.json({ error: 'Feed URL is required' }, { status: 400 });
  }

  try {
    const feed = await parser.parseURL(feedUrl);
    return NextResponse.json(feed);
  } catch (error: any) {
    console.error(`RSS fetch error for ${feedUrl}:`, error.message);
    return NextResponse.json({ error: 'Failed to fetch RSS feed' }, { status: 500 });
  }
}
