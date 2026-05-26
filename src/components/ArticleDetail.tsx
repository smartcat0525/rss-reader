'use client';

import { useApp } from '@/lib/context';
import DOMPurify from 'dompurify';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString();
}

export function ArticleDetail() {
  const { state, dispatch } = useApp();
  const article = state.selectedArticle;
  if (!article) return null;

  const handleBookmark = async () => {
    try {
      const res = await fetch(`/api/articles/${article.id}/bookmark`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        dispatch({
          type: 'UPDATE_ARTICLE_BOOKMARK',
          payload: { id: article.id, bookmarked: data.bookmarked ? 1 : 0 },
        });
      }
    } catch {
      // silently fail
    }
  };

  const sanitizedContent = DOMPurify.sanitize(article.content || '');

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 leading-snug">
          {article.title || 'Untitled'}
        </h2>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          <a
            href={article.feed_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {article.feed_title}
          </a>
          {article.author && <span>· {article.author}</span>}
          <span>· {formatDate(article.published_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
        <button
          className={`text-sm px-3 py-1.5 rounded border ${article.bookmarked ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'border-gray-300 hover:bg-gray-50'}`}
          onClick={handleBookmark}
        >
          {article.bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
        </button>
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-blue-600"
          >
            Original →
          </a>
        )}
      </div>

      {/* Content */}
      <div
        className="article-content text-sm leading-relaxed text-gray-800"
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    </div>
  );
}
