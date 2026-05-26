import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feed = db.prepare('SELECT id FROM feeds WHERE id = ?').get(id);
  if (!feed) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
  }
  db.prepare('DELETE FROM feeds WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
