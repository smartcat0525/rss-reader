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
