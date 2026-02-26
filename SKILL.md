---
name: siyuan-notes
description: 思源笔记查询工具，如果用户的请求涉及查找、检索、浏览他们的笔记内容，就应该使用这个技能，例如:查询我的xxx
---

## 📖 使用方式

本工具支持两种使用方式：

### 方式一：命令行调用（人类用户）

```bash
# 搜索笔记
node index.js search --keyword "关键词" [--type <类型>] [--page <页码>] [--limit <数量>]

# 执行SQL查询
node index.js sql --query "SELECT * FROM blocks LIMIT 10"

# 简写形式
node index.js search -k "React" -t h -l 10
node index.js sql -q "SELECT * FROM blocks WHERE type='d'"
```

**参数说明：**
- `--keyword, -k`: 搜索关键词（必需）
- `--type, -t`: 块类型过滤 (d/h/p/l/c/t/b/av)，可选
- `--page, -p`: 页码，默认 1
- `--limit, -l`: 返回数量，默认 20
- `--query, -q`: SQL语句

**兼容旧格式：**
```bash
node index.js search "关键词" [类型] [页码]
node index.js sql "SELECT语句"
```

### 方式二：JavaScript 函数调用（AI Agent 智能体）

通过编程方式调用，详见下方"智能体决策指南"。

---

## 🤖 智能体决策指南

**当用户询问笔记内容时，按以下优先级选择函数：**

### 第一选择：全文搜索（最常用）

```javascript
searchNotes(keyword, limit, blockType, page)
```

**用户问题特征：**
- 搜索关键词/内容："查找包含'xxx'的笔记"
- 浏览内容："显示我的xxx笔记"
- 按类型筛选："只看标题/文档/代码块"
- 分页浏览："下一页"、"更多结果"

**返回格式：** 格式化字符串（直接展示给用户）

**示例：**
```javascript
// 用户："搜索人工智能相关笔记"
await searchNotes('人工智能', 20)

// 用户："只看标题，搜索React"
await searchNotes('React', 20, 'h')

// 用户："第2页"
await searchNotes('关键词', 20, null, 2)
```

---

### 第二选择：反向链接查询

```javascript
getBacklinks(blockId)
```

**用户问题特征：**
- 引用关系："哪些笔记引用了xxx？"
- 反向链接："谁链接到这篇文章？"
- 关联发现："和这个笔记相关的内容"

**返回格式：** 对象数组（需要处理）

**示例：**
```javascript
// 用户："哪些笔记引用了'Python基础教程'？"
// 先搜索获取 blockId，再查询反向链接
const results = await searchNotes('Python基础教程', 1)
const blockId = results.match(/(\d{14}-\w{7})/)?.[1]
const backlinks = await getBacklinks(blockId)
```

---

### 第三选择：属性查询

```javascript
getBlockAttributes(blockId)
```

**用户问题特征：**
- 书签查询："列出我的书签"
- 优先级筛选："高优先级的任务"
- 自定义属性查询："带有xxx标签的笔记"

**返回格式：** 键值对对象 `{ name: value }`

**示例：**
```javascript
// 用户："这个块有什么属性？"
const attrs = await getBlockAttributes('20220622113712-4ow77jb')
// 返回: { "bookmark": "重要", "priority": "high" }
```

---

### 第四选择：资源文件查询

```javascript
getDocumentAssets(docId)
```

**用户问题特征：**
- 附件管理："这个文档有哪些图片？"
- 资源列表："所有PDF文件"
- 大小筛选："超过10MB的文件"

**返回格式：** 对象数组

---

### 第五选择：SQL 查询（高级）

```javascript
executeSiyuanQuery(sql)
```

**用户问题特征：**
- 复杂条件：多个AND/OR组合
- 跨表查询：关联多个表
- 精确筛选：基于特定字段值
- 时间范围：特定时间段

**返回格式：** 对象数组（包含20个完整字段）

**示例：**
```javascript
// 用户："最近7天修改的文档"
await executeSiyuanQuery(`
  SELECT * FROM blocks
  WHERE type = 'd'
  AND updated > strftime('%Y%m%d%H%M%S', datetime('now', '-7 day'))
`)

// 用户："带有'important'标签的任务"
await executeSiyuanQuery(`
  SELECT * FROM blocks
  WHERE tag LIKE '%important%'
  AND content LIKE '%[]()%'
`)
```

---

## 📋 用户问题 → 函数映射表

| 用户问题类型 | 使用函数 | 关键参数 |
|------------|---------|---------|
| "搜索/查找/查询xxx" | `searchNotes` | keyword |
| "只看标题/文档/代码" | `searchNotes` | blockType |
| "哪些笔记引用了xxx" | `getBacklinks` | blockId |
| "这个笔记有什么属性/标签" | `getBlockAttributes` | blockId |
| "这个文档有哪些图片/附件" | `getDocumentAssets` | docId |
| "最近X天的笔记" | `executeSiyuanQuery` | SQL with time filter |
| "带有xxx标签的笔记" | `executeSiyuanQuery` | SQL with tag filter |
| "xxx相关的内容" | `searchNotes` | 尝试多关键词 |
| "我的书签/收藏" | `executeSiyuanQuery` | JOIN attributes |
| "未完成的任务" | `executeSiyuanQuery` | content LIKE '%[]()%' |

---

## ⚡ 函数快速参考

### searchNotes(keyword, limit, blockType, page)

**用途：** 全文搜索，支持中文分词，**最常用**

**参数：**
- `keyword`: 搜索关键词（必需）
- `limit`: 返回数量，默认 20
- `blockType`: 块类型 (d/h/p/l/c/t/b/av)，null 表示全部
- `page`: 页码，默认 1

**返回：** 格式化字符串，可直接展示

**块类型：**
- `d`: 文档, `h`: 标题, `p`: 段落
- `l`: 列表, `c`: 代码块, `t`: 表格, `b`: 引用
- `av`: 属性视图

---

### getBacklinks(blockId)

**用途：** 查询引用某个块的所有块（反向链接）

**参数：**
- `blockId`: 被引用的块ID（必需）

**返回：** 对象数组，每个包含块信息

---

### getOutgoingLinks(blockId)

**用途：** 查询某个块引用的所有块（正向链接）

**参数：**
- `blockId`: 块ID（必需）

**返回：** 对象数组

---

### getBlockAttributes(blockId)

**用途：** 查询块的自定义属性

**参数：**
- `blockId`: 块ID（必需）

**返回：** 键值对对象 `{ name: value }`

---

### getDocumentAssets(docId)

**用途：** 查询文档的资源文件

**参数：**
- `docId`: 文档ID（必需）

**返回：** 对象数组

---

### executeSiyuanQuery(sql)

**用途：** 执行 SQL 查询，返回完整字段数据

**参数：**
- `sql`: SELECT 查询语句（必需）

**返回：** 对象数组，每个包含20个字段

**字段列表：**
```
核心: id, type, subtype, content, markdown, hpath
时间: created, updated
层级: root_id, parent_id, box
扩展: name, alias, memo, tag, fcontent, hash, path, ial, sort
```

---

## 💬 使用场景示例

### 场景 1: 内容搜索

**用户：** "搜索我关于人工智能的所有笔记"

**智能体流程：**
```javascript
// 1. 直接全文搜索
const results = await searchNotes('人工智能', 50)

// 2. 如果结果太多，提示用户缩小范围
// 3. 如果没有结果，尝试同义词
const synonyms = ['AI', '机器学习', '深度学习']
for (const keyword of synonyms) {
  const results = await searchNotes(keyword, 20)
  if (results.includes('找到')) break
}
```

---

### 场景 2: 反向链接查询

**用户：** "哪些笔记引用了'React教程'？"

**智能体流程：**
```javascript
// 1. 先搜索获取目标笔记的 blockId
const searchResults = await searchNotes('React教程', 1)
const blockIdMatch = searchResults.match(/(\d{14}-\w{7})/)

if (!blockIdMatch) {
  return '未找到"React教程"，请提供确切标题'
}

const blockId = blockIdMatch[1]

// 2. 查询反向链接
const backlinks = await getBacklinks(blockId)

// 3. 格式化结果
if (backlinks.length === 0) {
  return '没有笔记引用"React教程"'
} else {
  return `找到 ${backlinks.length} 条引用:\n` +
    backlinks.map(b => `📄 ${b.hpath}: ${b.content.substring(0, 50)}`).join('\n')
}
```

---

### 场景 3: 属性查询

**用户：** "列出所有标记为重要的笔记"

**智能体流程：**
```javascript
// 方式 1: 使用 SQL 直接查询（推荐）
const results = await executeSiyuanQuery(`
  SELECT b.* FROM blocks b
  INNER JOIN attributes a ON b.id = a.block_id
  WHERE a.name = 'bookmark' AND a.value LIKE '%重要%'
  LIMIT 50
`)

// 方式 2: 使用搜索 + 属性验证
const searchResults = await searchNotes('重要', 50)
// 然后逐个验证属性（较慢）
```

---

### 场景 4: 任务查询

**用户：** "显示所有未完成的任务"

**智能体流程：**
```javascript
const results = await executeSiyuanQuery(`
  SELECT * FROM blocks
  WHERE type = 'l'
  AND content LIKE '%[ ]%'
  ORDER BY updated DESC
  LIMIT 100
`)

// 格式化输出
results.forEach(task => {
  console.log(`[ ] ${task.content}`)
  console.log(`   📍 ${task.hpath}`)
})
```

---

### 场景 5: 时间范围查询

**用户：** "最近一周我写了什么？"

**智能体流程：**
```javascript
const results = await executeSiyuanQuery(`
  SELECT * FROM blocks
  WHERE updated > strftime('%Y%m%d%H%M%S', datetime('now', '-7 day'))
  ORDER BY updated DESC
  LIMIT 100
`)

// 按文档分组
const byDoc = {}
results.forEach(block => {
  const docId = block.root_id
  if (!byDoc[docId]) byDoc[docId] = []
  byDoc[docId].push(block)
})

// 输出
Object.entries(byDoc).forEach(([docId, blocks]) => {
  console.log(`📄 ${blocks[0].hpath}`)
  console.log(`   新增/修改 ${blocks.length} 个块`)
})
```

---

### 场景 6: 资源文件查询

**用户：** "这个文档有哪些图片？"

**智能体流程：**
```javascript
// 1. 先获取文档ID
const docs = await executeSiyuanQuery(`
  SELECT id, hpath FROM blocks
  WHERE hpath LIKE '%用户提到的关键词%'
  LIMIT 1
`)

if (docs.length === 0) {
  return '未找到该文档'
}

// 2. 查询资源文件
const assets = await getDocumentAssets(docs[0].id)

// 3. 筛选图片
const images = assets.filter(a =>
  ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(a.ext)
)

if (images.length === 0) {
  return '该文档没有图片'
} else {
  return `找到 ${images.length} 张图片:\n` +
    images.map(img => `🖼️ ${img.name} (${(img.size/1024).toFixed(1)}KB)`).join('\n')
}
```

---

## 🔄 多轮搜索策略

当用户的问题比较模糊时，应该：

1. **第一轮：** 使用用户原关键词搜索
2. **如果结果为空：** 尝试同义词/相关词
3. **如果结果太多：** 添加类型过滤或时间范围
4. **如果用户不满意：** 询问更多细节

### 示例对话流程

**用户：** "搜索我的笔记"

**智能体：**
```javascript
// 第1轮：使用原关键词
let results = await searchNotes('笔记', 20)

// 如果结果太多，提示缩小范围
if (results.includes('找到 1000+ 条结果')) {
  return "结果太多，请告诉我:\n" +
    "1. 搜索什么主题？\n" +
    "2. 只看某种类型（标题/文档/代码）？\n" +
    "3. 时间范围（最近一周/一个月）？"
}

// 如果结果为空，尝试扩展
if (results.includes('未找到')) {
  // 尝试常见内容
  const commonTopics = ['学习', '工作', '笔记', '总结']
  for (const topic of commonTopics) {
    results = await searchNotes(topic, 20)
    if (results.includes('找到')) {
      return `未找到"笔记"，但找到关于"${topic}"的${results.match(/找到 (\d+) 条/)?.[1]}条结果`
    }
  }
}
```

---

## 🎯 高级查询模式

### 组合查询

```javascript
// 搜索最近更新的，并且带有特定标签的文档
await executeSiyuanQuery(`
  SELECT b.* FROM blocks b
  INNER JOIN attributes a ON b.id = a.block_id
  WHERE b.type = 'd'
  AND a.name = 'tag'
  AND a.value = '前端'
  AND b.updated > strftime('%Y%m%d%H%M%S', datetime('now', '-30 day'))
`)
```

### 关联查询

```javascript
// 查询某个文档及其所有引用关系
await executeSiyuanQuery(`
  SELECT
    b.id,
    b.content,
    r.def_block_id AS 引用的块,
    a.name AS 属性名,
    a.value AS 属性值
  FROM blocks b
  LEFT JOIN refs r ON b.id = r.block_id
  LEFT JOIN attributes a ON b.id = a.block_id
  WHERE b.root_id = '文档ID'
`)
```

### 聚合查询

```javascript
// 统计各类型块的数量
await executeSiyuanQuery(`
  SELECT type, COUNT(*) as count
  FROM blocks
  GROUP BY type
  ORDER BY count DESC
`)

// 查找孤立文档（未被引用）
await executeSiyuanQuery(`
  SELECT * FROM blocks
  WHERE type = 'd'
  AND id NOT IN (SELECT def_block_id FROM refs)
  ORDER BY updated DESC
`)
```

---

## 🛡️ 输入限制

- **搜索关键词不能为空**
- **SQL 只允许 SELECT**（禁止 INSERT/UPDATE/DELETE/DROP）
- **页码范围**：1-1000
- **块类型**：d, h, p, l, c, t, b, av

---

## ⚠️ 注意事项

1. **优先使用 searchNotes**：大多数情况下全文搜索足够
2. **注意 blockId 获取**：getBacklinks/getBlockAttributes 需要 blockId，先用 search 或 executeSiyuanQuery 获取
3. **合理设置 limit**：避免返回过多数据
4. **处理空结果**：所有查询都可能返回空数组/空字符串
5. **SQL 注入防护**：executeSiyuanQuery 只允许 SELECT，已做安全验证

---

## 📚 数据表参考（技术细节）

### blocks 表字段

```
核心: id, type, subtype, content, markdown, hpath
时间: created, updated
层级: root_id, parent_id, box
扩展: name, alias, memo, tag, fcontent, hash, path, ial, sort
```

### 支持的块类型（18种）

```
d: 文档      | h: 标题     | p: 段落
l: 列表      | c: 代码块   | t: 表格
b: 引用      | s: 超级块   | av: 属性视图
widget: 小组件 | i: 内嵌   | iframe: 内嵌框架
m: 数学公式  | html: HTML  | video: 视频
query_embed: 嵌入 | tb: 无序列表
```

**搜索支持的类型**：d, h, p, l, c, t, b, av（最常用）

### refs 表（引用关系）

```
- def_block_id: 被引用的块ID
- block_id: 引用块的ID
- 用途：查询反向链接、引用网络
```

### attributes 表（自定义属性）

```
- name: 属性名（bookmark, priority, tag等）
- value: 属性值
- 用途：书签、优先级、自定义标签
```

### assets 表（资源文件）

```
- doc_id: 所属文档ID
- name: 文件名
- ext: 扩展名
- size: 文件大小
- 用途：图片、视频、附件管理
```
