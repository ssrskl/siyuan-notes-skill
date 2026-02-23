---
name: siyuan-notes
description: 思源笔记查询工具，如果用户的请求涉及查找、检索、浏览他们的笔记内容，就应该使用这个技能，例如:查询我的xxx
---

## 快速使用指南

### 核心方法

```bash
# 全文搜索（推荐，支持中文分词，返回格式化字符串）
node -e "const s = require('./index.js'); (async () => { console.log(await s.searchNotes('关键词', 20)); })();"

# 按类型搜索（只搜索标题）
node -e "const s = require('./index.js'); (async () => { console.log(await s.searchNotes('关键词', 10, 'h')); })();"

# 翻页（第2页）
node -e "const s = require('./index.js'); (async () => { console.log(await s.searchNotes('关键词', 20, null, 2)); })();"

# SQL查询（返回精简后的原始数据数组）
node -e "const s = require('./index.js'); (async () => { console.log(await s.executeSiyuanQuery('SELECT * FROM blocks WHERE content LIKE \\\"%关键词%\\\" LIMIT 10')); })();"
```

### 块类型参数

`h`-标题 `p`-段落 `d`-文档 `l`-列表 `c`-代码 `t`-表格 `b`-引用

### ⚠️ 限制

不要使用 `cwd` 参数、不要创建临时文件、不要使用 `cd` 命令

---

## 搜索策略指南

### 核心原则

持续尝试，直到解决用户问题：

1. **尝试同义词/相关词**
2. **尝试模糊关键词**（拆分复合词）
3. **尝试不同块类型**（标题、段落、文档）
4. **尝试翻页获取更多结果**
5. **尝试SQL组合查询**

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

- `id`: 块ID | `type`: 块类型(d/h/p/l/c/t/b) | `subtype`: 子类型
- `content`: 纯文本 | `markdown`: Markdown文本 | `hpath`: 人类可读路径
- `created/updated`: 创建/更新时间 (YYYYMMDDHHmmss)
- `root_id`: 所属文档ID | `parent_id`: 父块ID | `box`: 笔记本ID

### SQL 示例

```sql
-- 查询段落块
SELECT * FROM blocks WHERE type='p' AND content LIKE '%关键词%'

-- 组合查询（多个关键词）
SELECT * FROM blocks WHERE content LIKE '%关键词1%' OR content LIKE '%关键词2%'

-- 查询最近7天
SELECT * FROM blocks WHERE updated > strftime('%Y%m%d%H%M%S', datetime('now', '-7 day'))

-- 查询反向链接
SELECT * FROM blocks WHERE id IN (SELECT block_id FROM refs WHERE def_block_id='块ID')
```
