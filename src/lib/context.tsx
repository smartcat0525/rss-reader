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
  | { type: 'SET_KEYWORD'; payload: string }
  | { type: 'SET_DATE_FROM'; payload: string }
  | { type: 'SET_DATE_TO'; payload: string }
  | { type: 'TOGGLE_BOOKMARKS_ONLY' }
  | { type: 'UPDATE_ARTICLE_BOOKMARK'; payload: { id: number; bookmarked: number } }
  | { type: 'TOGGLE_RULE_ENABLED'; payload: number };

const initialState: AppState = {
  feeds: [],
  articles: [],
  filters: [],
  selectedArticle: null,
  selectedFeed: null,
  loading: false,
  error: null,
  showFilterEditor: false,
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
    case 'TOGGLE_RULE_ENABLED': {
      const filters = state.filters.map((f) =>
        f.id === action.payload ? { ...f, enabled: f.enabled ? 0 : 1 } : f,
      );
      return { ...state, filters };
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

  // Fetch articles when selectedFeed, keyword, dateFrom, dateTo, or showBookmarksOnly changes
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
  }, [state.selectedFeed, state.keyword, state.dateFrom, state.dateTo, state.showBookmarksOnly]);

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
