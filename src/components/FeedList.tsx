'use client';

import { useState } from 'react';
import { useApp } from '@/lib/context';

export function FeedList() {
  const { state, dispatch } = useApp();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState<number | null>(null);

  const handleSelectFeed = (feedId: number | null) => {
    dispatch({ type: 'SELECT_FEED', payload: feedId });
  };

  const handleAddFeed = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim() }),
      });
      if (res.ok) {
        setNewUrl('');
        setShowAddDialog(false);
        // Re-fetch feeds
        const feedsRes = await fetch('/api/feeds');
        if (feedsRes.ok) {
          const data = await feedsRes.json();
          dispatch({ type: 'SET_FEEDS', payload: data });
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add feed');
      }
    } catch {
      alert('Network error');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteFeed = async (feedId: number) => {
    if (!confirm('Delete this feed and all its articles?')) return;
    try {
      const res = await fetch(`/api/feeds/${feedId}`, { method: 'DELETE' });
      if (res.ok) {
        if (state.selectedFeed === feedId) dispatch({ type: 'SELECT_FEED', payload: null });
        const feedsRes = await fetch('/api/feeds');
        if (feedsRes.ok) {
          const data = await feedsRes.json();
          dispatch({ type: 'SET_FEEDS', payload: data });
        }
      }
    } catch {
      alert('Network error');
    }
  };

  const handleRefresh = async (feedId: number) => {
    setRefreshing(feedId);
    try {
      await fetch(`/api/feeds/${feedId}/refresh`, { method: 'POST' });
      // Re-fetch feeds and articles
      const feedsRes = await fetch('/api/feeds');
      if (feedsRes.ok) {
        const data = await feedsRes.json();
        dispatch({ type: 'SET_FEEDS', payload: data });
      }
    } catch {
      // silently fail
    } finally {
      setRefreshing(null);
    }
  };

  return (
    <div>
      {/* Feed list */}
      <ul className="divide-y divide-gray-100">
        <li
          className={`px-4 py-2.5 cursor-pointer text-sm hover:bg-gray-50 ${state.selectedFeed === null ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
          onClick={() => handleSelectFeed(null)}
        >
          All Feeds
        </li>
        {state.feeds.map((feed) => (
          <li
            key={feed.id}
            className="group px-4 py-2.5 cursor-pointer text-sm hover:bg-gray-50 flex items-center justify-between"
          >
            <span
              className={`flex-1 truncate ${state.selectedFeed === feed.id ? 'text-blue-700 font-medium' : 'text-gray-700'}`}
              onClick={() => handleSelectFeed(feed.id)}
            >
              {feed.title || feed.url}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
              <button
                className="p-1 hover:bg-gray-200 rounded"
                title="Refresh"
                onClick={(e) => { e.stopPropagation(); handleRefresh(feed.id); }}
                disabled={refreshing === feed.id}
              >
                {refreshing === feed.id ? (
                  <span className="animate-spin text-xs">⟳</span>
                ) : (
                  <span className="text-xs">⟳</span>
                )}
              </button>
              <button
                className="p-1 hover:bg-red-100 text-red-500 rounded"
                title="Delete"
                onClick={(e) => { e.stopPropagation(); handleDeleteFeed(feed.id); }}
              >
                <span className="text-xs">×</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Add feed button */}
      <div className="p-3 border-t border-gray-200">
        {!showAddDialog ? (
          <button
            className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
            onClick={() => setShowAddDialog(true)}
          >
            + Add Feed
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="url"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="https://example.com/feed.xml"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFeed()}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                className="flex-1 text-sm bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700 disabled:opacity-50"
                onClick={handleAddFeed}
                disabled={adding || !newUrl.trim()}
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
              <button
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 hover:bg-gray-50"
                onClick={() => { setShowAddDialog(false); setNewUrl(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
