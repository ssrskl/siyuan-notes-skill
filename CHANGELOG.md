# 变更日志

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
