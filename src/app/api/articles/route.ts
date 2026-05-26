import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { applyFilters } from '@/lib/filter-engine';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const feedId = searchParams.get('feed_id');
  const keyword = searchParams.get('keyword');
  const date_from = searchParams.get('date_from');
  const date_to = searchParams.get('date_to');
  const bookmarked = searchParams.get('bookmarked');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = (page - 1) * limit;

  let query = `
    SELECT a.*, f.title as feed_title, f.url as feed_url
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (feedId) {
    query += ' AND a.feed_id = ?';
    params.push(feedId);
  }
  if (keyword) {
    query += ' AND (a.title LIKE ? OR a.content LIKE ? OR a.snippet LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (date_from) {
    query += ' AND a.published_at >= ?';
    params.push(date_from);
  }
  if (date_to) {
    query += ' AND a.published_at <= ?';
    params.push(date_to);
  }
  if (bookmarked === '1') {
    query += ' AND a.bookmarked = 1';
  }

  query += ' ORDER BY a.published_at DESC, a.fetched_at DESC';
  query += ` LIMIT ${limit} OFFSET ${offset}`;

  const articles = db.prepare(query).all(...params) as Record<string, unknown>[];

  // Apply filter rules
  const filtered = applyFilters(articles, feedId ? Number(feedId) : undefined);

  // Count total (before filter rules)
  let countQuery = 'SELECT COUNT(*) as total FROM articles a WHERE 1=1';
  const countParams: unknown[] = [];
  if (feedId) {
    countQuery += ' AND a.feed_id = ?';
    countParams.push(feedId);
  }
  if (keyword) {
    countQuery += ' AND (a.title LIKE ? OR a.content LIKE ? OR a.snippet LIKE ?)';
    countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (date_from) {
    countQuery += ' AND a.published_at >= ?';
    countParams.push(date_from);
  }
  if (date_to) {
    countQuery += ' AND a.published_at <= ?';
    countParams.push(date_to);
  }
  if (bookmarked === '1') {
    countQuery += ' AND a.bookmarked = 1';
  }
  const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

  return NextResponse.json({ articles: filtered, total, page, limit, has_more: offset + limit < total });
}
