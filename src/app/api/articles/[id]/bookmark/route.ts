import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = db.prepare('SELECT id, bookmarked FROM articles WHERE id = ?').get(id) as { id: number; bookmarked: number };
  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  const newBookmark = article.bookmarked ? 0 : 1;
  db.prepare(`
    UPDATE articles SET bookmarked = ?, bookmarked_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = ?
  `).run(newBookmark, newBookmark, id);

  return NextResponse.json({ bookmarked: newBookmark === 1 });
}
