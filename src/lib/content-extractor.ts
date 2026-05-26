import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

interface ExtractedContent {
  content: string;
  snippet: string;
  author: string;
}

export async function extractArticleContent(url: string): Promise<ExtractedContent | null> {
  try {
    if (!url.startsWith('http')) return null;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS-Reader/1.0)' },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.content) return null;
    if (article.content.length < 50) return null;

    return {
      content: article.content.trim(),
      snippet: (article.textContent || '').substring(0, 300).trim(),
      author: article.byline || '',
    };
  } catch {
    return null;
  }
}
