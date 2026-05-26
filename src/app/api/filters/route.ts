import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { validateRuleConditions } from '@/lib/filter-engine';

export async function GET() {
  const rules = db.prepare('SELECT * FROM filter_rules ORDER BY created_at DESC').all() as Array<{ id: number; name: string; enabled: number }>;

  const rulesWithConditions = rules.map((rule) => {
    const conditions = db
      .prepare('SELECT * FROM filter_conditions WHERE rule_id = ? ORDER BY id')
      .all(rule.id);
    const feedBindings = db
      .prepare('SELECT feed_id FROM filter_feed_rules WHERE rule_id = ?')
      .all(rule.id);
    return { ...rule, conditions, feed_ids: feedBindings.map((fb) => (fb as { feed_id: number }).feed_id) };
  });

  return NextResponse.json(rulesWithConditions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, conditions, feed_ids } = body;

  if (!name) {
    return NextResponse.json({ error: 'Rule name is required' }, { status: 400 });
  }
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return NextResponse.json({ error: 'At least one condition is required' }, { status: 400 });
  }

  // Validate regex conditions
  const validationError = validateRuleConditions(conditions);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const tx = db.transaction(() => {
    const result = db.prepare('INSERT INTO filter_rules (name) VALUES (?)').run(name);
    const ruleId = result.lastInsertRowid as number;

    const condStmt = db.prepare(
      'INSERT INTO filter_conditions (rule_id, field, operator, value, logical_op) VALUES (?, ?, ?, ?, ?)',
    );
    for (const cond of conditions) {
      condStmt.run(ruleId, cond.field, cond.operator, cond.value, cond.logical_op || 'AND');
    }

    if (Array.isArray(feed_ids) && feed_ids.length > 0) {
      const feedStmt = db.prepare('INSERT INTO filter_feed_rules (rule_id, feed_id) VALUES (?, ?)');
      for (const fid of feed_ids) {
        feedStmt.run(ruleId, fid);
      }
    }
  });

  try {
    tx();
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
