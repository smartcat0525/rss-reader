import Parser from 'rss-parser';
import { v4 as uuidv4 } from 'uuid';
import db from './db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const parser = new Parser({
  timeout: 30000,
  maxRedirects: 5,
});

const MAX_BATCHES = 5;

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
