# RSS Reader

A self-hosted RSS feed reader with content extraction and pre-computed filter rules.

## Features

- **Feed Management** — Add, refresh, and delete RSS/Atom feeds
- **Content Extraction** — When RSS feeds provide minimal summaries (e.g. HN's "Comments" link), automatically fetch the original article and extract readable content using Mozilla Readability
- **Pre-computed Filter Rules** — Define regex/contains rules (e.g. "title matches AI | SaaS | tool") that are evaluated during ingestion, not at query time. The active rule filters articles via SQL.
- **Article Filtering** — Search by keyword, date range, bookmarks, and active filter rules
- **Background Jobs** — Scheduled feed polling and content gap-filling via `node-cron`
- **Local Storage** — SQLite via `better-sqlite3`, no external database required

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | better-sqlite3 |
| Styling | Tailwind CSS v4 |
| Content Extraction | `@mozilla/readability` + `jsdom` |
| RSS Parsing | `rss-parser` |
| HTML Sanitization | `dompurify` |
| Scheduling | `node-cron` |

## Getting Started

### Prerequisites

- Node.js 22+
- npm or pnpm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3000. The cron worker starts automatically on first API request.

### Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
── app/
│   ├── api/
│   │   ├── articles/           # Article listing API (SQL filter by matched_rule_ids)
│   │   │   └── route.ts
│   │   ├── articles/[id]/      # Article detail, bookmark toggle
│   │   ├── feeds/              # Feed CRUD + lazy cron worker init
│   │   │   ├── route.ts
│   │   │   └── [id]/           # Refresh, delete
│   │   └── filters/            # Filter rule CRUD
│   │       ├── route.ts
│   │       └── [id]/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   ── page.tsx
├── components/
│   ├── ArticleDetail.tsx       # Right panel — article body, bookmark
│   ├── ArticleList.tsx         # Article cards with snippets
│   ├── FeedList.tsx            # Left sidebar — feed navigation
│   ├── FilterBar.tsx           # Search, chips, date range
│   └── FilterRuleEditor.tsx    # Modal for creating/editing rules
── lib/
│   ├── content-extractor.ts    # Mozilla Readability extraction utility
│   ├── cron-init.ts            # Cron worker startup (lazy init from API route)
│   ├── cron-worker.ts          # Feed fetching, content extraction, filter matching
│   ├── db.ts                   # SQLite initialization + migrations
│   ├── filter-engine.ts        # Rule matching logic (matchCondition, matchRule, recompute)
│   ├── schema.sql              # Database schema
│   └── context.tsx             # React state + refetchArticles
```

## How Filters Work

### Rule Definition

Each rule has a name and conditions (field + operator + value):

| Field | Operators | Example |
|-------|-----------|---------|
| `title` | `contains`, `not_contains`, `regex` | "AI" |
| `content` | `contains`, `not_contains`, `regex` | "SaaS" |
| `author` | `contains` | "John" |
| `source` | `contains` | "TechCrunch" |
| `date` | `date_after`, `date_before` | "2024-01-01" |

Multiple conditions use `AND`/`OR` logical operators.

### Pre-computed Matching

Rules are evaluated during feed ingestion (`cron-worker.ts`):

1. Feed XML is fetched and articles are saved
2. Article content is extracted if RSS summary is minimal
3. `recomputeMatchesForFeed()` runs `matchRule` on every article against all applicable rules
4. Matching rule IDs are stored as a comma-separated string in `articles.matched_rule_ids`

At query time, the API does a simple SQL filter:

```sql
WHERE (',' || a.matched_rule_ids || ',' LIKE '%,<ruleId>,%')
```

No JavaScript filtering — instant results.

### When Matches Are Recomputed

| Event | Trigger | Scope |
|-------|---------|-------|
| Feed fetch | `fetchFeed()` | All articles in the feed |
| Content fill | `fillMissingArticleContent()` | Single article |
| Rule edit | `PUT /api/filters/:id` | All articles the rule applies to |
| Rule delete | Cascade via foreign key | Automatic cleanup |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3000` | Server port |
| `CRON_INTERVAL` | `30` | Feed polling interval (minutes) |

## Database Schema

```
feeds                  — RSS feed URLs and titles
articles               — Parsed articles with content, snippet, matched_rule_ids
filter_rules           — Named filter rules with enabled flag
filter_conditions      — Conditions within each rule
filter_feed_rules      — Optional feed scoping for rules
```

All tables use `INTEGER PRIMARY KEY AUTOINCREMENT`. Articles are deduplicated by `(feed_id, guid)` or `(feed_id, link)`. Old poll batches are cleaned up automatically, keeping the most recent 5.
