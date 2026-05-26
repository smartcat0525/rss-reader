'use client';

import { useApp } from '@/lib/context';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffHrs < 168) return `${Math.floor(diffHrs / 24)}d ago`;
  return date.toLocaleDateString();
}

export function ArticleList() {
  const { state, dispatch } = useApp();

  const handleSelect = async (article: typeof state.articles[0]) => {
    dispatch({ type: 'SELECT_ARTICLE', payload: article });
  };

  if (state.loading && state.articles.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  if (state.articles.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No articles found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state.articles.map((article) => (
        <article
          key={article.id}
          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:shadow-sm ${
            state.selectedArticle?.id === article.id
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
          onClick={() => handleSelect(article)}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm text-gray-900 leading-snug flex-1">
              {article.title || 'Untitled'}
            </h3>
            {article.bookmarked ? (
              <span className="text-yellow-500 text-sm shrink-0">★</span>
            ) : null}
          </div>
          {article.snippet && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
              {article.snippet.replace(/<[^>]*>/g, '')}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>{article.feed_title}</span>
            {article.author && <span>· {article.author}</span>}
            <span>· {formatDate(article.published_at || article.fetched_at)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
