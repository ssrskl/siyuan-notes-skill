---
name: siyuan-notes
description: 思源笔记查询工具，如果用户的请求涉及查找、检索、浏览他们的笔记内容，就应该使用这个技能，例如:查询我的xxx
---

## 快速使用指南

### 推荐调用方式

```bash
# 全文搜索（推荐，支持中文分词）
node -e "const s = require('./index.js'); (async () => { const r = await s.searchNotes('关键词', 20); console.log('共', r.totalCount, '条，', r.totalPages, '页'); console.log(r.blocks); })();"

# 只搜索标题
node -e "const s = require('./index.js'); (async () => { const r = await s.searchNotes('关键词', 10, 'h'); console.log('共', r.totalCount, '条'); console.log(r.blocks); })();"

# 获取更多结果（翻页，第2页）
node -e "const s = require('./index.js'); (async () => { const r = await s.searchNotes('关键词', 20, null, 2); console.log('第', r.currentPage, '/', r.totalPages, '页'); console.log(r.blocks); })();"

# SQL复杂查询
node -e "const s = require('./index.js'); (async () => { console.log(await s.executeSiyuanQuery('SELECT * FROM blocks WHERE content LIKE \"%关键词%\" LIMIT 10')); })();"
```

### 块类型参数

`h`-标题 `p`-段落 `d`-文档 `l`-列表 `c`-代码 `t`-表格 `b`-引用

### ⚠️ 限制

不要使用 `cwd` 参数、不要创建临时文件、不要使用 `cd` 命令

---

## 搜索策略指南

### 核心原则：持续尝试，直到解决用户问题

搜索不是一次性的，如果第一次搜索不到结果，应该：

1. **尝试同义词/相关词**：如"压缩"可搜"压缩、优化、减小、精简"
2. **尝试模糊关键词**：如"图片压缩"可搜"压缩"、"图片"
3. **尝试不同块类型**：标题搜不到就搜段落、文档
4. **尝试SQL查询**：全文搜索不到就用SQL LIKE
5. **尝试组合查询**：多个关键词用 OR 连接
6. **尝试翻页获取更多结果**：第一次搜索的结果不够，就搜索第2页、第3页

### 多轮搜索示例

用户问"我的笔记里关于前端优化的内容"

第一轮 - 精确匹配（第1页，每页20条）：
```bash
node -e "const s = require('./index.js'); (async () => { const r = await s.searchNotes('前端优化', 20); console.log('共', r.totalCount, '条结果'); console.log(r.blocks); })();"
```

如果结果不足 → 第二轮 - 相关词：
```bash
node -e "const s = require('./index.js'); (async () => { const r = await s.searchNotes('性能优化', 20); console.log('共', r.totalCount, '条结果'); console.log(r.blocks); })();"
```

如果结果不足 → 第三轮 - 拆分词并查看是否有更多页：
```bash
node -e "const s = require('./index.js'); (async () => { const r = await s.searchNotes('优化', 20); console.log('共', r.totalCount, '条，', r.totalPages, '页'); console.log(r.blocks); })();"
```

如果还有更多页 → 第四轮 - 翻页查看第2页：
```bash
node -e "const s = require('./index.js'); (async () => { const r = await s.searchNotes('优化', 20, null, 2); console.log('第', r.currentPage, '/', r.totalPages, '页'); console.log(r.blocks); })();"
```

如果结果仍不足 → 第五轮 - SQL组合查询：
```bash
node -e "const s = require('./index.js'); (async () => { console.log(await s.executeSiyuanQuery('SELECT * FROM blocks WHERE content LIKE \"%前端%\" OR content LIKE \"%性能%\" OR content LIKE \"%优化%\" LIMIT 30')); })();"
```

### 关键词扩展技巧

| 用户查询 | 可尝试的关键词 |
|---------|--------------|
| 图片压缩 | 压缩、优化、减小、webp、图片处理 |
| 工作总结 | 总结、周报、月报、汇报、复盘 |
| bug修复 | bug、修复、问题、issue、调试 |
| 学习笔记 | 学习、笔记、记录、整理、心得 |

---

## SQL 查询参考

### blocks 表结构

- `id`: 块ID (格式: 时间-随机字符)
- `type`: 块类型 (`d`文档 `h`标题 `p`段落 `l`列表 `c`代码 `t`表格 `b`引用)
- `subtype`: 子类型 (标题 h1-h6, 列表 u无序/t任务/o有序)
- `content`: 去除Markdown标记的文本
- `markdown`: 包含完整Markdown标记的文本
- `hpath`: 人类可读路径 (如 `/笔记本/文档`)
- `created`: 创建时间 (YYYYMMDDHHmmss)
- `updated`: 更新时间 (YYYYMMDDHHmmss)
- `root_id`: 所属文档ID
- `parent_id`: 父块ID
- `box`: 笔记本ID

### refs 表结构

- `def_block_id`: 被引用块的ID
- `block_id`: 引用所在块的ID

### SQL 示例

```sql
-- 查询段落块
SELECT * FROM blocks WHERE type='p' AND content LIKE '%关键词%'

-- 查询最近7天内容
SELECT * FROM blocks WHERE updated > strftime('%Y%m%d%H%M%S', datetime('now', '-7 day'))

-- 组合查询（多个关键词）
SELECT * FROM blocks WHERE content LIKE '%关键词1%' OR content LIKE '%关键词2%'

-- 查询包含标签的块
SELECT * FROM blocks WHERE content LIKE '%#标签名%'

-- 查询反向链接
SELECT * FROM blocks WHERE id IN (SELECT block_id FROM refs WHERE def_block_id='块ID')

-- 查询未完成任务
SELECT * FROM blocks WHERE type='l' AND subtype='t' AND markdown LIKE '* [ ] %'
```
