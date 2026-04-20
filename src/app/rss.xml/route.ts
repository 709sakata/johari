import { NextResponse } from 'next/server';
import { Feed } from 'feed';
import { db, collection, query as queryClient, orderBy as orderByClient, limit as limitClient, getDocs as getDocsClient } from '../../firebase';
import { Scrap } from '../../types';

import { getServerBaseUrl } from '@/lib/server-utils';

export async function GET(request: Request) {
  try {
    const baseUrl = await getServerBaseUrl();

    let docs: any[] = [];
    
    // Use Client SDK directly (works if rules allow public read)
    // This is more reliable in AI Studio where Admin SDK permissions may be restricted
    const q = queryClient(
      collection(db, 'scraps'),
      orderByClient('updatedAt', 'desc'),
      limitClient(20)
    );
    const snapshot = await getDocsClient(q);
    docs = snapshot.docs;

    const feed = new Feed({
      title: "じょはり",
      description: "まだ知らない自分に出会う思考の窓 - 思考を整理し、新しい視点を発見する場所",
      id: baseUrl,
      link: baseUrl,
      language: "ja",
      favicon: `${baseUrl}/favicon.ico`,
      copyright: `All rights reserved ${new Date().getFullYear()}`,
      updated: new Date(),
      generator: "じょはり RSS Generator",
      feedLinks: {
        rss: `${baseUrl}/rss.xml`
      },
      author: {
        name: "じょはり Community",
        email: "noreply@johari.cloud"
      }
    });

    for (const doc of docs) {
      const data = doc.data() as Scrap;
      const updatedAt = data.updatedAt ? data.updatedAt.toDate() : (data.createdAt ? data.createdAt.toDate() : new Date());
      const thumbnailUrl = `${baseUrl}/api/og-image/${doc.id}`;
      
      // Fetch comments to build a description
      let threadContent = "";
      try {
        let commentDocs: any[] = [];
        // Use Client SDK directly (works if rules allow public read)
        // This is more reliable in AI Studio where Admin SDK permissions may be restricted
        const q = queryClient(
          collection(db, `scraps/${doc.id}/comments`),
          orderByClient('createdAt', 'asc'),
          limitClient(10)
        );
        const snapshot = await getDocsClient(q);
        commentDocs = snapshot.docs;
        
        for (const commentDoc of commentDocs) {
          const rawContent = commentDoc.data().content || "";
          const cleanContent = rawContent
            .replace(/```[\s\S]*?```/g, "")
            .replace(/`[^`]*`/g, "")
            .replace(/!\[.*?\]\(.*?\)/g, "")
            .replace(/\[(.*?)\]\(.*?\)/g, "$1")
            .replace(/<[^>]*>/g, "")
            .replace(/^[#\s*+-]+ /gm, "")
            .replace(/[#*_\-~\[\]\(\)>]/g, "")
            .replace(/\s+/g, " ")
            .trim();
          
          if (cleanContent) {
            if (threadContent) threadContent += " ";
            threadContent += cleanContent;
          }
          
          if (threadContent.length >= 100) break;
        }
      } catch (err) {
        console.warn(`Failed to fetch comments for scrap ${doc.id}:`, err);
      }

      const description = threadContent.length > 300 
        ? threadContent.substring(0, 300) + "..." 
        : threadContent || `新しいスレッド「${data.title}」が作成されました。`;
      
      feed.addItem({
        title: data.title,
        id: doc.id,
        link: `${baseUrl}/scraps/${doc.id}`,
        description: description,
        author: [
          {
            name: data.authorName,
            email: "noreply@johari.cloud"
          }
        ],
        date: updatedAt,
        image: {
          url: thumbnailUrl,
          type: "image/svg+xml"
        }
      });
    }

    return new NextResponse(feed.rss2(), {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=1200, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('RSS generation error:', error);
    return new NextResponse('Failed to generate RSS feed', { status: 500 });
  }
}
