import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { validateRuleConditions, recomputeMatchesForRule } from '@/lib/filter-engine';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, enabled, conditions, feed_ids } = body;

  const rule = db.prepare('SELECT id FROM filter_rules WHERE id = ?').get(id);
  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  // Validate regex if conditions are provided
  if (conditions && Array.isArray(conditions)) {
    const validationError = validateRuleConditions(conditions);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

  const tx = db.transaction(() => {
    if (name !== undefined) {
      db.prepare('UPDATE filter_rules SET name = ? WHERE id = ?').run(name, id);
    }
    if (enabled !== undefined) {
      db.prepare('UPDATE filter_rules SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
    }
    if (Array.isArray(conditions)) {
      db.prepare('DELETE FROM filter_conditions WHERE rule_id = ?').run(id);
      const condStmt = db.prepare(
        'INSERT INTO filter_conditions (rule_id, field, operator, value, logical_op) VALUES (?, ?, ?, ?, ?)',
      );
      for (const cond of conditions) {
        condStmt.run(id, cond.field, cond.operator, cond.value, cond.logical_op || 'AND');
      }
    }
    if (Array.isArray(feed_ids)) {
      db.prepare('DELETE FROM filter_feed_rules WHERE rule_id = ?').run(id);
      const feedStmt = db.prepare('INSERT INTO filter_feed_rules (rule_id, feed_id) VALUES (?, ?)');
      for (const fid of feed_ids) {
        feedStmt.run(id, fid);
      }
    }
  });

  try {
    tx();
    // Recompute matches if rule definition changed
    if (conditions || feed_ids) {
      recomputeMatchesForRule(Number(id));
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = db.prepare('SELECT id FROM filter_rules WHERE id = ?').get(id);
  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }
  db.prepare('DELETE FROM filter_rules WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
