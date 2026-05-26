import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { fetchFeed } from '@/lib/cron-worker';
import { startCronWorker } from '@/lib/cron-init';

// Lazy-start cron worker on first request (avoid Edge runtime issues)
let cronStarted = false;
function ensureCronWorker() {
  if (cronStarted) return;
  cronStarted = true;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    startCronWorker();
  }
}

export async function GET() {
  ensureCronWorker();
  const feeds = db.prepare(`
    SELECT f.*, COUNT(CASE WHEN a.bookmarked = 0 THEN 1 END) as article_count
    FROM feeds f
    LEFT JOIN articles a ON f.id = a.feed_id
    GROUP BY f.id
    ORDER BY f.created_at DESC
  `).all();
  return NextResponse.json(feeds);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const result = db.prepare('INSERT INTO feeds (url) VALUES (?)').run(url);

    // Trigger initial fetch
    const fetchResult = await fetchFeed(result.lastInsertRowid as number, url);

    const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
    return NextResponse.json({ ...feed, fetchResult }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Feed already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
