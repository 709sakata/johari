import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as cheerio from "cheerio";
import https from "https";
import Parser from "rss-parser";
import { Feed } from "feed";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const parser = new Parser();

// Load Firebase config for server-side use
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseApp: any = null;
let db: any = null;

let config: any = null;
if (fs.existsSync(firebaseConfigPath)) {
  try {
    config = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
  } catch (error) {
    console.error("Failed to read firebase-applet-config.json:", error);
  }
} else if (process.env.FIREBASE_CONFIG) {
  try {
    config = JSON.parse(process.env.FIREBASE_CONFIG);
  } catch (error) {
    console.error("Failed to parse FIREBASE_CONFIG env var:", error);
  }
}

if (config) {
  try {
    const { getApps, getApp, initializeApp: initApp } = await import("firebase/app");
    const { getFirestore: getFS } = await import("firebase/firestore");
    
    if (getApps().length === 0) {
      firebaseApp = initApp(config, "rss-feed-app");
    } else {
      try {
        firebaseApp = getApp("rss-feed-app");
      } catch {
        firebaseApp = initApp(config, "rss-feed-app");
      }
    }
    db = getFS(firebaseApp, config.firestoreDatabaseId);
  } catch (error) {
    console.error("Failed to initialize Firebase Client for RSS:", error);
  }
}

async function injectSEO(html: string, req: express.Request): Promise<string> {
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const baseUrl = `https://${host}`;
  const url = `${baseUrl}${req.url}`;

  let title = "じょはり | まだ知らない自分に出会う思考の窓";
  let description = "じょはり は、あなたの思考を整理し、他者との対話を通じて「未知の自分」を発見するための場所です。";
  let ogImage = `${baseUrl}/api/og-image/default`;
  let jsonLd: any = null;

  const scrapMatch = req.url.match(/^\/scraps\/([a-zA-Z0-9_-]+)/);
  const userMatch = req.url.match(/^\/users\/([a-zA-Z0-9_-]+)/);

  if (scrapMatch && db) {
    const scrapId = scrapMatch[1];
    try {
      const scrapDoc = await getDoc(doc(db, "scraps", scrapId));
      if (scrapDoc.exists()) {
        const data = scrapDoc.data();
        title = `${data.title} | じょはり`;
        
        // Fetch comments to build a description
        let threadContent = "";
        const commentsQ = query(
          collection(db, `scraps/${scrapId}/comments`),
          orderBy("createdAt", "asc"),
          limit(5)
        );
        const commentsSnapshot = await getDocs(commentsQ);
        for (const commentDoc of commentsSnapshot.docs) {
          const rawContent = commentDoc.data().content || "";
          const cleanContent = rawContent.replace(/[#*_\-~\[\]\(\)>]/g, "").replace(/\s+/g, " ").trim();
          if (cleanContent) {
            if (threadContent) threadContent += " ";
            threadContent += cleanContent;
          }
          if (threadContent.length >= 150) break;
        }
        
        description = threadContent.length > 200 
          ? threadContent.substring(0, 200) + "..." 
          : threadContent || `新しいスレッド「${data.title}」が作成されました。`;
        
        ogImage = `${baseUrl}/api/og-image/${scrapId}`;
        
        jsonLd = {
          "@context": "https://schema.org",
          "@type": "DiscussionForumPosting",
          "headline": data.title,
          "author": {
            "@type": "Person",
            "name": data.authorName
          },
          "datePublished": data.createdAt?.toDate()?.toISOString(),
          "dateModified": data.updatedAt?.toDate()?.toISOString(),
          "image": ogImage,
          "description": description
        };
      }
    } catch (err) {
      console.error("SEO injection error for scrap:", err);
    }
  } else if (userMatch && db) {
    const userId = userMatch[1];
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        title = `${data.displayName || "ユーザー"} のプロフィール | じょはり`;
        description = data.bio || `${data.displayName || "ユーザー"} さんの思考の窓。じょはり で思考を整理し、対話を楽しんでいます。`;
        
        jsonLd = {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          "mainEntity": {
            "@type": "Person",
            "name": data.displayName,
            "description": data.bio,
            "image": data.photoURL
          }
        };
      }
    } catch (err) {
      console.error("SEO injection error for user:", err);
    }
  }

  let finalHtml = html;
  finalHtml = finalHtml.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
  finalHtml = finalHtml.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`);
  
  // Replace placeholders
  finalHtml = finalHtml.replace("<!-- __SEO_TITLE__ -->", `<meta name="title" content="${title}" />`);
  finalHtml = finalHtml.replace("<!-- __SEO_DESCRIPTION__ -->", `<meta name="description" content="${description}" />`);
  finalHtml = finalHtml.replace("<!-- __SEO_OG_TITLE__ -->", `<meta property="og:title" content="${title}" />`);
  finalHtml = finalHtml.replace("<!-- __SEO_OG_DESCRIPTION__ -->", `<meta property="og:description" content="${description}" />`);
  finalHtml = finalHtml.replace("<!-- __SEO_OG_IMAGE__ -->", `<meta property="og:image" content="${ogImage}" />`);
  finalHtml = finalHtml.replace("<!-- __SEO_OG_URL__ -->", `<meta property="og:url" content="${url}" />`);
  finalHtml = finalHtml.replace("<!-- __SEO_TWITTER_TITLE__ -->", `<meta name="twitter:title" content="${title}" />`);
  finalHtml = finalHtml.replace("<!-- __SEO_TWITTER_DESCRIPTION__ -->", `<meta name="twitter:description" content="${description}" />`);
  finalHtml = finalHtml.replace("<!-- __SEO_TWITTER_IMAGE__ -->", `<meta name="twitter:image" content="${ogImage}" />`);
  
  if (jsonLd) {
    finalHtml = finalHtml.replace("<!-- __SEO_JSON_LD__ -->", `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);
  }

  return finalHtml;
}

// Enable CORS for all routes (needed for external RSS readers like STUDIO)
app.use(cors());

// API routes
app.get("/rss.xml", async (req, res) => {
  if (!db) {
    return res.status(500).send("Firebase not configured");
  }

  try {
    // Force https for the RSS feed as requested by the user for better compatibility with STUDIO
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const baseUrl = `https://${host}`;

    const q = query(
      collection(db, "scraps"),
      orderBy("updatedAt", "desc"),
      limit(20)
    );
    const snapshot = await getDocs(q);

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
        email: "noreply@johari.app"
      }
    });

    // Use for...of to handle async fetching of comments
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const updatedAt = data.updatedAt ? data.updatedAt.toDate() : (data.createdAt ? data.createdAt.toDate() : new Date());
      const thumbnailUrl = `${baseUrl}/api/og-image/${docSnap.id}`;
      
      // Fetch comments to build a description of at least 100 characters
      let threadContent = "";
      try {
        const commentsQ = query(
          collection(db, `scraps/${docSnap.id}/comments`),
          orderBy("createdAt", "asc"),
          limit(10) // Fetch up to 10 comments to build the description
        );
        const commentsSnapshot = await getDocs(commentsQ);
        
        for (const commentDoc of commentsSnapshot.docs) {
          const rawContent = commentDoc.data().content || "";
          const cleanContent = rawContent
            .replace(/```[\s\S]*?```/g, "") // Remove code blocks
            .replace(/`[^`]*`/g, "")       // Remove inline code
            .replace(/!\[.*?\]\(.*?\)/g, "") // Remove images
            .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Remove links but keep text
            .replace(/<[^>]*>/g, "")       // Remove HTML tags
            .replace(/^[#\s*+-]+ /gm, "")  // Remove headers, list markers at start of lines
            .replace(/[#*_\-~\[\]\(\)>]/g, "") // Remove remaining markdown chars
            .replace(/\s+/g, " ")           // Normalize whitespace
            .trim();
          
          if (cleanContent) {
            if (threadContent) threadContent += " ";
            threadContent += cleanContent;
          }
          
          if (threadContent.length >= 100) break;
        }
      } catch (err) {
        console.warn(`Failed to fetch comments for scrap ${docSnap.id}:`, err);
      }

      const description = threadContent.length > 300 
        ? threadContent.substring(0, 300) + "..." 
        : threadContent || `新しいスレッド「${data.title}」が作成されました。`;
      
      feed.addItem({
        title: data.title,
        id: docSnap.id,
        link: `${baseUrl}/scraps/${docSnap.id}`,
        description: description,
        author: [
          {
            name: data.authorName,
            email: "noreply@johari.app"
          }
        ],
        date: updatedAt,
        image: {
          url: thumbnailUrl,
          type: "image/svg+xml"
        }
      });
    }

    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(feed.rss2());
  } catch (error: any) {
    console.error("RSS generation error:", error);
    res.status(500).send("Failed to generate RSS feed");
  }
});

// Dynamic Thumbnail (OG Image) Generation
app.get("/api/og-image/:id", async (req, res) => {
  if (!db) return res.status(500).send("Firebase not configured");

  try {
    let docData = null;
    if (req.params.id !== 'default') {
      const scrapDoc = await getDoc(doc(db, "scraps", req.params.id));
      if (scrapDoc.exists()) {
        docData = scrapDoc.data();
      }
    }

    const title = docData?.title || "じょはり";
    const authorName = docData?.authorName || "思考の窓";
    
    // Handle title wrapping (13 chars per line as requested)
    const maxCharsPerLine = 13;
    const lines: string[] = [];
    let currentLine = "";
    
    const words = title.split(""); // Split by characters for Japanese support
    for (const char of words) {
      if (currentLine.length < maxCharsPerLine) {
        currentLine += char;
      } else {
        lines.push(currentLine);
        currentLine = char;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    // Limit to 2 lines as requested
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
        
        <!-- Bottom Center: Author Name (Optional, but keeping it clean) -->
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

    res.set("Content-Type", "image/svg+xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(svg);
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    res.status(500).send("Failed to generate thumbnail");
  }
});

// Handle clean URLs for scraps and users by serving the SPA
app.get(["/scraps/:id", "/users/:id"], (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    const indexPath = path.join(process.cwd(), "dist", "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  } else {
    // In dev, let Vite handle it via the SPA fallback
    next();
  }
});

app.get("/api/rss", async (req, res) => {
  const feedUrl = req.query.url as string;
  if (!feedUrl) {
    return res.status(400).json({ error: "Feed URL is required" });
  }

  try {
    const feed = await parser.parseURL(feedUrl);
    res.json(feed);
  } catch (error: any) {
    console.error(`RSS fetch error for ${feedUrl}:`, error.message);
    res.status(500).json({ error: "Failed to fetch RSS feed" });
  }
});

app.get("/api/link-preview", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    new URL(targetUrl);
  } catch (e) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  // Pre-extraction for Google Maps to ensure we have something even if fetch fails
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
  const timeout = setTimeout(() => controller.abort(), 10000); // Increased to 10 seconds

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://www.google.com/",
        "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.json({ 
        url: targetUrl, 
        title: fallbackTitle,
        siteName: isGoogleMaps ? "Google Maps" : undefined
      });
    }

    const contentType = response.headers.get("content-type") || "";
    
    // If it's not HTML, try to get some info from headers or URL
    if (!contentType.includes("text/html")) {
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "";
      if (contentDisposition && contentDisposition.includes("filename=")) {
        filename = contentDisposition.split("filename=")[1].replace(/["']/g, "");
      } else {
        filename = path.basename(new URL(targetUrl).pathname);
      }
      return res.json({ 
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

    // Fallback for Google Maps search URLs if title is generic or missing
    if (!title || title === "Google Maps" || title === "Google マップ" || title.trim() === "") {
      try {
        const urlObj = new URL(targetUrl);
        if (urlObj.hostname.includes("google") && urlObj.pathname.includes("maps")) {
          const q = urlObj.searchParams.get("q");
          if (q) title = q;
        }
      } catch (e) {
        // Ignore URL parsing errors
      }
    }

    // Clean up Google Maps titles
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

    res.json({
      title: title?.trim() || targetUrl,
      description: description?.trim(),
      image: image,
      url: targetUrl,
      siteName: siteName
    });
  } catch (error: any) {
    clearTimeout(timeout);
    
    // Fallback to https.get if fetch fails (sometimes handles SSL/TLS issues better)
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
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
              "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
              "Referer": "https://www.google.com/",
              "Connection": "keep-alive",
            },
            timeout: 8000,
            rejectUnauthorized: false,
            family: 4, 
            minVersion: 'TLSv1.2',
            servername: urlObj.hostname, // Explicit SNI
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
            
            const contentType = res.headers["content-type"] || "";
            if (!contentType.includes("text/html")) {
              // If it's a file, we can't "read" it as text easily here without more logic
              // But we can return a placeholder
              resolve(`<html><title>${path.basename(urlObj.pathname)}</title><body>File: ${contentType}</body></html>`);
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

      // Fallback for Google Maps search URLs if title is generic or missing
      if (!title || title === "Google Maps" || title === "Google マップ" || title.trim() === "") {
        try {
          const urlObj = new URL(targetUrl);
          if (urlObj.hostname.includes("google") && urlObj.pathname.includes("maps")) {
            const q = urlObj.searchParams.get("q");
            if (q) title = q;
          }
        } catch (e) {
          // Ignore URL parsing errors
        }
      }

      // Clean up Google Maps titles
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

      return res.json({
        title: title?.trim() || targetUrl,
        description: description?.trim(),
        image: image,
        url: targetUrl,
        siteName: siteName
      });
    } catch (fallbackError: any) {
      // Silently handle common connection errors for external links
      const isCommonError = 
        error.name === 'AbortError' || 
        fallbackError.message === 'Timeout' || 
        fallbackError.code === 'ECONNRESET' || 
        fallbackError.message.includes('ECONNRESET') ||
        fallbackError.message.includes('ETIMEDOUT');

      if (!isCommonError) {
        console.warn(`Link preview failed for ${targetUrl}: ${error.message} (Fallback: ${fallbackError.message})`);
      }
      
      // Return fallback info instead of just the URL
      res.json({ 
        url: targetUrl, 
        title: fallbackTitle,
        siteName: isGoogleMaps ? "Google Maps" : undefined
      });
    }
  }
});

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // In development, apply SEO injection to index.html
    app.get("*", async (req, res, next) => {
      if (req.url.includes('.') || req.url.startsWith('/api') || req.url.startsWith('/rss.xml')) return next();
      try {
        let html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
        html = await vite.transformIndexHtml(req.url, html);
        html = await injectSEO(html, req);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// In production (including Vercel), register static routes
if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(process.cwd(), "dist");
  // In Vercel, the function might be in /api or root, so we check both
  const fallbackDistPath = path.resolve(__dirname, "dist");
  const apiFallbackDistPath = path.resolve(__dirname, "../dist");
  
  app.use(express.static(distPath, { index: false }));
  app.use(express.static(fallbackDistPath, { index: false }));
  app.use(express.static(apiFallbackDistPath, { index: false }));

  app.get("*", async (req, res, next) => {
    // Skip if it's an API route or has an extension
    if (req.url.startsWith('/api') || req.url.startsWith('/rss.xml') || req.url.includes('.')) {
      return next();
    }
    
    try {
      let indexPath = path.join(distPath, "index.html");
      if (!fs.existsSync(indexPath)) {
        indexPath = path.join(fallbackDistPath, "index.html");
      }
      if (!fs.existsSync(indexPath)) {
        indexPath = path.join(apiFallbackDistPath, "index.html");
      }
      
      if (!fs.existsSync(indexPath)) {
        console.error(`index.html not found at ${distPath}, ${fallbackDistPath}, or ${apiFallbackDistPath}`);
        return res.status(404).send("Application Shell Not Found");
      }
      
      let html = fs.readFileSync(indexPath, "utf-8");
      
      // Inject SEO tags
      try {
        html = await injectSEO(html, req);
      } catch (seoError) {
        console.error("SEO Injection failed:", seoError);
        // Continue with original HTML if SEO fails
      }
      
      res.send(html);
    } catch (err) {
      console.error("Error serving index.html:", err);
      res.status(500).send("Internal Server Error");
    }
  });
}

// Only start the server if not running as a serverless function
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer();
}

export default app;
