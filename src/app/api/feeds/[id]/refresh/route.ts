import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { refreshFeed } from '@/lib/cron-worker';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feed = db.prepare('SELECT id FROM feeds WHERE id = ?').get(id);
  if (!feed) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
  }
  const result = await refreshFeed(Number(id));
  return NextResponse.json(result);
}
