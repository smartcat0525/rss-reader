# Filter Chips 设计文档

## 目标

将已创建的 filter 规则以 chips 形式展示在 FilterBar 中，用户可直接勾选启用（单选）或点击编辑规则条件。

## 交互规则

- **单选约束**：同一时间只能启用一个 filter 规则
- **勾选未选中 chip**：启用该规则，自动禁用其他所有规则，立即刷新文章列表
- **点击已选中 chip**：打开 FilterRuleEditor 模态框，进入该规则的编辑模式
- **无选中 chip**：不应用任何过滤，显示全部文章
- **+ New Rule chip**：打开 FilterRuleEditor 新建表单
- **Filters 按钮**：保留，行为不变（显示规则列表 + 新建表单）

## 架构

### 涉及文件

| 文件 | 变更 |
|---|---|
| `src/components/FilterBar.tsx` | 新增 chips 渲染区域 |
| `src/components/FilterRuleEditor.tsx` | 新增单规则编辑模式 |
| `src/lib/context.tsx` | 新增 SELECT_RULE action，删除 TOGGLE_RULE_ENABLED |

### 不涉及变更

- API 路由（`/api/filters/*`）— 现有 PUT/POST/DELETE 已满足需求
- `filter-engine.ts` — 服务端过滤逻辑不变
- 数据库 schema — 无新字段

## 详细设计

### 1. FilterBar

```
搜索行: [ Search articles... ] [★] [Filters]
Chip行:  [Rule A] [Rule B ✓] [Rule C] [+ New Rule]
日期行:  From: [date] To: [date]
```

- chip 数据来自 `state.filters`
- 已选中的 chip 用蓝色高亮，其余为灰色边框
- 空状态：filters 为空时只显示 `+ New Rule`

### 2. FilterRuleEditor

新增 `editingRuleId?: number` prop 或 context 状态：

- **默认模式**（从 Filters 按钮进入）：现有行为不变
- **编辑模式**（从已选中 chip 点击）：
  - 标题：`Edit Rule: {rule.name}`
  - 加载该规则的 conditions 到表单，可增删改
  - 保存时调用 `PUT /api/filters/{id}` 更新 name + conditions
  - 成功后刷新 filters 并关闭模态框

### 3. Context (context.tsx)

新增 action：

```
SELECT_RULE: { payload: number | null }
  - payload 为 ruleId：启用该规则，其他全部禁用
  - payload 为 null：禁用所有规则
```

删除 action：

```
TOGGLE_RULE_ENABLED — 被 SELECT_RULE 替代
```

`fetchArticles` 的依赖项需包含 filter 启用状态，确保切换时重新请求。

## 错误处理

- 切换规则时 PUT 请求失败：静默回退本地状态，不影响 UI
- 编辑保存失败：在模态框内显示错误提示，不关闭模态框
