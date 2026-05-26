# RSS Reader - Implementation Plan

## Phase 1: Project Scaffolding & Dependencies

1. `npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-import-alias --use-npm`
2. Install dependencies:
   - `npm install better-sqlite3 rss-parser node-cron uuid`
   - `npm install -D @types/better-sqlite3 @types/uuid`
3. Create `.env.local` for cron interval config (default: `CRON_INTERVAL=30`)

## Phase 2: Database Layer

**File: `src/lib/db.ts`**
- Initialize `better-sqlite3` with a local `.data/rss.db` file
- Run schema migrations on startup (CREATE TABLE IF NOT EXISTS for all 5 tables)
- Export a single `db` instance

**File: `src/lib/schema.sql`**
- All 5 table definitions from the design doc

## Phase 3: Cron Worker & Feed Fetching

**File: `src/lib/cron-worker.ts`**
- `startCronWorker()`: reads all feeds from DB, registers node-cron job
- `fetchFeed(feedId, url)`: uses `rss-parser` to fetch + parse
- `saveArticles(entries, feedId, batchId)`: upsert articles
- `cleanupOldBatches(feedId)`: delete old poll batches, keeping latest 5 (skip bookmarked)
- Manual trigger: exported function for `/api/feeds/:id/refresh`

**File: `src/lib/cron-init.ts`**
- Called from Next.js server startup (`instrumentation.ts` or custom server)
- Registers the cron job

## Phase 4: API Routes

**Files under `src/app/api/`:**

| Route | File | Logic |
|-------|------|-------|
| `/api/feeds` GET | `feeds/route.ts` | SELECT all feeds |
| `/api/feeds` POST | `feeds/route.ts` | INSERT feed, trigger initial fetch |
| `/api/feeds/[id]` DELETE | `feeds/[id]/route.ts` | DELETE feed + cascade |
| `/api/feeds/[id]/refresh` POST | `feeds/[id]/refresh/route.ts` | Manual fetch trigger |
| `/api/articles` GET | `articles/route.ts` | Query with filters, apply rules |
| `/api/articles/[id]` GET | `articles/[id]/route.ts` | Single article detail |
| `/api/articles/[id]/bookmark` POST | `articles/[id]/bookmark/route.ts` | Toggle bookmark |
| `/api/filters` GET | `filters/route.ts` | List all rules |
| `/api/filters` POST | `filters/route.ts` | Create rule + conditions |
| `/api/filters/[id]` PUT | `filters/[id]/route.ts` | Update rule |
| `/api/filters/[id]` DELETE | `filters/[id]/route.ts` | Delete rule |

**Filter Engine: `src/lib/filter-engine.ts`**
- `applyRules(articles, rules)`: iterate conditions, chain with logical_op
- Supports: contains, not_contains, regex, date_after, date_before

## Phase 5: Frontend - Layout & State

**File: `src/app/page.tsx`**
- Three-column layout: left (280px), middle (flex), right (400px)
- Responsive: on small screens, single column with navigation

**File: `src/lib/context.tsx`**
- `AppProvider` with useReducer for: feeds, articles, filters, selectedArticle, selectedFeed
- Actions: `SET_FEEDS`, `SET_ARTICLES`, `SELECT_ARTICLE`, `TOGGLE_BOOKMARK`, etc.

## Phase 6: Frontend - Components

### Left Sidebar
**File: `src/components/FeedList.tsx`**
- List of feeds with unread count
- Add feed button → opens dialog
- Delete feed button (confirm)
- Refresh button per feed

### Middle Panel
**File: `src/components/ArticleList.tsx`**
- Article cards: title, snippet, time, source
- Virtual scrolling if > 50 items (react-virtuoso or simple overflow scroll)

**File: `src/components/FilterBar.tsx`**
- Feed selector dropdown
- Quick keyword search input
- Quick date range selector
- Filter rule dropdown (applies rules server-side)

### Right Panel
**File: `src/components/ArticleDetail.tsx`**
- Title, author, time, source link
- HTML content rendering (dangerouslySetInnerHTML, sanitized)
- Bookmark toggle button
- Empty state when no article selected

**File: `src/components/FilterRuleEditor.tsx`**
- Modal/drawer component
- Rule list with enable/disable toggle
- Condition builder: select field → select operator → input value → select logical_op
- "Add condition" button
- Preview: shows matching article count (calls API endpoint)

## Phase 7: Integration & Polish

1. Auto-refresh article list every 60s (optional)
2. Toast notifications for feed errors
3. Loading states for all async operations
4. Basic sanitization of RSS content before rendering

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── feeds/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── refresh/route.ts
│   │   ├── articles/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── bookmark/route.ts
│   │   └── filters/
│   │       ├── route.ts
│   │       └── [id]/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── FeedList.tsx
│   ├── ArticleList.tsx
│   ├── FilterBar.tsx
│   ├── ArticleDetail.tsx
│   └── FilterRuleEditor.tsx
├── lib/
│   ├── db.ts
│   ├── schema.sql
│   ├── cron-worker.ts
│   ├── cron-init.ts
│   ├── filter-engine.ts
│   └── context.tsx
```

## Order of Execution

1. Phase 1 → Phase 2 (DB ready)
2. Phase 3 (Cron + fetching)
3. Phase 4 (API routes, filter engine)
4. Phase 5 (Layout + state)
5. Phase 6 (Components, bottom-up)
6. Phase 7 (Polish)

Each phase can be verified independently: Phase 2-4 via curl/Postman, Phase 5-6 via browser.
