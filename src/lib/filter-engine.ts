import db from './db';

interface Article {
  [key: string]: unknown;
}

interface FilterCondition {
  field: string;
  operator: string;
  value: string;
  logical_op: string;
}

interface FilterRule {
  id: number;
  name: string;
  enabled: number;
  conditions: FilterCondition[];
  feed_ids: number[];
}

function matchCondition(article: Article, condition: FilterCondition, feedTitle: string): boolean {
  const { field, operator, value } = condition;
  let target: string;

  switch (field) {
    case 'title':
      target = String(article.title || '');
      break;
    case 'content':
      target = String(article.content || article.snippet || '');
      break;
    case 'author':
      target = String(article.author || '');
      break;
    case 'source':
      target = feedTitle;
      break;
    case 'date':
      if (!article.published_at && !article.fetched_at) return false;
      const articleDate = new Date(String(article.published_at || article.fetched_at));
      const valueDate = new Date(value);
      switch (operator) {
        case 'date_after':
          return articleDate > valueDate;
        case 'date_before':
          return articleDate < valueDate;
        default:
          return false;
      }
    default:
      return false;
  }

  switch (operator) {
    case 'contains':
      return target.toLowerCase().includes(value.toLowerCase());
    case 'not_contains':
      return !target.toLowerCase().includes(value.toLowerCase());
    case 'regex':
      try {
        return new RegExp(value, 'i').test(target);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function matchRule(article: Article, rule: FilterRule, feedTitle: string): boolean {
  if (rule.conditions.length === 0) return true;

  let result = matchCondition(article, rule.conditions[0], feedTitle);
  for (let i = 1; i < rule.conditions.length; i++) {
    const cond = rule.conditions[i];
    const condResult = matchCondition(article, cond, feedTitle);
    if (cond.logical_op === 'OR') {
      result = result || condResult;
    } else {
      result = result && condResult;
    }
  }
  return result;
}

// Get active rules that apply to a given feed (or global)
export function getActiveRules(feedId?: number): FilterRule[] {
  const rules = db.prepare('SELECT * FROM filter_rules WHERE enabled = 1').all() as Array<{
    id: number;
    name: string;
    enabled: number;
  }>;

  return rules
    .map((rule) => {
      const conditions = db
        .prepare('SELECT field, operator, value, logical_op FROM filter_conditions WHERE rule_id = ?')
        .all(rule.id) as FilterCondition[];

      const feedRules = db
        .prepare('SELECT feed_id FROM filter_feed_rules WHERE rule_id = ?')
        .all(rule.id) as Array<{ feed_id: number }>;

      const feedIds = feedRules.map((fr) => fr.feed_id);

      // If no feed bindings, rule is global. If feed specified and rule has bindings, check match.
      if (feedId && feedIds.length > 0 && !feedIds.includes(feedId)) return null;
      if (feedId && feedIds.length === 0) {
        // Global rule applies
      }
      if (!feedId && feedIds.length > 0) {
        // No specific feed requested, skip feed-bound rules
        return null;
      }

      return { ...rule, conditions, feed_ids: feedIds };
    })
    .filter(Boolean) as FilterRule[];
}

// Apply filter rules to article list
export function applyFilters(articles: Article[], feedId?: number): Article[] {
  const rules = getActiveRules(feedId);
  if (rules.length === 0) return articles;

  const feedTitles: Record<number, string> = {};
  const feeds = db.prepare('SELECT id, title FROM feeds').all() as Array<{ id: number; title: string }>;
  for (const f of feeds) feedTitles[f.id] = f.title;

  return articles.filter((article) => {
    const feedTitle = feeds.find((f) => f.id === (article.feed_id as number))?.title || '';
    for (const rule of rules) {
      if (matchRule(article, rule, feedTitle)) return true;
    }
    return false;
  });
}

// Validate regex in conditions
export function validateRuleConditions(conditions: FilterCondition[]): string | null {
  for (const cond of conditions) {
    if (cond.operator === 'regex') {
      try {
        new RegExp(cond.value);
      } catch {
        return `Invalid regex in condition: ${cond.value}`;
      }
    }
  }
  return null;
}
