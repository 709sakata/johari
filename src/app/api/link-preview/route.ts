import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import https from 'https';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    new URL(targetUrl);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Pre-extraction for Google Maps
  let fallbackTitle = targetUrl;
  let isGoogleMaps = false;
  try {
    const urlObj = new URL(targetUrl);
    if (urlObj.hostname.includes("google") && urlObj.pathname.includes("maps")) {
      isGoogleMaps = true;
      const q = urlObj.searchParams.get("q");
      if (q) {
        try {
          fallbackTitle = decodeURIComponent(q.replace(/\+/g, ' '));
          if (fallbackTitle.length > 100) {
            fallbackTitle = fallbackTitle.substring(0, 97) + "...";
          }
        } catch (e) {
          fallbackTitle = q.substring(0, 100);
        }
      }
    }
  } catch (e) {}

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ 
        url: targetUrl, 
        title: fallbackTitle,
        siteName: isGoogleMaps ? "Google Maps" : undefined
      });
    }

    const contentType = response.headers.get("content-type") || "";
    
    if (!contentType.includes("text/html")) {
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "";
      if (contentDisposition && contentDisposition.includes("filename=")) {
        filename = contentDisposition.split("filename=")[1].replace(/["']/g, "");
      } else {
        filename = path.basename(new URL(targetUrl).pathname);
      }
      return NextResponse.json({ 
        url: targetUrl, 
        title: filename || targetUrl,
        description: `File type: ${contentType}`
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let title = 
      $('meta[property="og:title"]').attr("content") || 
      $('meta[name="twitter:title"]').attr("content") || 
      $("title").text();

    if (!title || title === "Google Maps" || title === "Google マップ" || title.trim() === "") {
      try {
        const urlObj = new URL(targetUrl);
        if (urlObj.hostname.includes("google") && urlObj.pathname.includes("maps")) {
          const q = urlObj.searchParams.get("q");
          if (q) title = q;
        }
      } catch (e) {}
    }

    if (title && (title.includes("Google Maps") || title.includes("Google マップ"))) {
      title = title.replace(" - Google Maps", "").replace(" - Google マップ", "").trim();
    }

    const description = 
      $('meta[property="og:description"]').attr("content") || 
      $('meta[name="twitter:description"]').attr("content") || 
      $('meta[name="description"]').attr("content");

    const image = 
      $('meta[property="og:image"]').attr("content") || 
      $('meta[name="twitter:image"]').attr("content");

    const siteName = $('meta[property="og:site_name"]').attr("content");

    return NextResponse.json({
      title: title?.trim() || targetUrl,
      description: description?.trim(),
      image: image,
      url: targetUrl,
      siteName: siteName
    });
  } catch (error: any) {
    clearTimeout(timeout);
    
    // Fallback to https.get
    try {
      const fetchWithHttps = async (url: string, depth = 0): Promise<string> => {
        if (depth > 5) throw new Error("Too many redirects");
        
        return new Promise<string>((resolve, reject) => {
          const urlObj = new URL(url);
          const req = https.get({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            port: urlObj.port || 443,
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            },
            timeout: 8000,
            rejectUnauthorized: false,
          }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              let redirectUrl = res.headers.location;
              if (!redirectUrl.startsWith('http')) {
                redirectUrl = new URL(redirectUrl, url).toString();
              }
              resolve(fetchWithHttps(redirectUrl, depth + 1));
              return;
            }

            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }
            
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => resolve(data));
          });
          
          req.on("error", reject);
          req.on("timeout", () => {
            req.destroy();
            reject(new Error("Timeout"));
          });
        });
      };

      const html = await fetchWithHttps(targetUrl);
      const $ = cheerio.load(html);
      let title = 
        $('meta[property="og:title"]').attr("content") || 
        $('meta[name="twitter:title"]').attr("content") || 
        $("title").text();

      if (!title || title === "Google Maps" || title === "Google マップ" || title.trim() === "") {
        try {
          const urlObj = new URL(targetUrl);
          if (urlObj.hostname.includes("google") && urlObj.pathname.includes("maps")) {
            const q = urlObj.searchParams.get("q");
            if (q) title = q;
          }
        } catch (e) {}
      }

      const description = 
        $('meta[property="og:description"]').attr("content") || 
        $('meta[name="twitter:description"]').attr("content") || 
        $('meta[name="description"]').attr("content");

      const image = 
        $('meta[property="og:image"]').attr("content") || 
        $('meta[name="twitter:image"]').attr("content");

      const siteName = $('meta[property="og:site_name"]').attr("content");

      return NextResponse.json({
        title: title?.trim() || targetUrl,
        description: description?.trim(),
        image: image,
        url: targetUrl,
        siteName: siteName
      });
    } catch (fallbackError: any) {
      console.warn(`Link preview failed for ${targetUrl}: ${error.message} (Fallback: ${fallbackError.message})`);
      
      return NextResponse.json({ 
        url: targetUrl, 
        title: fallbackTitle,
        siteName: isGoogleMaps ? "Google Maps" : undefined
      });
    }
  }
}
