'use client';

import { useState } from 'react';
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

  const handleClose = () => {
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
      const res = await fetch('/api/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRuleName.trim(), conditions }),
      });

      if (res.ok) {
        setNewRuleName('');
        setConditions([{ field: 'title', operator: 'contains', value: '', logical_op: 'AND' }]);
        // Re-fetch filters
        const filtersRes = await fetch('/api/filters');
        if (filtersRes.ok) {
          const data = await filtersRes.json();
          dispatch({ type: 'SET_FILTERS', payload: data });
        }
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to save rule');
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
        dispatch({ type: 'TOGGLE_RULE_ENABLED', payload: ruleId });
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

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={handleClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Filter Rules</h2>
          <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={handleClose}>
            ×
          </button>
        </div>

        {/* Existing rules */}
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

        {/* New rule form */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Add New Rule</h3>
          <input
            type="text"
            className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 mb-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Rule name"
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
          />

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
            disabled={saving || !newRuleName.trim()}
          >
            {saving ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
