'use client';

import { useApp } from '@/lib/context';
import { FeedList } from '@/components/FeedList';
import { ArticleList } from '@/components/ArticleList';
import { FilterBar } from '@/components/FilterBar';
import { ArticleDetail } from '@/components/ArticleDetail';
import { FilterRuleEditor } from '@/components/FilterRuleEditor';

export default function Home() {
  const { state } = useApp();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - Feed List */}
      <aside className="w-72 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">RSS Reader</h1>
        </div>
        <div className="flex-1 overflow-y-auto custom-scroll">
          <FeedList />
        </div>
      </aside>

      {/* Middle Panel - Article List */}
      <main className="flex-1 flex flex-col min-w-0">
        <FilterBar />
        <div className="flex-1 overflow-y-auto custom-scroll p-4">
          <ArticleList />
        </div>
      </main>

      {/* Right Panel - Article Detail */}
      <aside className="w-96 border-l border-gray-200 bg-white flex flex-col shrink-0">
        {state.selectedArticle ? (
          <div className="flex-1 overflow-y-auto custom-scroll p-4">
            <ArticleDetail />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p className="text-sm">Select an article to read</p>
          </div>
        )}
      </aside>

      {/* Filter Rule Editor Modal */}
      {state.showFilterEditor && <FilterRuleEditor />}
    </div>
  );
}
