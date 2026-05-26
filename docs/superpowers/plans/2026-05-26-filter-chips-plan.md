# Filter Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display filter rules as selectable chips in FilterBar, enforce single-selection, and enable editing a rule's conditions via the modal.

**Architecture:** Add a chips row to FilterBar. Use context state (`editingRuleId`) to signal FilterRuleEditor to enter edit mode. Replace `TOGGLE_RULE_ENABLED` with `SELECT_RULE` for single-selection semantics.

**Tech Stack:** React (Next.js App Router), TypeScript, Tailwind CSS, better-sqlite3 backend (unchanged).

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/context.tsx` | Add `editingRuleId` state, `SELECT_RULE` + `SET_EDITING_RULE` actions, remove `TOGGLE_RULE_ENABLED`, add filter state to `fetchArticles` deps |
| `src/components/FilterBar.tsx` | Add chips rendering row, wire chip click handlers |
| `src/components/FilterRuleEditor.tsx` | Add edit-mode: load existing rule's conditions into form, save via PUT |
| `src/app/page.tsx` | No changes needed — already renders `FilterRuleEditor` conditionally |

---

### Task 1: Update context with SELECT_RULE and editingRuleId

**Files:**
- Modify: `src/lib/context.tsx`

- [ ] **Step 1: Add new state fields and actions to context**

Add `editingRuleId` to `AppState` (line 43-55), add new action types (line 57-71), update initial state (line 73-86), and add reducer cases (line 88-133).

Replace `TOGGLE_RULE_ENABLED` entirely. The new `SELECT_RULE` enforces single-selection: enabling one rule disables all others.

Here's the full updated `context.tsx`:

```typescript
'use client';

import React, { createContext, useContext, useReducer, ReactNode, useCallback, useEffect } from 'react';

// Types
export interface Feed {
  id: number;
  url: string;
  title: string;
  site_url: string;
  last_poll: string | null;
  created_at: string;
  article_count?: number;
}

export interface Article {
  id: number;
  feed_id: number;
  guid: string | null;
  title: string;
  link: string;
  content: string;
  snippet: string;
  author: string;
  published_at: string | null;
  fetched_at: string;
  poll_batch_id: string | null;
  bookmarked: number;
  bookmarked_at: string | null;
  feed_title?: string;
  feed_url?: string;
}

export interface FilterRule {
  id: number;
  name: string;
  enabled: number;
  conditions: Array<{ field: string; operator: string; value: string; logical_op: string }>;
  feed_ids: number[];
}

interface AppState {
  feeds: Feed[];
  articles: Article[];
  filters: FilterRule[];
  selectedArticle: Article | null;
  selectedFeed: number | null;
  loading: boolean;
  error: string | null;
  showFilterEditor: boolean;
  editingRuleId: number | null;
  keyword: string;
  dateFrom: string;
  dateTo: string;
  showBookmarksOnly: boolean;
}

type AppAction =
  | { type: 'SET_FEEDS'; payload: Feed[] }
  | { type: 'SET_ARTICLES'; payload: Article[] }
  | { type: 'SET_FILTERS'; payload: FilterRule[] }
  | { type: 'SELECT_ARTICLE'; payload: Article | null }
  | { type: 'SELECT_FEED'; payload: number | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'TOGGLE_FILTER_EDITOR' }
  | { type: 'SET_EDITING_RULE'; payload: number | null }
  | { type: 'SELECT_RULE'; payload: number | null }
  | { type: 'SET_KEYWORD'; payload: string }
  | { type: 'SET_DATE_FROM'; payload: string }
  | { type: 'SET_DATE_TO'; payload: string }
  | { type: 'TOGGLE_BOOKMARKS_ONLY' }
  | { type: 'UPDATE_ARTICLE_BOOKMARK'; payload: { id: number; bookmarked: number } };

const initialState: AppState = {
  feeds: [],
  articles: [],
  filters: [],
  selectedArticle: null,
  selectedFeed: null,
  loading: false,
  error: null,
  showFilterEditor: false,
  editingRuleId: null,
  keyword: '',
  dateFrom: '',
  dateTo: '',
  showBookmarksOnly: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_FEEDS':
      return { ...state, feeds: action.payload };
    case 'SET_ARTICLES':
      return { ...state, articles: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: action.payload };
    case 'SELECT_ARTICLE':
      return { ...state, selectedArticle: action.payload };
    case 'SELECT_FEED':
      return { ...state, selectedFeed: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'TOGGLE_FILTER_EDITOR':
      return { ...state, showFilterEditor: !state.showFilterEditor };
    case 'SET_EDITING_RULE':
      return { ...state, editingRuleId: action.payload };
    case 'SELECT_RULE': {
      if (action.payload === null) {
        return { ...state, filters: state.filters.map((f) => ({ ...f, enabled: 0 })) };
      }
      const filters = state.filters.map((f) => ({
        ...f,
        enabled: f.id === action.payload ? 1 : 0,
      }));
      return { ...state, filters };
    }
    case 'SET_KEYWORD':
      return { ...state, keyword: action.payload };
    case 'SET_DATE_FROM':
      return { ...state, dateFrom: action.payload };
    case 'SET_DATE_TO':
      return { ...state, dateTo: action.payload };
    case 'TOGGLE_BOOKMARKS_ONLY':
      return { ...state, showBookmarksOnly: !state.showBookmarksOnly };
    case 'UPDATE_ARTICLE_BOOKMARK': {
      const articles = state.articles.map((a) =>
        a.id === action.payload.id ? { ...a, bookmarked: action.payload.bookmarked } : a,
      );
      const selectedArticle =
        state.selectedArticle?.id === action.payload.id
          ? { ...state.selectedArticle, bookmarked: action.payload.bookmarked }
          : state.selectedArticle;
      return { ...state, articles, selectedArticle };
    }
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Fetch feeds on mount
  const fetchFeeds = useCallback(async () => {
    try {
      const res = await fetch('/api/feeds');
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'SET_FEEDS', payload: data });
      }
    } catch {
      // silently fail
    }
  }, []);

  // Fetch filters on mount
  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch('/api/filters');
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'SET_FILTERS', payload: data });
      }
    } catch {
      // silently fail
    }
  }, []);

  // Fetch articles when selectedFeed, keyword, dateFrom, dateTo, showBookmarksOnly, or enabled filter changes
  const fetchArticles = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const params = new URLSearchParams();
      if (state.selectedFeed) params.set('feed_id', String(state.selectedFeed));
      if (state.keyword) params.set('keyword', state.keyword);
      if (state.dateFrom) params.set('date_from', state.dateFrom);
      if (state.dateTo) params.set('date_to', state.dateTo);
      if (state.showBookmarksOnly) params.set('bookmarked', '1');

      const res = await fetch(`/api/articles?${params}`);
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'SET_ARTICLES', payload: data.articles });
      }
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch articles' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.selectedFeed, state.keyword, state.dateFrom, state.dateTo, state.showBookmarksOnly, state.filters]);

  useEffect(() => {
    fetchFeeds();
    fetchFilters();
  }, [fetchFeeds, fetchFilters]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFeeds();
      fetchArticles();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchFeeds, fetchArticles]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
```

Key changes:
- Added `editingRuleId: number | null` to state
- Added `SET_EDITING_RULE` and `SELECT_RULE` actions
- Removed `TOGGLE_RULE_ENABLED` action
- `SELECT_RULE`: if payload is null, disable all; otherwise enable the selected rule and disable all others
- Added `state.filters` to `fetchArticles` dependency array so toggling a filter triggers a refetch

- [ ] **Step 2: Verify context compiles**

Run: `npx tsc --noEmit`
Expected: No new errors (pre-existing errors OK)

- [ ] **Step 3: Commit**

```bash
git add src/lib/context.tsx
git commit -m "refactor: replace TOGGLE_RULE_ENABLED with SELECT_RULE for single-selection"
```

---

### Task 2: Add filter chips to FilterBar

**Files:**
- Modify: `src/components/FilterBar.tsx`

- [ ] **Step 1: Replace FilterBar with chips version**

Full updated `FilterBar.tsx`:

```typescript
'use client';

import { useApp } from '@/lib/context';

export function FilterBar() {
  const { state, dispatch } = useApp();

  const handleSearch = (value: string) => {
    dispatch({ type: 'SET_KEYWORD', payload: value });
  };

  const handleDateFrom = (value: string) => {
    dispatch({ type: 'SET_DATE_FROM', payload: value });
  };

  const handleDateTo = (value: string) => {
    dispatch({ type: 'SET_DATE_TO', payload: value });
  };

  const handleToggleBookmarks = () => {
    dispatch({ type: 'TOGGLE_BOOKMARKS_ONLY' });
  };

  const handleToggleFilterEditor = () => {
    dispatch({ type: 'SET_EDITING_RULE', payload: null });
    dispatch({ type: 'TOGGLE_FILTER_EDITOR' });
  };

  const handleSelectRule = async (ruleId: number | null) => {
    if (ruleId === null) {
      // "None" selected — disable all
      dispatch({ type: 'SELECT_RULE', payload: null });
      return;
    }

    const activeRule = state.filters.find((f) => f.enabled);
    if (activeRule?.id === ruleId) {
      // Already selected — open editor for this rule
      dispatch({ type: 'SET_EDITING_RULE', payload: ruleId });
      dispatch({ type: 'TOGGLE_FILTER_EDITOR' });
    } else {
      // Select a new rule — enable it, disable others, then PUT each changed rule
      dispatch({ type: 'SELECT_RULE', payload: ruleId });
      // Persist enabled state to server
      try {
        await Promise.all(
          state.filters.map((f) =>
            fetch(`/api/filters/${f.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ enabled: f.id === ruleId ? 1 : 0 }),
            }),
          ),
        );
      } catch {
        // silently fail — UI state already updated
      }
    }
  };

  const handleNewRule = () => {
    dispatch({ type: 'SET_EDITING_RULE', payload: null });
    dispatch({ type: 'TOGGLE_FILTER_EDITOR' });
  };

  return (
    <div className="p-3 border-b border-gray-200 bg-white space-y-2">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Search articles..."
          value={state.keyword}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <button
          className={`text-sm px-3 py-1.5 rounded border ${state.showBookmarksOnly ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'border-gray-300 hover:bg-gray-50'}`}
          onClick={handleToggleBookmarks}
          title="Show bookmarked only"
        >
          ★
        </button>
        <button
          className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
          onClick={handleToggleFilterEditor}
        >
          Filters
        </button>
      </div>

      {/* Filter chips row */}
      <div className="flex items-center gap-2 flex-wrap">
        {state.filters.map((rule) => {
          const isActive = rule.enabled === 1;
          return (
            <button
              key={rule.id}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => handleSelectRule(rule.id)}
              title={isActive ? `Active — click to edit` : 'Click to activate'}
            >
              {rule.name}
              {isActive && ' ✓'}
            </button>
          );
        })}
        <button
          className="text-xs px-3 py-1 rounded-full border border-dashed border-gray-400 text-gray-500 hover:text-gray-700 hover:border-gray-500"
          onClick={handleNewRule}
        >
          + New Rule
        </button>
      </div>

      {/* Date range row */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>From:</span>
        <input
          type="date"
          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={state.dateFrom}
          onChange={(e) => handleDateFrom(e.target.value)}
        />
        <span>To:</span>
        <input
          type="date"
          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={state.dateTo}
          onChange={(e) => handleDateTo(e.target.value)}
        />
      </div>
    </div>
  );
}
```

Key changes:
- New chips row between search row and date row
- Each chip shows the rule name, with checkmark when active
- Active chip is blue-highlighted; inactive chips are gray
- Clicking an inactive chip enables it (and disables others), persists to server
- Clicking the active chip opens the editor in edit mode for that rule
- "+ New Rule" chip opens the editor for creating a new rule
- Filters button now resets `editingRuleId` to null before opening

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/FilterBar.tsx
git commit -m "feat: add filter chips row to FilterBar with single-selection"
```

---

### Task 3: Add edit mode to FilterRuleEditor

**Files:**
- Modify: `src/components/FilterRuleEditor.tsx`

- [ ] **Step 1: Replace FilterRuleEditor with edit-mode support**

Full updated `FilterRuleEditor.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';

const FIELDS = [
  { value: 'title', label: 'Title' },
  { value: 'content', label: 'Content' },
  { value: 'author', label: 'Author' },
  { value: 'source', label: 'Source' },
  { value: 'date', label: 'Date' },
];

const OPERATORS = [
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not Contains' },
  { value: 'regex', label: 'Regex' },
  { value: 'date_after', label: 'After (date)' },
  { value: 'date_before', label: 'Before (date)' },
];

interface ConditionInput {
  field: string;
  operator: string;
  value: string;
  logical_op: string;
}

export function FilterRuleEditor() {
  const { state, dispatch } = useApp();
  const [newRuleName, setNewRuleName] = useState('');
  const [conditions, setConditions] = useState<ConditionInput[]>([
    { field: 'title', operator: 'contains', value: '', logical_op: 'AND' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When editingRuleId is set, load that rule's data into the form
  useEffect(() => {
    if (state.editingRuleId !== null) {
      const rule = state.filters.find((f) => f.id === state.editingRuleId);
      if (rule) {
        setNewRuleName(rule.name);
        if (rule.conditions.length > 0) {
          setConditions(rule.conditions.map((c) => ({ ...c })));
        } else {
          setConditions([{ field: 'title', operator: 'contains', value: '', logical_op: 'AND' }]);
        }
      }
    } else {
      // Reset form for new rule creation
      setNewRuleName('');
      setConditions([{ field: 'title', operator: 'contains', value: '', logical_op: 'AND' }]);
    }
    setError(null);
  }, [state.editingRuleId, state.showFilterEditor]);

  const handleClose = () => {
    dispatch({ type: 'SET_EDITING_RULE', payload: null });
    dispatch({ type: 'TOGGLE_FILTER_EDITOR' });
  };

  const handleAddCondition = () => {
    setConditions((prev) => [
      ...prev,
      { field: 'title', operator: 'contains', value: '', logical_op: 'AND' },
    ]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCondition = (index: number, key: keyof ConditionInput, value: string) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  };

  const handleSaveRule = async () => {
    if (!newRuleName.trim()) return;
    if (conditions.some((c) => !c.value.trim())) {
      setError('All conditions must have a value');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const isEditing = state.editingRuleId !== null;

      if (isEditing) {
        // Update existing rule
        const res = await fetch(`/api/filters/${state.editingRuleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newRuleName.trim(), conditions }),
        });

        if (res.ok) {
          const filtersRes = await fetch('/api/filters');
          if (filtersRes.ok) {
            const data = await filtersRes.json();
            dispatch({ type: 'SET_FILTERS', payload: data });
          }
          handleClose();
        } else {
          const err = await res.json();
          setError(err.error || 'Failed to save rule');
        }
      } else {
        // Create new rule
        const res = await fetch('/api/filters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newRuleName.trim(), conditions }),
        });

        if (res.ok) {
          setNewRuleName('');
          setConditions([{ field: 'title', operator: 'contains', value: '', logical_op: 'AND' }]);
          const filtersRes = await fetch('/api/filters');
          if (filtersRes.ok) {
            const data = await filtersRes.json();
            dispatch({ type: 'SET_FILTERS', payload: data });
          }
        } else {
          const err = await res.json();
          setError(err.error || 'Failed to save rule');
        }
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRule = async (ruleId: number) => {
    const rule = state.filters.find((f) => f.id === ruleId);
    if (!rule) return;
    const newEnabled = rule.enabled ? 0 : 1;

    try {
      const res = await fetch(`/api/filters/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (res.ok) {
        dispatch({ type: 'SELECT_RULE', payload: newEnabled ? ruleId : null });
      }
    } catch {
      // silently fail
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Delete this rule?')) return;
    try {
      const res = await fetch(`/api/filters/${ruleId}`, { method: 'DELETE' });
      if (res.ok) {
        const filtersRes = await fetch('/api/filters');
        if (filtersRes.ok) {
          const data = await filtersRes.json();
          dispatch({ type: 'SET_FILTERS', payload: data });
        }
      }
    } catch {
      // silently fail
    }
  };

  const isEditing = state.editingRuleId !== null;
  const editingRule = isEditing ? state.filters.find((f) => f.id === state.editingRuleId) : null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={handleClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {isEditing ? `Edit Rule: ${editingRule?.name}` : 'Filter Rules'}
          </h2>
          <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={handleClose}>
            ×
          </button>
        </div>

        {/* Only show existing rules list when NOT in edit mode */}
        {!isEditing && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Active Rules</h3>
            {state.filters.length === 0 ? (
              <p className="text-sm text-gray-400">No rules defined</p>
            ) : (
              <ul className="space-y-2">
                {state.filters.map((rule) => (
                  <li key={rule.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        className={`w-5 h-5 rounded border flex items-center justify-center ${rule.enabled ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}
                        onClick={() => handleToggleRule(rule.id)}
                        title={rule.enabled ? 'Disable' : 'Enable'}
                      >
                        {rule.enabled ? '✓' : ''}
                      </button>
                      <span>{rule.name}</span>
                      <span className="text-gray-400 text-xs">
                        ({rule.conditions.length} conditions)
                      </span>
                    </div>
                    <button
                      className="text-red-400 hover:text-red-600 text-xs"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* New/Edit rule form */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            {isEditing ? 'Edit Conditions' : 'Add New Rule'}
          </h3>

          {/* Conditions */}
          <div className="space-y-2">
            {conditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <select
                    className="text-xs border border-gray-300 rounded px-1 py-1.5 w-14"
                    value={cond.logical_op}
                    onChange={(e) => handleUpdateCondition(i, 'logical_op', e.target.value)}
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                )}
                <select
                  className="text-xs border border-gray-300 rounded px-1 py-1.5"
                  value={cond.field}
                  onChange={(e) => handleUpdateCondition(i, 'field', e.target.value)}
                >
                  {FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  className="text-xs border border-gray-300 rounded px-1 py-1.5"
                  value={cond.operator}
                  onChange={(e) => handleUpdateCondition(i, 'operator', e.target.value)}
                >
                  {OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Value"
                  value={cond.value}
                  onChange={(e) => handleUpdateCondition(i, 'value', e.target.value)}
                />
                {conditions.length > 1 && (
                  <button
                    className="text-red-400 hover:text-red-600 text-xs"
                    onClick={() => handleRemoveCondition(i)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            className="text-sm text-blue-600 hover:text-blue-700 mt-2"
            onClick={handleAddCondition}
          >
            + Add Condition
          </button>

          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

          <button
            className="w-full mt-4 text-sm bg-blue-600 text-white rounded px-3 py-2 hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSaveRule}
            disabled={saving || !newRuleName.trim() || conditions.length === 0}
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Key changes:
- `useEffect` loads rule data into form when `state.editingRuleId` is set
- Header changes from "Filter Rules" to "Edit Rule: {name}" in edit mode
- Existing rules list is hidden in edit mode (only shown in default mode)
- Save button text changes: "Save Rule" vs "Save Changes"
- On save in edit mode: calls `PUT /api/filters/{id}` with name + conditions
- `handleToggleRule` in the rules list now dispatches `SELECT_RULE` instead of `TOGGLE_RULE_ENABLED`

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/FilterRuleEditor.tsx
git commit -m "feat: add edit mode to FilterRuleEditor for editing existing rules"
```

---

### Task 4: Integration test and manual verification

**Files:** No changes

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000 and verify:

1. **Chips display**: If filter rules exist, they appear as chips below the search row
2. **Single selection**: Click an inactive chip → it becomes blue (active), any previously active chip becomes gray
3. **Article refetch**: After selecting a chip, articles list updates to reflect the filter
4. **Edit mode**: Click the active (blue) chip → modal opens with "Edit Rule: {name}" title, conditions are loaded into the form
5. **Save edit**: Modify a condition, click "Save Changes" → modal closes, chip remains active, articles update
6. **New rule**: Click "+ New Rule" → modal opens with empty form
7. **Filters button**: Click "Filters" → modal shows the full rules list with enable/disable toggles
8. **Toggle from list**: In the rules list, clicking a toggle enables that rule and disables others (single-selection)

- [ ] **Step 3: Commit any fixes from testing**

```bash
git add src/components/FilterBar.tsx src/components/FilterRuleEditor.tsx src/lib/context.tsx
git commit -m "fix: address issues found during manual testing"
```

---

## Self-Review

### 1. Spec coverage check

| Spec requirement | Task |
|---|---|
| Display filter rules as chips in FilterBar | Task 2 |
| Single selection enforcement | Task 1 (SELECT_RULE), Task 2 (handleSelectRule) |
| Click chip to activate filter | Task 2 |
| Click active chip to edit conditions | Task 2 (handleSelectRule) + Task 3 (edit mode) |
| + New Rule opens editor | Task 2 + Task 3 |
| Filters button unchanged | Task 2 + Task 3 |
| PUT to persist enabled state | Task 2 |
| PUT to persist edited conditions | Task 3 |
| No changes to API/DB/engine | Confirmed — all three files are client-only |

### 2. Placeholder scan

No TBD, TODO, or vague instructions found. All code is fully written.

### 3. Type consistency

- `FilterRule` type is consistent across all three files
- `SELECT_RULE` payload type `number | null` is used uniformly
- `editingRuleId` type `number | null` is used uniformly
- `SET_EDITING_RULE` action is used in FilterBar and FilterRuleEditor

### 4. Scope check

Plan is focused on 3 files with clear, bounded changes. Appropriate for a single implementation plan.
