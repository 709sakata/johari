/**
 * Utility for Scrapbox-like features
 */

/**
 * Parses text and replaces [Title] with [Title](scrap:Title)
 * @param text The markdown text to parse
 * @returns The parsed text
 */
export function parseScrapboxLinks(text: string): string {
  if (!text) return '';
  
  // Replace [Title] with [Title](scrap:Title)
  // Avoid replacing if it's already a markdown link [Text](URL)
  // We use a negative lookahead to ensure it's not followed by (
  // and a negative lookbehind to ensure it's not preceded by ! (for images) or ] (for nested)
  // Actually, a simpler regex might be better for now:
  // Find [ something ] where something doesn't contain [ or ]
  return text.replace(/(?<!\!)\[([^\[\]]+)\](?!\()/g, (match, title) => {
    // If it's a URL, don't touch it (though usually URLs are just pasted)
    if (title.startsWith('http://') || title.startsWith('https://')) {
      return match;
    }
    return `[${title}](scrap:${encodeURIComponent(title)})`;
  });
}

/**
 * Extracts all linked titles from text
 * @param text The markdown text
 * @returns Array of titles
 */
export function extractLinkedTitles(text: string): string[] {
  if (!text) return [];
  const matches = text.matchAll(/(?<!\!)\[([^\[\]]+)\](?!\()/g);
  const titles = [];
  for (const match of matches) {
    const title = match[1];
    if (!title.startsWith('http://') || !title.startsWith('https://')) {
      titles.push(title);
    }
  }
  return [...new Set(titles)];
}
