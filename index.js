/**
 * 思源笔记查询工具
 * 提供全文搜索和SQL查询功能
 */

const fs = require('fs');
const path = require('path');

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
            'NodeCodeBlock': '代码',
            'NodeTable': '表格',
            'NodeList': '列表',
            'NodeBlockquote': '引用',
            'NodeSuperBlock': '超级块'
        };

        blocks.forEach((item) => {
            const path = item.hPath || '未知文档';
            if (!groupedByDoc[path]) {
                groupedByDoc[path] = [];
            }
            const type = typeMap[item.type] || '块';
            const content = (item.content || '').replace(/<[^>]+>/g, '');
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
                box: item.box
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
 * 主函数 - 命令行入口
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
思源笔记查询工具使用说明:

用法:
  node index.js <命令> [参数]

命令:
  search <关键词> [类型] [页码]  - 搜索包含关键词的笔记
  sql <SQL语句>                  - 执行SQL查询

块类型:
  d - 文档, h - 标题, p - 段落, l - 列表
  c - 代码块, t - 表格, b - 引用

示例:
  node index.js search "人工智能"
  node index.js search "前端" h 1
  node index.js sql "SELECT * FROM blocks WHERE type='d' LIMIT 10"
        `);
        return;
    }

    if (!checkEnvironmentConfig()) {
        return;
    }

    const command = args[0];

    try {
        switch (command) {
            case 'search':
                if (args.length < 2) {
                    console.error('请提供搜索关键词');
                    return;
                }
                const keyword = args[1];
                const blockType = args[2] || null;
                const pageNum = parseInt(args[3]) || 1;
                const searchResults = await searchNotes(keyword, 20, blockType, pageNum);
                console.log(searchResults);
                break;

            case 'sql':
                if (args.length < 2) {
                    console.error('请提供SQL语句');
                    return;
                }
                const sqlQuery = args.slice(1).join(' ');
                const sqlResults = await executeSiyuanQuery(sqlQuery);
                console.log(JSON.stringify(sqlResults, null, 2));
                break;

            default:
                console.error(`未知命令: ${command}`);
        }
    } catch (error) {
        console.error('执行失败:', error.message);
    }
}

// 导出函数供其他模块使用
module.exports = {
    executeSiyuanQuery,
    searchNotes
};

// 如果直接运行此文件，执行主函数
if (require.main === module) {
    main();
}
