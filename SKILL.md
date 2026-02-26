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

# SQL查询（返回包含20个完整字段的原始数据数组）
node -e "const s = require('./index.js'); (async () => { console.log(await s.executeSiyuanQuery('SELECT * FROM blocks WHERE type=\\\"d\\\" LIMIT 10')); })();"

# 查询反向链接（哪些笔记引用了某个块）
node -e "const s = require('./index.js'); (async () => { console.log(await s.getBacklinks('块ID')); })();"

# 查询块的属性（书签、优先级等自定义属性）
node -e "const s = require('./index.js'); (async () => { console.log(await s.getBlockAttributes('块ID')); })();"

# 查询文档的资源文件（图片、附件等）
node -e "const s = require('./index.js'); (async () => { console.log(await s.getDocumentAssets('文档ID')); })();"
```

### 块类型参数

`h`-标题 `p`-段落 `d`-文档 `l`-列表 `c`-代码 `t`-表格 `b`-引用

### ⚠️ 限制

不要使用 `cwd` 参数、不要创建临时文件、不要使用 `cd` 命令

### 输入限制

- **搜索关键词不能为空**
- **SQL 查询只允许 SELECT 语句**（禁止 INSERT/UPDATE/DELETE/DROP 等）
- **页码范围**：1-1000
- **块类型必须是有效代码**：d, h, p, l, c, t, b

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

## 数据表参考

### blocks 表（核心表）

**完整字段列表（20个字段）**：

- `id`: 块ID
- `type`: 块类型（d/h/p/l/c/t/b/av/widget/i/iframe/m/html/video/query_embed/s/tb）
- `subtype`: 子类型
- `content`: 纯文本内容
- `markdown`: Markdown文本
- `hpath`: 人类可读路径
- `created`: 创建时间 (YYYYMMDDHHmmss)
- `updated`: 更新时间
- `root_id`: 所属文档ID
- `parent_id`: 父块ID
- `box`: 笔记本ID
- `name`: 块名称
- `alias`: 别名（逗号分隔）
- `memo`: 备注
- `tag`: 标签（井号分隔）
- `fcontent`: 完整内容（包含子块）
- `hash`: 块哈希值
- `path`: 块路径
- `ial`: 内置属性链接
- `sort`: 排序号

**支持的块类型（17种）**：
- d: 文档 | h: 标题 | p: 段落 | l: 列表
- c: 代码块 | t: 表格 | b: 引用 | s: 超级块
- av: 属性视图 | widget: 小组件 | i: 内嵌框架
- iframe: 内嵌框架 | m: 数学公式 | html: HTML块
- video: 视频 | query_embed: 嵌入查询 | tb: 无序列表

### refs 表（引用关系表）

- `id`: 引用ID
- `def_block_id`: 被引用的块ID（定义块）
- `block_id`: 引用块的ID
- `type`: 引用类型
- `path`: 路径

**使用场景**：
- 查询反向链接："哪些笔记引用了这篇文章？"
- 查询引用网络："显示块之间的关联关系"

**SQL 示例**：
```sql
-- 查询引用某个块的所有块
SELECT b.* FROM blocks b
INNER JOIN refs r ON b.id = r.block_id
WHERE r.def_block_id = '目标块ID'
```

### attributes 表（自定义属性表）

- `id`: 属性ID
- `name`: 属性名
- `value`: 属性值
- `type`: 属性类型
- `block_id`: 所属块ID
- `root_id`: 所属文档ID

**使用场景**：
- 查询书签："列出所有书签"
- 按属性筛选："查找优先级为 high 的任务"
- 自定义元数据："查询所有带有 status: archived 的笔记"

**SQL 示例**：
```sql
-- 查询特定属性的所有块
SELECT b.*, a.name, a.value
FROM blocks b
INNER JOIN attributes a ON b.id = a.block_id
WHERE a.name = 'priority' AND a.value = 'high'
```

### assets 表（资源文件表）

- `id`: 资源ID
- `path`: 资源路径
- `box`: 笔记本ID
- `doc_id`: 所属文档ID
- `name`: 文件名
- `ext`: 扩展名
- `size`: 文件大小（字节）
- `created`: 创建时间

**使用场景**：
- 资源文件管理："列出所有图片文件"
- 大文件检测："查找超过 10MB 的附件"
- 文件类型统计："统计各类型文件数量"

**SQL 示例**：
```sql
-- 查询某个文档的所有图片
SELECT * FROM assets
WHERE doc_id = '文档ID' AND ext IN ('png', 'jpg', 'jpeg', 'gif')
ORDER BY size DESC
```

---

## SQL 查询示例

### 基础查询

```sql
-- 查询段落块
SELECT * FROM blocks WHERE type='p' AND content LIKE '%关键词%'

-- 组合查询（多个关键词）
SELECT * FROM blocks WHERE content LIKE '%关键词1%' OR content LIKE '%关键词2%'

-- 查询最近7天
SELECT * FROM blocks WHERE updated > strftime('%Y%m%d%H%M%S', datetime('now', '-7 day'))
```

### 跨表 JOIN 查询

```sql
-- 查询带有特定属性的块
SELECT b.id, b.content, a.name, a.value
FROM blocks b
INNER JOIN attributes a ON b.id = a.block_id
WHERE a.name = 'bookmark'

-- 查询引用关系
SELECT b1.content AS 引用块, b2.content AS 被引用块
FROM blocks b1
INNER JOIN refs r ON b1.id = r.block_id
INNER JOIN blocks b2 ON r.def_block_id = b2.id

-- 三表查询（块+属性+引用）
SELECT b.id, b.type, a.name AS 属性名, r.def_block_id AS 引用块
FROM blocks b
LEFT JOIN attributes a ON b.id = a.block_id
LEFT JOIN refs r ON b.id = r.block_id
WHERE b.type = 'd'
```

### 高级查询

```sql
-- 查询孤立块（未被引用的文档）
SELECT * FROM blocks
WHERE type = 'd'
AND id NOT IN (SELECT def_block_id FROM refs)

-- 查询大型资源文件
SELECT * FROM assets WHERE size > 10485760 ORDER BY size DESC

-- 按标签分组统计
SELECT tag, COUNT(*) as count FROM blocks
WHERE tag IS NOT NULL AND tag != ''
GROUP BY tag
```

