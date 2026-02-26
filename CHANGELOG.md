# 变更日志

## [1.2.0] - 2026-02-26

### 新增功能

#### 1. 补全 blocks 表字段
- executeSiyuanQuery 现在返回完整的 20 个字段（原 11 个）
- 新增字段：name, alias, memo, tag, fcontent, hash, path, ial, sort
- 所有新字段均包含空值容错处理

#### 2. 完善块类型映射
- 支持思源笔记所有 17 种块类型（原 8 种）
- 新增类型：音频、属性视图、HTML块、内嵌框架、数学公式、嵌入查询、小组件、视频、列表项
- searchNotes() 现在能正确识别和显示所有块类型

#### 3. refs 表查询支持
- 新增 `getBacklinks(blockId)` - 查询引用某个块的所有块（反向链接）
- 新增 `getOutgoingLinks(blockId)` - 查询某个块引用的所有块（正向链接）
- 支持发现笔记间的双向引用关系

#### 4. attributes 表查询支持
- 新增 `getBlockAttributes(blockId)` - 查询块的自定义属性
- 返回格式化的键值对对象，便于直接使用
- 支持查询书签、优先级、状态等自定义元数据

#### 5. AV 属性视图基础支持
- 在块类型映射中添加 'NodeAttributeView': '属性视图'
- 能正确识别和显示属性视图块（type='av'）

#### 6. assets 表查询支持
- 新增 `getDocumentAssets(docId)` - 查询文档的所有资源文件
- 支持查询图片、视频、附件等资源文件的元数据
- 返回文件名、扩展名、大小、路径等信息

### SQL 查询增强

- 支持跨表 JOIN 查询（blocks + refs + attributes + assets）
- 提供丰富的跨表查询示例（见 SKILL.md）
- 性能优化：1000 条记录查询仅需 31ms

### 文档更新

- SKILL.md 新增完整的数据表参考章节
  - blocks 表 20 个字段完整说明
  - refs 表结构和使用场景
  - attributes 表结构和使用场景
  - assets 表结构和使用场景
  - 17 种块类型完整映射
  - 跨表 JOIN 查询示例
- README.md 更新支持的查询类型列表

### 技术改进

- 所有新增函数均包含参数验证（ValidationError）
- 所有新增函数都通过 executeSiyuanQuery() 执行，继承安全验证
- 导出函数增加：getBacklinks, getOutgoingLinks, getBlockAttributes, getDocumentAssets

### 破坏性变更

- executeSiyuanQuery() 返回的对象新增 9 个字段
- 如果代码中使用了对象解构且未提供默认值，可能会报错
- 解决方案：使用解构默认值 `{ name = '', alias = '' } = item`

### 测试覆盖

- 单元测试：所有新增函数的参数验证
- 集成测试：跨表 JOIN 查询验证
- 性能测试：1000 条记录查询耗时 < 2 秒（实际 31ms）

---

## [1.1.0] - 2026-02-26

### 新增
- **输入验证功能**
  - 搜索参数验证（关键词、块类型、页码）
  - SQL 查询安全验证（只允许 SELECT 语句）
  - 统一的 ValidationError 错误类型
- **改进的 HTML 清理逻辑**
  - 移除 script 和 style 标签
  - 支持 HTML 实体解码（&nbsp;, &lt;, &gt;, &amp;, &quot;, &#39;）
  - 合并多余空格
  - 降级方案确保可靠性

### 安全性
- 防止 SQL 注入攻击（UNION SELECT、分号注入等）
- 防止恶意输入导致的异常
- 白名单模式验证 SQL 查询（只允许 SELECT）

### 破坏性变更
- 空关键词现在会抛出错误（之前可能返回所有结果）
- 非 SELECT 语句现在会被拦截（之前可能通过）
- 搜索关键词必须是有效字符串（不能是 null 或 undefined）
- 页码必须在 1-1000 之间（之前无限制）

### 技术改进
- 新增 `validateSearchParams()` 函数
- 新增 `validateSQLQuery()` 函数
- 新增 `cleanHTMLContent()` 函数
- 所有验证函数导出供外部使用

### 文档更新
- README.md 新增"输入验证"章节
- SKILL.md 新增"输入限制"说明

## [1.0.0] - 初始版本

- 基础搜索功能
- SQL 查询功能
- 思源笔记 API 集成
