import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = db.prepare(`
    SELECT a.*, f.title as feed_title, f.url as feed_url
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE a.id = ?
  `).get(id);

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }
  return NextResponse.json(article);
}
