# RSS Reader - Design Document

## Overview

本地 Web RSS 阅读器，支持订阅源管理、定时抓取、自定义过滤规则、收藏功能。

技术栈：Next.js (App Router) + better-sqlite3 + node-cron + rss-parser + Tailwind CSS。

## Architecture

```
Browser (三栏布局)
    │ REST API
Next.js App (localhost)
├── API Routes — feeds, articles, filters, bookmarks
├── Cron Worker — node-cron 定时拉取 RSS
└── SQLite (better-sqlite3) — 本地持久化
```

- 单端口运行，前端与 API 同域
- Cron 在 server 启动时注册，每条 feed 独立调度
- 默认轮询间隔 30 分钟（`.env` 可配）

## Data Model

### feeds
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| url | TEXT UNIQUE | 订阅地址 |
| title | TEXT | feed 标题 |
| site_url | TEXT | 站点地址 |
| last_poll | DATETIME | 最后拉取时间 |
| created_at | DATETIME | |

### articles
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| feed_id | INTEGER FK → feeds | |
| guid | TEXT | RSS 原始 id |
| title | TEXT | |
| link | TEXT | |
| content | TEXT | |
| snippet | TEXT | 摘要 |
| author | TEXT | |
| published_at | DATETIME | |
| fetched_at | DATETIME | 本地抓取时间 |
| poll_batch_id | TEXT | 轮询批次 UUID |
| bookmarked | INTEGER DEFAULT 0 | |
| bookmarked_at | DATETIME | |
| UNIQUE indexes via partial indexes | | 防重复 (guid优先, 无guid时用link) |

### filter_rules
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| name | TEXT | |
| enabled | INTEGER DEFAULT 1 | |
| created_at | DATETIME | |

### filter_conditions
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| rule_id | INTEGER FK → filter_rules | |
| field | TEXT | title\|content\|author\|source\|date |
| operator | TEXT | contains\|not_contains\|regex\|date_after\|date_before |
| value | TEXT | |
| logical_op | TEXT DEFAULT 'AND' | AND\|OR |

### filter_feed_rules
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| rule_id | INTEGER FK → filter_rules | |
| feed_id | INTEGER FK → feeds | |

## Data Retention

- 每条 feed 保留最近 5 次轮询的文章（按 `poll_batch_id`）
- 被收藏的文章跳过清理
- 移出收藏后，如不在保留批次内，则清理
- 删除 feed 时级联清理所有关联文章

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/feeds` | GET | 列出所有订阅源 + 未读计数 |
| `/api/feeds` | POST | 添加订阅 `{ url }` |
| `/api/feeds/:id` | DELETE | 删除订阅源 |
| `/api/feeds/:id/refresh` | POST | 手动触发轮询 |
| `/api/articles` | GET | 查询文章（支持过滤、分页） |
| `/api/articles/:id` | GET | 单篇详情 |
| `/api/articles/:id/bookmark` | POST | 收藏/取消收藏 |
| `/api/filters` | GET | 列出所有规则 |
| `/api/filters` | POST | 创建规则 |
| `/api/filters/:id` | PUT | 更新规则 |
| `/api/filters/:id` | DELETE | 删除规则 |

## Filter Engine

查询文章时，后端对结果应用启用的过滤规则：

- 每个规则包含多个 conditions，按 `logical_op` 链式求值
- 字段映射：title, content, author, source (feed title), date
- 运算符：contains, not_contains, regex, date_after, date_before
- 规则可绑定特定 feed，未绑定则全局生效

## Frontend Structure

```
App
├── LeftSidebar
│   ├── FeedList (添加、删除、手动刷新)
│   └── AddFeedDialog
├── MiddlePanel
│   ├── FilterBar (规则选择器 + 快速过滤)
│   ├── ArticleList (虚拟滚动)
│   └── BookmarkToggle
├── RightPanel
│   ├── ArticleDetail
│   └── EmptyState
└── FilterRuleEditor (弹窗)
    ├── RuleList
    ├── ConditionBuilder (字段+运算符+值+逻辑关系)
    └── Preview (实时预览匹配数)
```

## Error Handling

- 订阅源无效/不可达 → 列表显示错误 badge，可点击重试
- 网络异常 → Toast 通知，不阻断已缓存内容
- 过滤规则配置错误（非法正则等）→ 保存前校验，标红提示
- RSS 解析失败 → 跳过条目，记录日志

## State Management

React Context + useReducer，无需 Redux。

