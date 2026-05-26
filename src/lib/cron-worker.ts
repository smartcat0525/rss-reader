import Parser from 'rss-parser';
import { v4 as uuidv4 } from 'uuid';
import db from './db';
import { exec } from 'child_process';
import { promisify } from 'util';
import { extractArticleContent } from './content-extractor';

const execAsync = promisify(exec);

const parser = new Parser({
  timeout: 30000,
  maxRedirects: 5,
});

const MAX_BATCHES = 5;
const MIN_CONTENT_LENGTH = 200;
const MIN_TEXT_LENGTH = 20;
const MAX_CONCURRENT_EXTRACTIONS = 3;

// Aggregator-only feeds — skip content extraction (link points to external sites)
const SKIP_CONTENT_FEEDS = new Set(['news.ycombinator.com']);

// Strip HTML tags to get plain text length
function textLength(html: string): number {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().length;
}

function needsContentExtraction(content: string): boolean {
  if (!content) return true;
  if (content.length < MIN_CONTENT_LENGTH) return true;
  return textLength(content) < MIN_TEXT_LENGTH;
}

function shouldExtractContent(feedUrl: string): boolean {
  try {
    const host = new URL(feedUrl).hostname;
    return !SKIP_CONTENT_FEEDS.has(host);
  } catch {
    return false;
  }
}

interface FeedRow {
  id: number;
  url: string;
  title: string;
}

// Fetch raw feed XML, trying curl as fallback (useful in WSL environments)
async function fetchFeedXml(url: string): Promise<string> {
  // First try native fetch
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.ok) return res.text();
  } catch {
    // fallthrough to curl
  }

  // Fallback to curl
  const { stdout } = await execAsync(`curl -sfL --max-time 30 -m 30 "${url}"`, { timeout: 35000 });
  return stdout;
}

// Fetch a single feed and save articles
export async function fetchFeed(feedId: number, url: string): Promise<{ count: number; error: string | null }> {
  const batchId = uuidv4();
  try {
    // Fetch raw XML and parse
    const rawXml = await fetchFeedXml(url);
    const feed = await parser.parseString(rawXml);

    // Update feed title if empty
    const currentFeed = db.prepare('SELECT title FROM feeds WHERE id = ?').get(feedId) as { title: string };
    if (!currentFeed.title && feed.title) {
      db.prepare('UPDATE feeds SET title = ?, site_url = ?, last_poll = CURRENT_TIMESTAMP WHERE id = ?').run(
        feed.title || '',
        feed.link || '',
        feedId,
      );
    } else {
      db.prepare('UPDATE feeds SET last_poll = CURRENT_TIMESTAMP WHERE id = ?').run(feedId);
    }

    // Save articles (two-step: upsert via INSERT OR IGNORE + UPDATE)
    const entries = feed.items || [];
    if (entries.length > 0) {
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO articles (feed_id, guid, title, link, content, snippet, author, published_at, poll_batch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updateStmt = db.prepare(`
        UPDATE articles SET
          title = ?, content = ?, snippet = ?, author = ?, published_at = ?, poll_batch_id = ?, fetched_at = CURRENT_TIMESTAMP
        WHERE feed_id = ? AND (guid = ? OR (guid IS NULL AND link = ?))
      `);

      const saveMany = db.transaction((items: typeof entries) => {
        for (const item of items) {
          const guid = (item as { guid?: string; id?: string }).guid || (item as { guid?: string; id?: string }).id;
          const link = (item as { link?: string }).link || '';
          const title = (item as { title?: string }).title || '';
          const content =
            (item as { content?: string; contentSnippet?: string }).content ||
            (item as { contentSnippet?: string }).contentSnippet ||
            '';
          const contentSnippet =
            (item as { contentSnippet?: string }).contentSnippet ||
            (item as { title?: string }).title ||
            '';
          const author =
            (item as { creator?: string; author?: string }).creator ||
            (item as { author?: string }).author ||
            '';
          const pubDate = (item as { pubDate?: string }).pubDate || undefined;

          const result = insertStmt.run(feedId, guid, title, link, content, contentSnippet, author, pubDate, batchId);
          if (result.changes === 0) {
            updateStmt.run(title, content, contentSnippet, author, pubDate, batchId, feedId, guid, link);
          }
        }
      });

      saveMany(entries);
    }

    // Extract content from original article URLs when RSS content is minimal
    if (shouldExtractContent(url) && entries.length > 0) {
      const itemsNeedingContent = entries.filter((item) => {
        const c =
          (item as { content?: string }).content ||
          (item as { contentSnippet?: string }).contentSnippet || '';
        return needsContentExtraction(c) && (item as { link?: string }).link;
      });

      for (let i = 0; i < itemsNeedingContent.length; i += MAX_CONCURRENT_EXTRACTIONS) {
        const batch = itemsNeedingContent.slice(i, i + MAX_CONCURRENT_EXTRACTIONS);
        await Promise.all(
          batch.map(async (item) => {
            const link = (item as { link?: string }).link || '';
            const extracted = await extractArticleContent(link);
            if (!extracted) return;

            const guid =
              (item as { guid?: string; id?: string }).guid ||
              (item as { guid?: string; id?: string }).id;
            if (guid) {
              db.prepare(
                'UPDATE articles SET content = ?, snippet = COALESCE(NULLIF(?, \'\'), snippet), author = COALESCE(NULLIF(?, \'\'), author) WHERE feed_id = ? AND guid = ?',
              ).run(extracted.content, extracted.snippet, extracted.author, feedId, guid);
            } else {
              db.prepare(
                'UPDATE articles SET content = ?, snippet = COALESCE(NULLIF(?, \'\'), snippet), author = COALESCE(NULLIF(?, \'\'), author) WHERE feed_id = ? AND link = ?',
              ).run(extracted.content, extracted.snippet, extracted.author, feedId, link);
            }
          }),
        );
      }
    }

    // Cleanup old batches
    cleanupOldBatches(feedId);

    return { count: entries.length, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[cron-worker] Failed to fetch feed ${feedId} (${url}):`, errorMsg);
    return { count: 0, error: errorMsg };
  }
}

// Delete old poll batches, keeping the most recent MAX_BATCHES
function cleanupOldBatches(feedId: number) {
  const batches = db
    .prepare(`
      SELECT poll_batch_id FROM articles
      WHERE feed_id = ? AND bookmarked = 0
      GROUP BY poll_batch_id
      ORDER BY MAX(fetched_at) DESC
    `)
    .all(feedId) as { poll_batch_id: string }[];

  if (batches.length <= MAX_BATCHES) return;

  const toDelete = batches.slice(MAX_BATCHES).map((b) => b.poll_batch_id);
  const deleteStmt = db.prepare('DELETE FROM articles WHERE feed_id = ? AND poll_batch_id = ? AND bookmarked = 0');
  const deleteMany = db.transaction((ids: string[]) => {
    for (const id of ids) deleteStmt.run(feedId, id);
  });
  deleteMany(toDelete);
}

// Fetch all feeds
export async function fetchAllFeeds(): Promise<Array<{ feedId: number; count: number; error: string | null }>> {
  const feeds = db.prepare('SELECT id, url FROM feeds WHERE url IS NOT NULL AND url != ""').all() as FeedRow[];
  const results = await Promise.all(
    feeds.map(async (feed) => {
      const result = await fetchFeed(feed.id, feed.url);
      return { feedId: feed.id, count: result.count, error: result.error };
    }),
  );
  return results;
}

// Manual trigger for a single feed
export async function refreshFeed(feedId: number): Promise<{ count: number; error: string | null }> {
  const feed = db.prepare('SELECT id, url FROM feeds WHERE id = ?').get(feedId) as FeedRow | undefined;
  if (!feed) return { count: 0, error: 'Feed not found' };
  return fetchFeed(feed.id, feed.url);
}

// Fill in missing content for previously fetched articles
export async function fillMissingArticleContent(): Promise<{ filled: number; skipped: number; errors: number }> {
  // Fetch articles with short HTML content (we filter by text length in JS)
  const articles = db
    .prepare(
      `SELECT a.id, a.link, a.feed_id, a.content
       FROM articles a JOIN feeds f ON a.feed_id = f.id
       WHERE a.link IS NOT NULL AND a.link != ''
       ORDER BY a.fetched_at DESC LIMIT 500`,
    )
    .all() as Array<{ id: number; link: string; feed_id: number; content: string | null }>;

  const eligible = articles.filter((a) => {
    const feed = db.prepare('SELECT url FROM feeds WHERE id = ?').get(a.feed_id) as { url: string };
    return shouldExtractContent(feed.url) && needsContentExtraction(a.content || '');
  });

  let filled = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < eligible.length; i += MAX_CONCURRENT_EXTRACTIONS) {
    const batch = eligible.slice(i, i + MAX_CONCURRENT_EXTRACTIONS);
    const results = await Promise.allSettled(
      batch.map(async (article) => {
        const extracted = await extractArticleContent(article.link);
        if (!extracted) {
          skipped++;
          return;
        }
        db.prepare(
          'UPDATE articles SET content = ?, snippet = COALESCE(NULLIF(?, \'\'), snippet), author = COALESCE(NULLIF(?, \'\'), author) WHERE id = ?',
        ).run(extracted.content, extracted.snippet, extracted.author, article.id);
        filled++;
      }),
    );
    for (const r of results) {
      if (r.status === 'rejected') errors++;
    }
  }

  return { filled, skipped, errors };
}
