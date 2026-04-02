import { NextResponse } from 'next/server';
import { db, doc, getDoc as getDocClient } from '../../../../firebase';
import { Scrap } from '../../../../types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    let docData: Scrap | null = null;
    if (id !== 'default') {
      // Use Client SDK directly (works if rules allow public read)
      // This is more reliable in AI Studio where Admin SDK permissions may be restricted
      const scrapDoc = await getDocClient(doc(db, 'scraps', id));
      if (scrapDoc.exists()) {
        docData = scrapDoc.data() as Scrap;
      }
    }

    const title = docData?.title || "じょはり";
    const authorName = docData?.authorName || "思考の窓";
    
    // Handle title wrapping (13 chars per line)
    const maxCharsPerLine = 13;
    const lines: string[] = [];
    let currentLine = "";
    
    const words = title.split(""); 
    for (const char of words) {
      if (currentLine.length < maxCharsPerLine) {
        currentLine += char;
      } else {
        lines.push(currentLine);
        currentLine = char;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    // Limit to 2 lines
    const displayLines = lines.slice(0, 2);
    if (lines.length > 2) {
      displayLines[1] = displayLines[1].substring(0, maxCharsPerLine - 3) + "...";
    }

    // Generate SVG
    const svg = `
      <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f8fafc;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <rect width="1200" height="630" fill="url(#grad)" />
        
        <!-- Decorative Background Elements -->
        <circle cx="1100" cy="100" r="200" fill="#dbeafe" opacity="0.3" />
        <circle cx="100" cy="530" r="150" fill="#bfdbfe" opacity="0.2" />
        
        <!-- Title (Centered with wrapping) -->
        <text 
          x="600" 
          y="${315 - (displayLines.length - 1) * 45}" 
          font-family="sans-serif" 
          font-size="84" 
          font-weight="900" 
          fill="#0f172a" 
          text-anchor="middle"
        >
          ${displayLines.map((line, i) => `<tspan x="600" dy="${i === 0 ? 0 : 110}">${line}</tspan>`).join('')}
        </text>
        
        <!-- Bottom Center: Author Name -->
        <text 
          x="600" 
          y="550" 
          font-family="sans-serif" 
          font-size="32" 
          font-weight="bold" 
          fill="#64748b" 
          text-anchor="middle"
        >
          by ${authorName}
        </text>
        
        <!-- Border Accent -->
        <rect x="30" y="30" width="1140" height="570" rx="30" fill="none" stroke="#e2e8f0" stroke-width="4" />
      </svg>
    `.trim();

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return new NextResponse('Failed to generate thumbnail', { status: 500 });
  }
}
