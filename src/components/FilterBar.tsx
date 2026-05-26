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
