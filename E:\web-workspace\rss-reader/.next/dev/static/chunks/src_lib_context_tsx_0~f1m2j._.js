(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/context.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AppProvider",
    ()=>AppProvider,
    "useApp",
    ()=>useApp
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
const initialState = {
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
    showBookmarksOnly: false
};
function appReducer(state, action) {
    switch(action.type){
        case 'SET_FEEDS':
            return {
                ...state,
                feeds: action.payload
            };
        case 'SET_ARTICLES':
            return {
                ...state,
                articles: action.payload
            };
        case 'SET_FILTERS':
            return {
                ...state,
                filters: action.payload
            };
        case 'SELECT_ARTICLE':
            return {
                ...state,
                selectedArticle: action.payload
            };
        case 'SELECT_FEED':
            return {
                ...state,
                selectedFeed: action.payload
            };
        case 'SET_LOADING':
            return {
                ...state,
                loading: action.payload
            };
        case 'SET_ERROR':
            return {
                ...state,
                error: action.payload
            };
        case 'TOGGLE_FILTER_EDITOR':
            return {
                ...state,
                showFilterEditor: !state.showFilterEditor
            };
        case 'OPEN_FILTER_EDITOR':
            return {
                ...state,
                showFilterEditor: true
            };
        case 'SET_EDITING_RULE':
            return {
                ...state,
                editingRuleId: action.payload
            };
        case 'SELECT_RULE':
            {
                if (action.payload === null) {
                    return {
                        ...state,
                        filters: state.filters.map((f)=>({
                                ...f,
                                enabled: 0
                            }))
                    };
                }
                const filters = state.filters.map((f)=>({
                        ...f,
                        enabled: f.id === action.payload ? 1 : 0
                    }));
                return {
                    ...state,
                    filters
                };
            }
        case 'SET_KEYWORD':
            return {
                ...state,
                keyword: action.payload
            };
        case 'SET_DATE_FROM':
            return {
                ...state,
                dateFrom: action.payload
            };
        case 'SET_DATE_TO':
            return {
                ...state,
                dateTo: action.payload
            };
        case 'TOGGLE_BOOKMARKS_ONLY':
            return {
                ...state,
                showBookmarksOnly: !state.showBookmarksOnly
            };
        case 'UPDATE_ARTICLE_BOOKMARK':
            {
                const articles = state.articles.map((a)=>a.id === action.payload.id ? {
                        ...a,
                        bookmarked: action.payload.bookmarked
                    } : a);
                const selectedArticle = state.selectedArticle?.id === action.payload.id ? {
                    ...state.selectedArticle,
                    bookmarked: action.payload.bookmarked
                } : state.selectedArticle;
                return {
                    ...state,
                    articles,
                    selectedArticle
                };
            }
        default:
            return state;
    }
}
const AppContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
function AppProvider({ children }) {
    _s();
    const [state, dispatch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useReducer"])(appReducer, initialState);
    // Fetch feeds on mount
    const fetchFeeds = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[fetchFeeds]": async ()=>{
            try {
                const res = await fetch('/api/feeds');
                if (res.ok) {
                    const data = await res.json();
                    dispatch({
                        type: 'SET_FEEDS',
                        payload: data
                    });
                }
            } catch  {
            // silently fail
            }
        }
    }["AppProvider.useCallback[fetchFeeds]"], []);
    // Fetch filters on mount
    const fetchFilters = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[fetchFilters]": async ()=>{
            try {
                const res = await fetch('/api/filters');
                if (res.ok) {
                    const data = await res.json();
                    dispatch({
                        type: 'SET_FILTERS',
                        payload: data
                    });
                }
            } catch  {
            // silently fail
            }
        }
    }["AppProvider.useCallback[fetchFilters]"], []);
    // Fetch articles when selectedFeed, keyword, dateFrom, dateTo, showBookmarksOnly, or enabled filter changes
    const fetchArticles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[fetchArticles]": async ()=>{
            dispatch({
                type: 'SET_LOADING',
                payload: true
            });
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
                    dispatch({
                        type: 'SET_ARTICLES',
                        payload: data.articles
                    });
                }
            } catch  {
                dispatch({
                    type: 'SET_ERROR',
                    payload: 'Failed to fetch articles'
                });
            } finally{
                dispatch({
                    type: 'SET_LOADING',
                    payload: false
                });
            }
        }
    }["AppProvider.useCallback[fetchArticles]"], [
        state.selectedFeed,
        state.keyword,
        state.dateFrom,
        state.dateTo,
        state.showBookmarksOnly,
        state.filters
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AppProvider.useEffect": ()=>{
            fetchFeeds();
            fetchFilters();
        }
    }["AppProvider.useEffect"], [
        fetchFeeds,
        fetchFilters
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AppProvider.useEffect": ()=>{
            fetchArticles();
        }
    }["AppProvider.useEffect"], [
        fetchArticles
    ]);
    // Auto-refresh every 60s
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AppProvider.useEffect": ()=>{
            const interval = setInterval({
                "AppProvider.useEffect.interval": ()=>{
                    fetchFeeds();
                    fetchArticles();
                }
            }["AppProvider.useEffect.interval"], 60000);
            return ({
                "AppProvider.useEffect": ()=>clearInterval(interval)
            })["AppProvider.useEffect"];
        }
    }["AppProvider.useEffect"], [
        fetchFeeds,
        fetchArticles
    ]);
    const refetchArticles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[refetchArticles]": async ()=>{
            await fetchArticles();
        }
    }["AppProvider.useCallback[refetchArticles]"], [
        fetchArticles
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AppContext.Provider, {
        value: {
            state,
            dispatch,
            refetchArticles
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/lib/context.tsx",
        lineNumber: 227,
        columnNumber: 10
    }, this);
}
_s(AppProvider, "t4jFd4o2Q/aOewvbLWEFH5F37ag=");
_c = AppProvider;
function useApp() {
    _s1();
    const ctx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
}
_s1(useApp, "/dMy7t63NXD4eYACoT93CePwGrg=");
var _c;
__turbopack_context__.k.register(_c, "AppProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_lib_context_tsx_0~f1m2j._.js.map