# 思源笔记技能增强实施计划 (v1.2.0)

> **版本**: 1.2.0
> **日期**: 2026-02-26
> **状态**: 待实施

---

## 目录

1. [目标概述](#目标概述)
2. [核心任务分析](#核心任务分析)
3. [待确认问题](#待确认问题)
4. [实施计划](#实施计划)
5. [技术权衡](#技术权衡)
6. [测试策略](#测试策略)
7. [风险管理](#风险管理)

---

## 目标概述

本次升级旨在补全对思源笔记数据库核心功能的支持，从当前的 **仅 blocks 表** 扩展到 **6 张核心表**，并完善块类型映射，实现更全面的笔记数据查询能力。

### 升级范围

| 功能模块 | 当前状态 | 目标状态 | 优先级 |
|---------|---------|---------|--------|
| blocks 表 | 部分字段（11个） | 完整字段（20个） | P0 |
| refs 表查询 | ❌ 不支持 | ✅ 支持双向引用查询 | P0 |
| attributes 表 | ❌ 不支持 | ✅ 支持自定义属性 | P0 |
| AV 数据库视图 | ❌ 不支持 | ✅ 基础查询支持 | P1 |
| assets 资源表 | ❌ 不支持 | ✅ 资源文件管理 | P1 |
| 块类型映射 | 8 种类型 | 17 种完整类型 | P0 |

---

## 核心任务分析

### 任务 1: 添加 refs 表查询支持 ⭐

**功能目标**: 实现块之间的引用关系查询，支持反向链接和双向引用发现。

#### refs 表结构（官方文档）

```sql
CREATE TABLE refs (
    id TEXT PRIMARY KEY,          -- 引用ID
    def_block_id TEXT,            -- 被引用的块ID（定义块）
    block_id TEXT,                -- 引用块的ID
    type INTEGER,                 -- 引用类型
    path TEXT                     -- 路径
);
```

#### 应用场景

1. **反向链接查询** - "哪些笔记引用了这篇文章？"
2. **引用关系图** - "显示某个块的引用网络"
3. **死链检测** - "查找未被引用的孤立块"
4. **知识图谱构建** - 构建笔记间的关联关系

#### 实施方案

**方案 A: 新增独立查询函数**
```javascript
/**
 * 查询引用某个块的所有块（反向链接）
 * @param {string} blockId - 被引用的块ID
 * @returns {Promise<Array>} 引用该块的块列表
 */
async function getBacklinks(blockId) {
    const sql = `
        SELECT b.id, b.type, b.content, b.hpath, b.created
        FROM blocks b
        INNER JOIN refs r ON b.id = r.block_id
        WHERE r.def_block_id = ?
        ORDER BY b.created DESC
    `;
    return executeSiyuanQuery(sql.replace('?', `'${blockId}'`));
}
```

**方案 B: 扩展 executeSiyuanQuery 返回字段**
- 允许用户通过 SQL 直接 JOIN refs 表
- 在文档中提供 refs 表查询示例

**推荐**: **方案 A**（独立函数）+ **方案 B**（文档示例）

#### 待确认问题

<details>
<summary>问题 1.1: 引用类型 (type) 字段的含义和处理方式？</summary>

思源官方文档中 `refs.type` 是 INTEGER 类型，但未说明具体值的含义。

**选项**:
- A. 忽略 type 字段，返回原始值让用户自行判断
- B. 研究思源源码，映射 type 值到语义化标签（如"嵌入引用"、"动态查询"等）
- C. 先实现基础查询，后续添加 type 映射

</details>

<details>
<summary>问题 1.2: 是否需要提供"双向引用"的高级查询？</summary>

例如：查询块 A 和块 B 之间的相互引用关系。

**选项**:
- A. 是，新增 `getBidirectionalLinks(blockId1, blockId2)` 函数
- B. 否，用户可以通过 SQL 组合查询实现
- C. 先实现基础查询，根据需求再添加

</details>

---

### 任务 2: 补全 blocks 表字段 ⭐

**功能目标**: 将当前返回的 11 个字段扩展到 20 个完整字段。

#### 缺失字段清单

| 字段名 | 类型 | 说明 | 是否必需 |
|-------|------|------|---------|
| name | TEXT | 块名称 | ✅ 是 |
| alias | TEXT | 别名（逗号分隔） | ✅ 是 |
| memo | TEXT | 备注 | ✅ 是 |
| tag | TEXT | 标签（井号分隔） | ✅ 是 |
| fcontent | TEXT | 完整内容（包含子块） | ❌ 否 |
| hash | TEXT | 块哈希值 | ❌ 否 |
| path | TEXT | 块路径 | ✅ 是 |
| ial | TEXT | 内置属性链接 (Inline Attribute Link) | ❌ 否 |
| sort | INTEGER | 排序号 | ❌ 否 |

#### 当前返回结构（index.js:580-592）

```javascript
return data.map(item => ({
    id: item.id,
    type: item.type,
    subtype: item.subtype,
    content: item.content,
    markdown: item.markdown,
    hpath: item.hpath,
    created: item.created,
    updated: item.updated,
    root_id: item.root_id,
    parent_id: item.parent_id,
    box: item.box
}));
```

#### 实施方案

**方案 A: 全量补全（推荐）**
```javascript
return data.map(item => ({
    // 原有字段
    id: item.id,
    type: item.type,
    subtype: item.subtype,
    content: item.content,
    markdown: item.markdown,
    hpath: item.hpath,
    created: item.created,
    updated: item.updated,
    root_id: item.root_id,
    parent_id: item.parent_id,
    box: item.box,
    // 新增字段
    name: item.name || '',
    alias: item.alias || '',
    memo: item.memo || '',
    tag: item.tag || '',
    path: item.path || '',
    hash: item.hash || '',
    ial: item.ial || '',
    sort: item.sort || 0
}));
```

**优点**:
- 完整支持所有字段
- 用户可按需使用

**缺点**:
- 增加内存占用（约 40%）
- 部分 API 返回数据可能不包含新字段（需容错处理）

**方案 B: 按需返回**
- 添加 `fields` 参数，用户指定需要的字段
- 默认只返回核心字段

**缺点**:
- 增加 API 复杂度
- 违背"减少上下文消耗"的设计原则

**推荐**: **方案 A**（全量补全 + 空值容错）

#### 待确认问题

<details>
<summary>问题 2.1: fcontent 字段是否应该包含？它可能包含子块的完整内容，导致数据量过大。</summary>

**选项**:
- A. 包含 fcontent，由用户决定是否使用
- B. 默认不返回 fcontent，提供单独的 `getBlockWithFullContent()` 函数
- C. 添加 `includeFullContent` 参数控制

</details>

<details>
<summary>问题 2.2: 如何处理 alias 字段的解析？alias 是逗号分隔的字符串，是否应该自动解析为数组？</summary>

**选项**:
- A. 保持原始字符串，由用户自行 split(',')
- B. 自动解析为数组 `item.alias ? item.alias.split(',') : []`
- C. 同时提供原始字符串和解析后的数组（aliasRaw, aliasArray）

</details>

---

### 任务 3: 添加 attributes 表支持 ⭐

**功能目标**: 支持查询块的自定义属性（如书签、优先级、状态等）。

#### attributes 表结构（官方文档）

```sql
CREATE TABLE attributes (
    id TEXT PRIMARY KEY,          -- 属性ID
    name TEXT,                    -- 属性名
    value TEXT,                   -- 属性值
    type INTEGER,                 -- 属性类型
    block_id TEXT,                -- 所属块ID
    root_id TEXT                  -- 所属文档ID
);
```

#### 应用场景

1. **书签查询** - "列出所有书签"
2. **属性筛选** - "查找优先级为 high 的任务"
3. **自定义元数据** - "查询所有带有 `status: archived` 的笔记"

#### 实施方案

**新增查询函数**:

```javascript
/**
 * 查询块的属性
 * @param {string} blockId - 块ID
 * @returns {Promise<Object>} 属性键值对对象
 */
async function getBlockAttributes(blockId) {
    const sql = `
        SELECT name, value
        FROM attributes
        WHERE block_id = '${blockId}'
    `;
    const results = await executeSiyuanQuery(sql);
    // 转换为 { name: value } 格式
    return results.reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
    }, {});
}
```

**返回格式示例**:
```javascript
{
    "bookmark": "书签名称",
    "priority": "high",
    "status": "in-progress",
    "custom-field": "自定义值"
}
```

#### 待确认问题

<details>
<summary>问题 3.1: type 字段如何处理？attributes.type 是 INTEGER，官方文档未说明含义。</summary>

**选项**:
- A. 忽略 type，只返回 name 和 value
- B. 返回原始 type 值，让用户自行判断
- C. 研究思源源码，添加 type 映射

</details>

<details>
<summary>问题 3.2: 是否需要提供"按属性筛选块"的高级函数？</summary>

例如：`findBlocksByAttribute('priority', 'high')`

**选项**:
- A. 是，提供常用筛选函数（priority, status, bookmark 等）
- B. 否，用户可以通过 SQL 组合查询实现
- C. 提供通用函数 `findBlocksByAttribute(name, value)`

</details>

---

### 任务 4: 添加数据库视图（AV）基础支持

**功能目标**: 支持思源的属性视图（Attribute View）块，即数据库表格功能。

#### AV 块特点

- **块类型**: `NodeAttributeView` (type='av')
- **特殊结构**: 包含列定义、行数据、视图配置
- **数据存储**: 存储在 blocks.content 的 JSON 格式中

#### 实施方案

**方案 A: 仅识别类型**
- 在块类型映射中添加 `'NodeAttributeView': '属性视图'`
- 返回原始 JSON 内容，由用户自行解析

**方案 B: 提供解析函数**
```javascript
/**
 * 解析属性视图块
 * @param {string} avBlockId - 属性视图块ID
 * @returns {Promise<Object>} 解析后的视图数据
 */
async function getAttributeViewData(avBlockId) {
    const sql = `SELECT * FROM blocks WHERE id = '${avBlockId}'`;
    const [block] = await executeSiyuanQuery(sql);

    if (!block || block.type !== 'av') {
        throw new Error('不是属性视图块');
    }

    // 解析 content 中的 JSON
    const viewData = JSON.parse(block.content);
    return {
        columns: viewData.columns,   // 列定义
        rows: viewData.rows,         // 行数据
        filters: viewData.filters    // 筛选条件
    };
}
```

**推荐**: **方案 A**（仅识别）+ **文档示例**（提供解析示例代码）

#### 待确认问题

<details>
<summary>问题 4.1: 是否需要提供 AV 数据的查询功能（如按单元格筛选）？</summary>

**选项**:
- A. 是，实现完整的 AV 查询支持（复杂度高）
- B. 否，只返回原始 JSON，由用户自行解析
- C. 提供基础的解析函数，不实现查询逻辑

</details>

---

### 任务 5: 添加 assets 表查询

**功能目标**: 支持查询笔记中的资源文件（图片、视频、附件等）。

#### assets 表结构（官方文档）

```sql
CREATE TABLE assets (
    id TEXT PRIMARY KEY,          -- 资源ID
    path TEXT,                    -- 资源路径
    box TEXT,                     -- 笔记本ID
    doc_id TEXT,                  -- 所属文档ID
    name TEXT,                    -- 文件名
    ext TEXT,                     -- 扩展名
    size INTEGER,                 -- 文件大小（字节）
    created TEXT                  -- 创建时间
);
```

#### 应用场景

1. **资源文件管理** - "列出所有图片文件"
2. **大文件检测** - "查找超过 10MB 的附件"
3. **文件类型统计** - "统计各类型文件数量"
4. **未使用资源清理** - "查找未被引用的资源文件"

#### 实施方案

**新增查询函数**:

```javascript
/**
 * 查询文档的所有资源文件
 * @param {string} docId - 文档ID
 * @returns {Promise<Array>} 资源文件列表
 */
async function getDocumentAssets(docId) {
    const sql = `
        SELECT id, name, ext, size, path, created
        FROM assets
        WHERE doc_id = '${docId}'
        ORDER BY created DESC
    `;
    return executeSiyuanQuery(sql);
}

/**
 * 按扩展名查询资源文件
 * @param {string} extension - 扩展名（如 'png', 'jpg'）
 * @returns {Promise<Array>} 资源文件列表
 */
async function getAssetsByExtension(extension) {
    const sql = `
        SELECT * FROM assets
        WHERE ext = '${extension}'
        ORDER BY size DESC
    `;
    return executeSiyuanQuery(sql);
}
```

#### 待确认问题

<details>
<summary>问题 5.1: 是否需要提供"查找未使用资源"的功能？</summary>

这需要 JOIN assets 和 blocks 表，检测资源路径是否在块内容中被引用。

**选项**:
- A. 是，提供 `findUnusedAssets()` 函数
- B. 否，功能复杂度高，用户可通过 SQL 实现
- C. 提供文档示例 SQL，不封装为函数

</details>

---

### 任务 6: 完善块类型映射 ⭐

**功能目标**: 支持思源笔记所有 17 种块类型。

#### 当前映射（index.js:443-452）

```javascript
const typeMap = {
    'NodeDocument': '文档',
    'NodeHeading': '标题',
    'NodeParagraph': '段落',
    'NodeCodeBlock': '代码',
    'NodeTable': '表格',
    'NodeList': '列表',
    'NodeBlockquote': '引用',
    'NodeSuperBlock': '超级块'
};
```

#### 缺失类型（9 种）

| 类型 | 中文名称 | 优先级 |
|------|---------|--------|
| NodeAudioBlock | 音频块 | P1 |
| NodeAttributeView | 属性视图 | P0 |
| NodeHTMLBlock | HTML 块 | P1 |
| NodeIFrame | 内嵌框架 | P1 |
| NodeListItem | 列表项 | P0 |
| NodeMathBlock | 数学公式块 | P1 |
| NodeQueryEmbed | 嵌入查询 | P2 |
| NodeWidget | 小组件 | P1 |
| NodeVideoBlock | 视频块 | P1 |

#### 完整映射表

```javascript
const COMPLETE_TYPE_MAP = {
    'NodeDocument': '文档',
    'NodeHeading': '标题',
    'NodeParagraph': '段落',
    'NodeCodeBlock': '代码块',
    'NodeTable': '表格',
    'NodeList': '列表',
    'NodeListItem': '列表项',
    'NodeBlockquote': '引用',
    'NodeSuperBlock': '超级块',
    'NodeAudioBlock': '音频',
    'NodeAttributeView': '属性视图',
    'NodeHTMLBlock': 'HTML块',
    'NodeIFrame': '内嵌框架',
    'NodeMathBlock': '数学公式',
    'NodeQueryEmbed': '嵌入查询',
    'NodeWidget': '小组件',
    'NodeVideoBlock': '视频'
};
```

#### 实施方案

**直接替换 typeMap**，将完整映射应用到：
- `searchNotes()` 函数（index.js:443）
- 文档示例（SKILL.md）

#### 待确认问题

<details>
<summary>问题 6.1: 是否需要为新增类型添加块类型参数（如 'a' 代表音频，'v' 代表视频）？</summary>

当前 searchNotes() 只支持 `d/h/p/l/c/t/b` 7 个类型参数。

**选项**:
- A. 是，扩展到 17 个类型参数（复杂度高）
- B. 否，用户应使用全文搜索或 SQL 查询特定类型
- C. 只添加常用类型（a, v, m, i），其他通过 SQL 查询

</details>

---

## 实施计划

### 阶段 0: 环境准备 ⏱️ 5 分钟

- [ ] 创建备份 `.backup.20260226-v1.2/`
- [ ] 验证 Git 工作区干净
- [ ] 确认思源笔记运行正常

### 阶段 1: 补全 blocks 表字段 ⏱️ 30 分钟

- [ ] 修改 `executeSiyuanQuery()` 返回结构（index.js:580-592）
- [ ] 添加 9 个新字段的映射
- [ ] 添加空值容错逻辑
- [ ] 编写单元测试（验证新字段返回）
- [ ] 更新 SKILL.md 文档示例

### 阶段 2: 完善块类型映射 ⏱️ 15 分钟

- [ ] 替换 `typeMap` 为完整映射（index.js:443）
- [ ] 更新 searchNotes() 中的块类型过滤逻辑（如需要）
- [ ] 更新 SKILL.md 中的块类型说明
- [ ] 编写单元测试（验证新类型识别）

### 阶段 3: 添加 refs 表查询支持 ⏱️ 45 分钟

- [ ] 新增 `getBacklinks(blockId)` 函数
- [ ] 新增 `getOutgoingLinks(blockId)` 函数（可选）
- [ ] 添加参数验证
- [ ] 编写单元测试
- [ ] 更新 SKILL.md 使用示例
- [ ] 更新 README.md 功能说明

### 阶段 4: 添加 attributes 表支持 ⏱️ 30 分钟

- [ ] 新增 `getBlockAttributes(blockId)` 函数
- [ ] 添加结果格式化（键值对对象）
- [ ] 编写单元测试
- [ ] 更新 SKILL.md 使用示例
- [ ] 添加常见属性查询示例（书签、优先级等）

### 阶段 5: 添加 AV 属性视图基础支持 ⏱️ 20 分钟

- [ ] 在 typeMap 中添加 'NodeAttributeView'
- [ ] 更新文档说明 AV 块的数据格式
- [ ] 提供 AV 解析示例代码（在 SKILL.md 中）
- [ ] 编写单元测试（验证类型识别）

### 阶段 6: 添加 assets 表查询 ⏱️ 30 分钟

- [ ] 新增 `getDocumentAssets(docId)` 函数
- [ ] 新增 `getAssetsByExtension(extension)` 函数（可选）
- [ ] 添加参数验证
- [ ] 编写单元测试
- [ ] 更新 SKILL.md 使用示例
- [ ] 添加资源管理查询示例

### 阶段 7: 集成测试 ⏱️ 30 分钟

- [ ] 编写集成测试（跨表 JOIN 查询）
- [ ] 测试所有新增函数
- [ ] 性能测试（大数据量查询）
- [ ] 验证错误处理

### 阶段 8: 文档更新 ⏱️ 30 分钟

- [ ] 更新 README.md（新增功能说明）
- [ ] 更新 SKILL.md（使用示例）
- [ ] 更新 CHANGELOG.md（v1.2.0 变更记录）
- [ ] 更新 research.md（实施记录）

### 阶段 9: 代码提交 ⏱️ 10 分钟

- [ ] Git add 修改的文件
- [ ] 编写详细的 commit message
- [ ] 推送到远程仓库（如需要）

**预计总耗时**: 约 3.5 小时

---

## 技术权衡

### 1. 破坏性变更处理

**问题**: 新增字段可能导致现有代码的返回数据结构变化。

**解决方案**:
- 使用空值容错：`item.name || ''` 而非 `item.name`
- 在 CHANGELOG.md 中明确说明
- 提供版本兼容性说明

### 2. 内存占用优化

**问题**: 全量返回字段增加约 40% 内存占用。

**权衡**:
- **选项 A**: 保持全量返回（牺牲内存换取完整性）
- **选项 B**: 提供可选参数 `includeFullFields`（增加复杂度）

**推荐**: **选项 A**，原因：
- Claude Code 上下文优化更重要（减少函数调用次数）
- 用户可按需选择字段（通过 SQL 指定）

### 3. 函数爆炸问题

**问题**: 每个功能都新增独立函数可能导致函数数量过多。

**解决方案**:
- 只添加 **高频使用** 的查询函数
- 其他复杂查询通过 **文档示例 SQL** 引导用户
- 保持 API 表面积最小化

**示例**:
```javascript
// ✅ 保留（高频）
getBacklinks(blockId)
getBlockAttributes(blockId)
getDocumentAssets(docId)

// ❌ 不保留（低频，用户可 SQL 实现）
getAssetsBySize(minSize, maxSize)
findBlocksByAttribute(name, value)
getUnusedAssets()
```

### 4. SQL 注入防护

**问题**: 新增函数可能引入 SQL 注入风险。

**防护措施**:
- 所有新增函数必须通过 `validateSQLQuery()` 验证
- 参数化查询或严格转义
- 编写安全测试用例

---

## 测试策略

### 单元测试

每个新增函数必须包含：

1. **正常流程测试**
   ```javascript
   // 测试 getBacklinks
   const links = await getBacklinks('block-id');
   assert(Array.isArray(links));
   ```

2. **参数验证测试**
   ```javascript
   // 测试空参数
   await assert.rejects(async () => {
       await getBacklinks('');
   }, ValidationError);
   ```

3. **边界条件测试**
   ```javascript
   // 测试不存在的块ID
   const links = await getBacklinks('non-existent-id');
   assert(links.length === 0);
   ```

4. **错误处理测试**
   ```javascript
   // 测试无效 SQL
   await assert.rejects(async () => {
       await getBacklinks("'; DROP TABLE refs; --");
   }, ValidationError);
   ```

### 集成测试

1. **跨表 JOIN 查询**
   ```sql
   -- 测试 blocks + attributes JOIN
   SELECT b.id, b.content, a.name, a.value
   FROM blocks b
   LEFT JOIN attributes a ON b.id = a.block_id
   WHERE b.type = 'd'
   ```

2. **多表关联查询**
   ```sql
   -- 测试 blocks + refs + assets 三表查询
   SELECT b.content, r.def_block_id, a.name
   FROM blocks b
   INNER JOIN refs r ON b.id = r.block_id
   INNER JOIN assets a ON b.root_id = a.doc_id
   ```

### 性能测试

- 测试大数据量查询（1000+ 条记录）
- 验证响应时间 < 2 秒
- 检查内存占用是否合理

---

## 风险管理

### 高风险项

1. **思源 API 变更**
   - **风险**: 官方修改表结构或字段名
   - **缓解**: 依赖官方文档，定期检查变更

2. **SQL 注入漏洞**
   - **风险**: 新增函数绕过 `validateSQLQuery()`
   - **缓解**: 代码审查 + 安全测试

3. **性能退化**
   - **风险**: 新增字段导致查询变慢
   - **缓解**: 性能基准测试

### 中风险项

1. **用户兼容性**
   - **风险**: 现有用户依赖旧版返回结构
   - **缓解**: 详细 CHANGELOG + 破坏性变更说明

2. **文档不完整**
   - **风险**: 用户不知道如何使用新功能
   - **缓解**: 提供丰富的使用示例

### 低风险项

1. **块类型名称变更**
   - **风险**: 思源修改内部类型名称
   - **缓解**: 使用完整的 typeMap，部分失效不影响其他类型

---

## 修改文件清单

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| index.js | 新增 6 个函数，补全 blocks 字段，完善 typeMap | P0 |
| SKILL.md | 新增使用示例，更新块类型说明 | P0 |
| README.md | 新增功能说明，更新支持查询类型 | P1 |
| CHANGELOG.md | 添加 v1.2.0 变更记录 | P0 |
| research.md | 更新实施记录 | P1 |

---

## 关键代码片段

### 1. 补全 blocks 表字段

```javascript
// index.js:580-592
return data.map(item => ({
    // 原有字段
    id: item.id,
    type: item.type,
    subtype: item.subtype,
    content: item.content,
    markdown: item.markdown,
    hpath: item.hpath,
    created: item.created,
    updated: item.updated,
    root_id: item.root_id,
    parent_id: item.parent_id,
    box: item.box,
    // 新增字段
    name: item.name || '',
    alias: item.alias || '',
    memo: item.memo || '',
    tag: item.tag || '',
    path: item.path || '',
    hash: item.hash || '',
    ial: item.ial || '',
    sort: item.sort || 0
}));
```

### 2. 完整块类型映射

```javascript
// index.js:443
const COMPLETE_TYPE_MAP = {
    'NodeDocument': '文档',
    'NodeHeading': '标题',
    'NodeParagraph': '段落',
    'NodeCodeBlock': '代码块',
    'NodeTable': '表格',
    'NodeList': '列表',
    'NodeListItem': '列表项',
    'NodeBlockquote': '引用',
    'NodeSuperBlock': '超级块',
    'NodeAudioBlock': '音频',
    'NodeAttributeView': '属性视图',
    'NodeHTMLBlock': 'HTML块',
    'NodeIFrame': '内嵌框架',
    'NodeMathBlock': '数学公式',
    'NodeQueryEmbed': '嵌入查询',
    'NodeWidget': '小组件',
    'NodeVideoBlock': '视频'
};
```

### 3. refs 表查询函数

```javascript
/**
 * 查询引用某个块的所有块（反向链接）
 * @param {string} blockId - 被引用的块ID
 * @returns {Promise<Array>} 引用该块的块列表
 */
async function getBacklinks(blockId) {
    if (!blockId || typeof blockId !== 'string' || blockId.trim().length === 0) {
        throw new ValidationError('块ID不能为空', 'blockId');
    }

    const sql = `
        SELECT b.id, b.type, b.subtype, b.content, b.markdown, b.hpath,
               b.created, b.updated, b.root_id, b.parent_id, b.box
        FROM blocks b
        INNER JOIN refs r ON b.id = r.block_id
        WHERE r.def_block_id = '${blockId.trim()}'
        ORDER BY b.updated DESC
    `;

    return executeSiyuanQuery(sql);
}
```

### 4. attributes 表查询函数

```javascript
/**
 * 查询块的属性
 * @param {string} blockId - 块ID
 * @returns {Promise<Object>} 属性键值对对象
 */
async function getBlockAttributes(blockId) {
    if (!blockId || typeof blockId !== 'string' || blockId.trim().length === 0) {
        throw new ValidationError('块ID不能为空', 'blockId');
    }

    const sql = `
        SELECT name, value
        FROM attributes
        WHERE block_id = '${blockId.trim()}'
    `;

    const results = await executeSiyuanQuery(sql);

    return results.reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
    }, {});
}
```

### 5. assets 表查询函数

```javascript
/**
 * 查询文档的所有资源文件
 * @param {string} docId - 文档ID
 * @returns {Promise<Array>} 资源文件列表
 */
async function getDocumentAssets(docId) {
    if (!docId || typeof docId !== 'string' || docId.trim().length === 0) {
        throw new ValidationError('文档ID不能为空', 'docId');
    }

    const sql = `
        SELECT id, name, ext, size, path, created, box
        FROM assets
        WHERE doc_id = '${docId.trim()}'
        ORDER BY created DESC
    `;

    return executeSiyuanQuery(sql);
}
```

---

## 注意事项

### 开发原则

1. **保持 API 简洁** - 只添加高频使用的函数
2. **优先文档示例** - 复杂查询通过 SQL 示例引导
3. **严格的错误处理** - 所有新增函数必须验证参数
4. **完整的测试覆盖** - 单元测试 + 集成测试
5. **详细的变更日志** - 记录所有破坏性变更

### 向后兼容性

- ✅ 保留 `executeSiyuanQuery()` 原有功能
- ✅ 保留 `searchNotes()` 原有参数
- ✅ 新增字段使用空值容错（`|| ''`）
- ⚠️ 返回数据结构变化（需在 CHANGELOG 说明）

### 安全性

- ✅ 所有 SQL 查询通过 `validateSQLQuery()`
- ✅ 参数类型验证（字符串、非空）
- ✅ SQL 注入防护（严格转义）
- ✅ 错误消息不泄露敏感信息

---

## 下一步行动

1. **用户确认** - 回答"待确认问题"部分的选项
2. **开始实施** - 按阶段顺序执行计划
3. **持续测试** - 每个阶段完成后运行测试
4. **文档更新** - 同步更新文档和示例

---

**文档版本**: 1.0
**最后更新**: 2026-02-26
**作者**: Claude Sonnet 4.5
