# RSS Reader

一个自托管的 RSS 阅读器，支持原文内容提取和预计算过滤规则。

## 功能特性

- **Feed 管理** — 添加、刷新和删除 RSS/Atom 订阅源
- **内容提取** — 当 RSS 只提供简短摘要时（如 HN 的 "Comments" 链接），自动从原文地址抓取页面并使用 Mozilla Readability 提取可读内容
- **预计算过滤规则** — 定义正则或包含匹配规则（如"标题包含 AI | SaaS | tool"），在数据采集时进行匹配，查询时无需实时计算。激活的规则通过 SQL 直接过滤文章
- **文章筛选** — 支持关键词搜索、日期范围、收藏和激活的过滤规则
- **后台任务** — 通过 `node-cron` 定时轮询 Feed 和补全缺失的内容
- **本地存储** — 使用 `better-sqlite3` 驱动 SQLite，无需外部数据库

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript |
| 数据库 | better-sqlite3 |
| 样式 | Tailwind CSS v4 |
| 内容提取 | `@mozilla/readability` + `jsdom` |
| RSS 解析 | `rss-parser` |
| HTML 清理 | `dompurify` |
| 任务调度 | `node-cron` |

## 快速开始

### 前置要求

- Node.js 22+
- npm 或 pnpm

### 安装

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

打开 http://localhost:3000 即可查看。Cron 工作器会在首次 API 请求时自动启动。

### 生产模式

```bash
npm run build
npm start
```

## 项目结构

```
src/
── app/
│   ├── api/
│   │   ├── articles/           # 文章列表 API（通过 matched_rule_ids SQL 过滤）
│   │   │   └── route.ts
│   │   ├── articles/[id]/      # 文章详情、收藏操作
│   │   ├── feeds/              # Feed CRUD + 懒加载 Cron 工作器
│   │   │   ├── route.ts
│   │   │   └── [id]/           # 刷新、删除
│   │   └── filters/            # 过滤规则 CRUD
│   │       ├── route.ts
│   │       └── [id]/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ArticleDetail.tsx       # 右侧面板 — 文章正文、收藏按钮
│   ├── ArticleList.tsx         # 文章卡片列表（含摘要）
│   ├── FeedList.tsx            # 左侧栏 — Feed 导航
│   ├── FilterBar.tsx           # 搜索栏、过滤 Chips、日期范围
│   └── FilterRuleEditor.tsx    # 创建/编辑规则的弹窗
└── lib/
    ├── content-extractor.ts    # Mozilla Readability 提取工具
    ├── cron-init.ts            # Cron 工作器启动（从 API 路由懒加载）
    ├── cron-worker.ts          # Feed 抓取、内容提取、过滤匹配
    ├── db.ts                   # SQLite 初始化 + 数据库迁移
    ├── filter-engine.ts        # 规则匹配逻辑（matchCondition、matchRule、recompute）
    ├── schema.sql              # 数据库 Schema
    └── context.tsx             # React 状态管理 + refetchArticles
```

## 过滤系统工作原理

### 规则定义

每条规则包含名称和多个条件（字段 + 运算符 + 值）：

| 字段 | 运算符 | 示例 |
|------|--------|------|
| `title` | `contains`, `not_contains`, `regex` | "AI" |
| `content` | `contains`, `not_contains`, `regex` | "SaaS" |
| `author` | `contains` | "John" |
| `source` | `contains` | "TechCrunch" |
| `date` | `date_after`, `date_before` | "2024-01-01" |

多个条件之间使用 `AND`/`OR` 逻辑运算符连接。

### 预计算匹配

规则在 Feed 采集阶段进行匹配评估（`cron-worker.ts`）：

1. 抓取 Feed XML 并保存文章
2. 如果 RSS 摘要过短，自动提取原文内容
3. `recomputeMatchesForFeed()` 对每篇文章执行 `matchRule`，匹配所有适用的规则
4. 匹配的规则 ID 以逗号分隔的字符串形式存入 `articles.matched_rule_ids`

查询时，API 通过简单的 SQL 过滤：

```sql
WHERE (',' || a.matched_rule_ids || ',' LIKE '%,<ruleId>,%')
```

无需 JavaScript 过滤——即时返回结果。

### 匹配结果何时重新计算

| 事件 | 触发位置 | 范围 |
|------|---------|------|
| Feed 抓取 | `fetchFeed()` | 该 Feed 的所有文章 |
| 内容补全 | `fillMissingArticleContent()` | 单篇文章 |
| 规则编辑 | `PUT /api/filters/:id` | 该规则适用的所有文章 |
| 规则删除 | 外键级联 | 自动清理 |

## 配置

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `CRON_INTERVAL` | `30` | Feed 轮询间隔（分钟） |

## 数据库 Schema

```
feeds                  — RSS Feed URL 和标题
articles               — 解析后的文章，含内容、摘要、matched_rule_ids
filter_rules           — 命名的过滤规则，含 enabled 状态
filter_conditions      — 每条规则下的具体条件
filter_feed_rules      — 可选的 Feed 范围绑定
```

所有表使用 `INTEGER PRIMARY KEY AUTOINCREMENT`。文章通过 `(feed_id, guid)` 或 `(feed_id, link)` 去重。旧的轮询批次会自动清理，默认保留最近 5 个批次。
