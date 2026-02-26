/**
 * 思源笔记查询工具
 * 提供全文搜索和SQL查询功能
 */

const fs = require('fs');
const path = require('path');

/**
 * 验证错误类
 * 用于区分输入验证错误和其他类型的错误
 */
class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

/**
 * 验证搜索参数
 * @param {string} keyword - 搜索关键词
 * @param {string} blockType - 块类型
 * @param {number} page - 页码
 * @throws {ValidationError} 参数无效时抛出
 */
function validateSearchParams(keyword, blockType = null, page = 1) {
    if (keyword === null || keyword === undefined) {
        throw new ValidationError('搜索关键词不能为空', 'keyword');
    }

    const trimmedKeyword = String(keyword).trim();

    if (trimmedKeyword.length === 0) {
        throw new ValidationError(
            '搜索关键词不能为空或仅包含空格。请提供一个有效的搜索词。',
            'keyword'
        );
    }

    if (blockType !== null && blockType !== undefined) {
        const validTypes = ['d', 'h', 'p', 'l', 'c', 't', 'b', 'av'];
        if (!validTypes.includes(blockType)) {
            throw new ValidationError(
                `无效的块类型 "${blockType}"。支持的类型: ${validTypes.join(', ')}`,
                'blockType'
            );
        }
    }

    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
        throw new ValidationError(
            `无效的页码 "${page}"。页码必须是大于 0 的整数。`,
            'page'
        );
    }

    if (pageNum > 1000) {
        throw new ValidationError(
            `页码 ${pageNum} 超出最大限制 (1000)。如需查看更多结果，请调整搜索关键词。`,
            'page'
        );
    }
}

/**
 * 验证 SQL 查询语句（白名单模式）
 * @param {string} sqlQuery - SQL 查询语句
 * @throws {ValidationError} SQL 无效或包含危险操作时抛出
 */
function validateSQLQuery(sqlQuery) {
    if (!sqlQuery || typeof sqlQuery !== 'string') {
        throw new ValidationError('SQL 查询语句不能为空', 'sqlQuery');
    }

    const trimmedSQL = sqlQuery.trim();

    if (trimmedSQL.length === 0) {
        throw new ValidationError('SQL 查询语句不能为空', 'sqlQuery');
    }

    const selectPattern = /^\s*(SELECT|select|SELECT\s+DISTINCT|select\s+distinct)/i;

    if (!selectPattern.test(trimmedSQL)) {
        throw new ValidationError(
            `只允许 SELECT 查询语句。检测到的 SQL 可能包含非查询操作。\n` +
            `当前 SQL: ${trimmedSQL.substring(0, 100)}${trimmedSQL.length > 100 ? '...' : ''}`,
            'sqlQuery'
        );
    }

    const dangerousKeywords = [
        '\bDROP\s',
        '\bDELETE\s',
        '\bTRUNCATE\s',
        '\bALTER\s',
        '\bCREATE\s',
        '\bINSERT\s',
        '\bUPDATE\s',
        '\bGRANT\s',
        '\bREVOKE\s',
        '\bEXECUTE\s',
        '\bEXEC\s',
    ];

    for (const keyword of dangerousKeywords) {
        const regex = new RegExp(keyword, 'i');
        if (regex.test(trimmedSQL)) {
            throw new ValidationError(
                `SQL 语句包含不允许的操作: "${keyword.trim()}"。` +
                `只允许只读的 SELECT 查询。`,
                'sqlQuery'
            );
        }
    }

    const injectionPatterns = [
        /;\s*DROP/i,
        /;\s*DELETE/i,
        /';\s*DROP/i,
        /";\s*DROP/i,
        /--\s*\w/i,
        /\/\*\*.*\*\//i,
        /UNION\s+SELECT/i,
    ];

    for (const pattern of injectionPatterns) {
        if (pattern.test(trimmedSQL)) {
            throw new ValidationError(
                `检测到可能的 SQL 注入模式。请检查 SQL 语句的合法性。`,
                'sqlQuery'
            );
        }
    }

    if (!/\bFROM\b/i.test(trimmedSQL)) {
        if (DEBUG_MODE) {
            console.log('⚠️  SQL 查询缺少 FROM 子句，请确认查询语句正确。');
        }
    }
}

/**
 * 清理 HTML 内容，提取纯文本
 * @param {string} htmlContent - 包含 HTML 的内容
 * @returns {string} 清理后的纯文本
 */
function cleanHTMLContent(htmlContent) {
    if (!htmlContent || typeof htmlContent !== 'string') {
        return '';
    }

    try {
        return htmlContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    } catch (error) {
        if (DEBUG_MODE) {
            console.log('⚠️  HTML 清理失败:', error.message);
        }
        return htmlContent.replace(/<[^>]+>/g, '').trim();
    }
}

/** 加载.env文件 */
function loadEnvFile() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            envContent.split('\n').forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && !trimmedLine.startsWith('#')) {
                    const [key, ...valueParts] = trimmedLine.split('=');
                    if (key && valueParts.length > 0) {
                        const value = valueParts.join('=').trim();
                        process.env[key.trim()] = value;
                    }
                }
            });
            if (DEBUG_MODE) console.log('✅ 已加载.env配置文件:', envPath);
        } else {
            if (DEBUG_MODE) console.log('⚠️  未找到.env文件:', envPath);
        }
    } catch (error) {
        if (DEBUG_MODE) console.log('⚠️  .env文件加载失败:', error.message);
    }
}

/** 调试模式开关 */
const DEBUG_MODE = process.env.DEBUG === 'true' || process.argv.includes('--debug');

/** 加载环境变量 */
loadEnvFile();

/** 环境变量或默认配置 */
const SIYUAN_HOST = process.env.SIYUAN_HOST || 'localhost';
const SIYUAN_PORT = process.env.SIYUAN_PORT || '';
const SIYUAN_API_TOKEN = process.env.SIYUAN_API_TOKEN || '';
const SIYUAN_USE_HTTPS = process.env.SIYUAN_USE_HTTPS === 'true';
const SIYUAN_BASIC_AUTH_USER = process.env.SIYUAN_BASIC_AUTH_USER || '';
const SIYUAN_BASIC_AUTH_PASS = process.env.SIYUAN_BASIC_AUTH_PASS || '';

/** API端点配置 */
const API_BASE_URL = `${SIYUAN_USE_HTTPS ? 'https' : 'http'}://${SIYUAN_HOST}${SIYUAN_PORT ? ':' + SIYUAN_PORT : ''}`;
const SQL_QUERY_ENDPOINT = `${API_BASE_URL}/api/query/sql`;

if (DEBUG_MODE) {
    console.log(`📡 服务器地址: ${API_BASE_URL}/api/query/sql`);
    console.log(`🔑 API Token: ${SIYUAN_API_TOKEN ? '已配置' : '未配置'}`);
    console.log(`🔐 Basic Auth: ${SIYUAN_BASIC_AUTH_USER ? `用户: ${SIYUAN_BASIC_AUTH_USER}` : '未配置'}`);
}

/**
 * 检查环境配置是否完整
 * @returns {boolean} 配置是否完整
 */
function checkEnvironmentConfig() {
    if (!SIYUAN_API_TOKEN || SIYUAN_API_TOKEN.trim() === '') {
        console.error(`
❌ 错误: 未配置思源笔记API Token

请按以下步骤配置:

1. 打开思源笔记
2. 进入 设置 → 关于
3. 复制 API Token
4. 创建 .env 文件并填入配置:

cp .env.example .env

然后编辑 .env 文件，填入你的配置:

# 基础配置
SIYUAN_HOST=你的服务器地址
SIYUAN_PORT=端口号 (HTTPS且无特殊端口可留空)
SIYUAN_USE_HTTPS=true (如果使用HTTPS)
SIYUAN_API_TOKEN=你的实际API_TOKEN

# 可选：HTTP Basic Auth (如果启用了Basic Auth)
SIYUAN_BASIC_AUTH_USER=用户名
SIYUAN_BASIC_AUTH_PASS=密码
        `);
        return false;
    }
    return true;
}

/**
 * 调用思源笔记API的通用函数
 * @param {string} endpoint - API端点路径
 * @param {Object} requestBody - 请求体
 * @returns {Promise<Object>} API响应数据
 */
async function callSiyuanAPI(endpoint, requestBody) {
    if (!checkEnvironmentConfig()) {
        throw new Error('环境配置不完整');
    }

    const apiUrl = `${API_BASE_URL}${endpoint}`;

    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        let response;

        if (SIYUAN_BASIC_AUTH_USER && SIYUAN_BASIC_AUTH_PASS) {
            const basicAuthCredentials = Buffer.from(`${SIYUAN_BASIC_AUTH_USER}:${SIYUAN_BASIC_AUTH_PASS}`).toString('base64');
            headers.Authorization = `Basic ${basicAuthCredentials}`;
            const urlWithToken = `${apiUrl}?token=${encodeURIComponent(SIYUAN_API_TOKEN)}`;

            if (DEBUG_MODE) console.log(`🔐 调用API: ${endpoint}`);

            response = await fetch(urlWithToken, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
        } else {
            headers.Authorization = `Token ${SIYUAN_API_TOKEN}`;

            if (DEBUG_MODE) console.log(`🔑 调用API: ${endpoint}`);

            response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.code !== 0) {
            throw new Error(`思源API错误: ${result.msg || '未知错误'}`);
        }

        return result.data;
    } catch (error) {
        if (error.name === 'FetchError' || error.code === 'ECONNREFUSED') {
            throw new Error(`无法连接到思源笔记: ${error.message}`);
        }
        throw error;
    }
}

/**
 * 全文搜索笔记块
 * @param {string} query - 搜索查询词
 * @param {Object} options - 搜索选项
 * @returns {Promise<Object>} 搜索结果
 */
async function fullTextSearch(query, options = {}) {
    const {
        method = 0,
        types = {},
        paths = [],
        groupBy = 0,
        orderBy = 0,
        page = 1
    } = options;

    const defaultTypes = {
        audioBlock: true,
        blockquote: true,
        codeBlock: true,
        databaseBlock: true,
        document: true,
        embedBlock: true,
        heading: true,
        htmlBlock: true,
        iframeBlock: true,
        list: false,
        listItem: false,
        mathBlock: true,
        paragraph: true,
        superBlock: true,
        table: false,
        videoBlock: true,
        widgetBlock: true
    };

    const requestBody = {
        query,
        method,
        types: { ...defaultTypes, ...types },
        paths,
        groupBy,
        orderBy,
        page,
        reqId: Date.now()
    };

    if (DEBUG_MODE) {
        console.log('🔍 全文搜索参数:', JSON.stringify(requestBody, null, 2));
    }

    return await callSiyuanAPI('/api/search/fullTextSearchBlock', requestBody);
}

/**
 * 搜索包含关键词的笔记内容 (返回格式化字符串)
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回结果数量限制
 * @param {string} blockType - 块类型过滤 (可选)
 * @param {number} page - 页码 (可选，默认第1页)
 * @returns {Promise<string>} 格式化后的结果
 */
async function searchNotes(keyword, limit = 20, blockType = null, page = 1) {
    try {
        validateSearchParams(keyword, blockType, page);
    } catch (error) {
        if (error instanceof ValidationError) {
            throw error;
        }
        throw new ValidationError(`参数验证失败: ${error.message}`);
    }

    const options = { page };

    if (blockType) {
        const typeMap = {
            'd': { document: true },
            'h': { heading: true },
            'p': { paragraph: true },
            'l': { list: true, listItem: true },
            'c': { codeBlock: true },
            't': { table: true },
            'b': { blockquote: true }
        };

        if (typeMap[blockType]) {
            options.types = {
                audioBlock: false,
                blockquote: false,
                codeBlock: false,
                databaseBlock: false,
                document: false,
                embedBlock: false,
                heading: false,
                htmlBlock: false,
                iframeBlock: false,
                list: false,
                listItem: false,
                mathBlock: false,
                paragraph: false,
                superBlock: false,
                table: false,
                videoBlock: false,
                widgetBlock: false,
                ...typeMap[blockType]
            };
        }
    }

    const results = await fullTextSearch(keyword, options);

    if (results && results.blocks && Array.isArray(results.blocks)) {
        if (DEBUG_MODE) {
            console.log(`🎯 搜索完成: 找到 ${results.matchedBlockCount} 个匹配块，${results.matchedRootCount} 个文档`);
        }

        const blocks = results.blocks.slice(0, limit);

        /** 按文档分组，减少重复路径显示 */
        const groupedByDoc = {};
        const typeMap = {
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

        blocks.forEach((item) => {
            const path = item.hPath || '未知文档';
            if (!groupedByDoc[path]) {
                groupedByDoc[path] = [];
            }
            const type = typeMap[item.type] || '块';
            const content = cleanHTMLContent(item.content || '');
            groupedByDoc[path].push({ type, content });
        });

        let output = `找到 ${results.matchedBlockCount} 条结果，第 ${page}/${results.pageCount} 页\n\n`;
        let globalIndex = 1;

        for (const [path, items] of Object.entries(groupedByDoc)) {
            output += `📄 ${path}\n`;
            items.forEach((item) => {
                const content = item.content.substring(0, 150);
                const truncated = item.content.length > 150 ? '...' : '';
                output += `  ${globalIndex}. [${item.type}] ${content}${truncated}\n`;
                globalIndex++;
            });
            output += '\n';
        }

        return output.trim();
    }

    return `未找到包含"${keyword}"的结果`;
}

/**
 * 执行思源笔记SQL查询 (返回精简后的原始数据)
 * @param {string} sqlQuery - SQL查询语句
 * @returns {Promise<Array>} 查询结果数组
 */
async function executeSiyuanQuery(sqlQuery) {
    try {
        validateSQLQuery(sqlQuery);
    } catch (error) {
        if (error instanceof ValidationError) {
            throw error;
        }
        throw new ValidationError(`SQL 验证失败: ${error.message}`);
    }

    if (!checkEnvironmentConfig()) {
        throw new Error('环境配置不完整');
    }

    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        let requestBody = {
            stmt: sqlQuery
        };

        let response;

        if (SIYUAN_BASIC_AUTH_USER && SIYUAN_BASIC_AUTH_PASS) {
            const basicAuthCredentials = Buffer.from(`${SIYUAN_BASIC_AUTH_USER}:${SIYUAN_BASIC_AUTH_PASS}`).toString('base64');
            headers.Authorization = `Basic ${basicAuthCredentials}`;
            const urlWithToken = `${SQL_QUERY_ENDPOINT}?token=${encodeURIComponent(SIYUAN_API_TOKEN)}`;

            if (DEBUG_MODE) console.log('🔐 使用双重认证：Basic Auth (Authorization头) + Token (URL参数)');

            response = await fetch(urlWithToken, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
        } else {
            headers.Authorization = `Token ${SIYUAN_API_TOKEN}`;

            if (DEBUG_MODE) console.log('🔑 使用思源Token认证：Authorization头');

            response = await fetch(SQL_QUERY_ENDPOINT, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
        }

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            switch (response.status) {
                case 401:
                    errorMessage = '认证失败，请检查API Token或Basic Auth配置';
                    break;
                case 403:
                    errorMessage = '权限不足，请检查API权限设置';
                    break;
                case 404:
                    errorMessage = 'API端点未找到，请检查思源笔记是否运行';
                    break;
                case 500:
                    errorMessage = '服务器内部错误，请检查思源笔记状态';
                    break;
                case 503:
                    errorMessage = '服务不可用，请确认思源笔记正在运行';
                    break;
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();

        if (result.code !== 0) {
            let errorMessage = `思源API错误: ${result.msg || '未知错误'}`;

            if (result.msg?.includes('token')) {
                errorMessage += ' (请检查API Token是否正确)';
            }
            if (result.msg?.includes('permission')) {
                errorMessage += ' (请检查API权限设置)';
            }

            throw new Error(errorMessage);
        }

        const data = result.data || [];

        if (Array.isArray(data) && data.length > 0) {
            return data.map(item => ({
                id: item.id,
                type: item.type,
                subtype: item.subtype,
                content: item.content,
                markdown: item.markdown,
                hpath: item.hPath,
                created: item.created,
                updated: item.updated,
                root_id: item.root_id,
                parent_id: item.parent_id,
                box: item.box,
                name: item.name || '',
                alias: item.alias || '',
                memo: item.memo || '',
                tag: item.tag || '',
                fcontent: item.fcontent || '',
                hash: item.hash || '',
                path: item.path || '',
                ial: item.ial || '',
                sort: item.sort || 0
            }));
        }

        return [];
    } catch (error) {
        if (error.name === 'FetchError' || error.code === 'ECONNREFUSED') {
            throw new Error(`无法连接到思源笔记: ${error.message}. 请确认思源笔记正在运行且端口配置正确`);
        }

        if (error.message.includes('401') || error.message.includes('token')) {
            throw new Error(`认证失败: ${error.message}. 请检查API Token配置`);
        }

        if (error.message.includes('思源API错误') || error.message.includes('HTTP')) {
            throw error;
        }

        throw new Error(`查询失败: ${error.message}`);
    }
}

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
               b.created, b.updated, b.root_id, b.parent_id, b.box,
               b.name, b.alias, b.memo, b.tag, b.fcontent, b.hash,
               b.path, b.ial, b.sort, r.def_block_id
        FROM blocks b
        INNER JOIN refs r ON b.id = r.block_id
        WHERE r.def_block_id = '${blockId.trim()}'
        ORDER BY b.updated DESC
    `;

    return executeSiyuanQuery(sql);
}

/**
 * 查询某个块引用的所有块（正向链接）
 * @param {string} blockId - 块ID
 * @returns {Promise<Array>} 该块引用的块列表
 */
async function getOutgoingLinks(blockId) {
    if (!blockId || typeof blockId !== 'string' || blockId.trim().length === 0) {
        throw new ValidationError('块ID不能为空', 'blockId');
    }

    const sql = `
        SELECT b.id, b.type, b.subtype, b.content, b.markdown, b.hpath,
               b.created, b.updated, b.root_id, b.parent_id, b.box,
               b.name, b.alias, b.memo, b.tag, b.fcontent, b.hash,
               b.path, b.ial, b.sort, r.block_id
        FROM blocks b
        INNER JOIN refs r ON b.id = r.def_block_id
        WHERE r.block_id = '${blockId.trim()}'
        ORDER BY b.updated DESC
    `;

    return executeSiyuanQuery(sql);
}

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

/**
 * 解析命令行参数（支持命名参数和位置参数）
 * @param {string[]} args - 命令行参数数组
 * @param {Object} options - 参数配置
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(args, options = {}) {
    const result = {};
    const positionalArgs = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--')) {
            // 命名参数: --key value 或 --key=value
            const key = arg.slice(2);
            const eqIndex = key.indexOf('=');

            if (eqIndex !== -1) {
                // --key=value 格式
                const actualKey = key.slice(0, eqIndex);
                const value = key.slice(eqIndex + 1);
                result[actualKey] = value;
            } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                // --key value 格式
                result[key] = args[++i];
            } else {
                // 布尔标志 --flag
                result[key] = true;
            }
        } else if (arg.startsWith('-')) {
            // 短参数: -k value 或 -k=value
            const key = arg.slice(1);
            const eqIndex = key.indexOf('=');

            if (eqIndex !== -1) {
                const actualKey = key.slice(0, eqIndex);
                const value = key.slice(eqIndex + 1);
                result[actualKey] = value;
            } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                result[key] = args[++i];
            } else {
                result[key] = true;
            }
        } else {
            // 位置参数
            positionalArgs.push(arg);
        }
    }

    return { ...result, _positional: positionalArgs };
}

/**
 * 显示帮助信息
 */
function showHelp() {
    console.log(`
思源笔记查询工具 v1.2.0

用法:
  node index.js <命令> [选项]

命令:
  search   全文搜索笔记内容
  sql      执行SQL查询

选项 (search 命令):
  -k, --keyword <关键词>   搜索关键词（必需）
  -t, --type <类型>        块类型过滤 (d/h/p/l/c/t/b/av)
  -p, --page <页码>        页码，默认 1
  -l, --limit <数量>       返回数量，默认 20

选项 (sql 命令):
  -q, --query <SQL语句>   SQL查询语句（必需）

块类型说明:
  d  - 文档      h  - 标题      p  - 段落      l  - 列表
  c  - 代码块    t  - 表格      b  - 引用      av - 属性视图

示例:
  # 搜索包含"人工智能"的笔记
  node index.js search --keyword "人工智能"

  # 搜索标题，限制10条结果
  node index.js search -k "React" -t h -l 10

  # 第2页结果
  node index.js search -k "前端" -p 2

  # 执行SQL查询
  node index.js sql -q "SELECT * FROM blocks WHERE type='d' LIMIT 10"

  # 兼容旧格式（位置参数）
  node index.js search "关键词" [类型] [页码]
  node index.js sql "SELECT * FROM blocks LIMIT 10"
`);
}

/**
 * 显示命令错误提示
 */
function showCommandError(invalidCommand) {
    console.error(`
❌ 未知命令: ${invalidCommand}

支持的命令:
  search  - 搜索笔记内容
  sql     - 执行SQL查询

使用 "node index.js" 或 "node index.js --help" 查看详细帮助
`);
}

/**
 * 主函数 - 命令行入口
 */
async function main() {
    const args = process.argv.slice(2);

    // 显示帮助信息
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        showHelp();
        return;
    }

    if (!checkEnvironmentConfig()) {
        return;
    }

    const command = args[0];

    try {
        switch (command) {
            case 'search': {
                // 检查是否请求帮助
                if (args.includes('--help') || args.includes('-h')) {
                    console.log(`
search 命令 - 搜索笔记内容

用法:
  node index.js search [选项]

选项:
  -k, --keyword <关键词>   搜索关键词（必需）
  -t, --type <类型>        块类型过滤 (d/h/p/l/c/t/b/av)
  -p, --page <页码>        页码，默认 1
  -l, --limit <数量>       返回数量，默认 20

示例:
  node index.js search -k "人工智能"
  node index.js search -k "React" -t h -l 10
  node index.js search "关键词" "h" "1"  # 兼容旧格式
`);
                    return;
                }

                // 解析参数（支持命名参数和位置参数）
                const parsed = parseArgs(args.slice(1));

                let keyword, blockType, pageNum, limitNum;

                if (parsed.keyword || parsed.k) {
                    // 命名参数格式
                    keyword = parsed.keyword || parsed.k;
                    blockType = parsed.type || parsed.t || null;
                    pageNum = parseInt(parsed.page || parsed.p) || 1;
                    limitNum = parseInt(parsed.limit || parsed.l) || 20;
                } else if (parsed._positional.length > 0) {
                    // 位置参数格式（向后兼容）
                    keyword = parsed._positional[0];
                    blockType = parsed._positional[1] || null;
                    pageNum = parseInt(parsed._positional[2]) || 1;
                    limitNum = 20; // 旧格式保持默认 20
                } else {
                    console.error('❌ 请提供搜索关键词');
                    console.log('使用 "node index.js search --help" 查看帮助');
                    return;
                }

                const searchResults = await searchNotes(keyword, limitNum, blockType, pageNum);
                console.log(searchResults);
                break;
            }

            case 'sql': {
                // 检查是否请求帮助
                if (args.includes('--help') || args.includes('-h')) {
                    console.log(`
sql 命令 - 执行SQL查询

用法:
  node index.js sql [选项]

选项:
  -q, --query <SQL语句>   SQL查询语句（必需）

示例:
  node index.js sql -q "SELECT * FROM blocks WHERE type='d' LIMIT 10"
  node index.js sql "SELECT * FROM blocks LIMIT 10"  # 兼容旧格式
`);
                    return;
                }

                // 解析参数
                const parsed = parseArgs(args.slice(1));

                let sqlQuery;
                if (parsed.query || parsed.q) {
                    // 命名参数格式
                    sqlQuery = parsed.query || parsed.q;
                } else if (parsed._positional.length > 0) {
                    // 位置参数格式（向后兼容）
                    sqlQuery = parsed._positional.join(' ');
                } else {
                    console.error('❌ 请提供SQL语句');
                    console.log('使用 "node index.js sql --help" 查看帮助');
                    return;
                }

                const sqlResults = await executeSiyuanQuery(sqlQuery);
                console.log(JSON.stringify(sqlResults, null, 2));
                break;
            }

            default:
                showCommandError(command);
        }
    } catch (error) {
        console.error('❌ 执行失败:', error.message);
        if (error.name === 'ValidationError') {
            console.error(`   字段: ${error.field}`);
        }
    }
}

// 导出函数供其他模块使用
module.exports = {
    executeSiyuanQuery,
    searchNotes,
    getBacklinks,
    getOutgoingLinks,
    getBlockAttributes,
    getDocumentAssets,
    validateSearchParams,
    validateSQLQuery,
    cleanHTMLContent
};

// 如果直接运行此文件，执行主函数
if (require.main === module) {
    main();
}
