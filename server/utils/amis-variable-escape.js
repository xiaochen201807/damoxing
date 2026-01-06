/**
 * AMIS 变量表达式转义工具
 * 解决 AMIS 在表单编辑时对变量进行求值导致数据丢失的问题
 * 
 * AMIS 特殊语法：
 * - $$ 表示展开所有数据，提交时会被求值为 [object Object]
 * - ${&} 表示展开当前数据，提交时会被求值为 [object Object]
 * - ${xxx} 表示变量引用，提交时会被求值（变量不存在则为空）
 * - ${xxx|filter} 表示带过滤器的变量，如 ${items|count}
 */

// 占位符常量
const DOLLAR_PLACEHOLDER = '__DOLLAR_DOLLAR__';  // 对应 $$ (展开所有数据)
const DOLLAR_AND_PLACEHOLDER = '__DOLLAR_AND__'; // 对应 ${&} (展开当前数据)
const VAR_PREFIX = '__VAR_';
const VAR_SUFFIX = '__';

// 正则匹配 AMIS 变量表达式 ${xxx} 或 ${xxx|filter:arg|filter2}
const AMIS_VAR_REGEX = /\$\{([^}]+)\}/g;

/**
 * 将 AMIS 变量表达式转换为占位符
 * ${ids} -> __VAR_ids__
 * ${&} -> __DOLLAR_AND__
 * ${items|count} -> __VAR_items__PIPE__count__
 */
function escapeAmisVariables(str) {
    if (typeof str !== 'string') return str;
    return str.replace(AMIS_VAR_REGEX, (_, varExpr) => {
        if (varExpr === '&') {
            return DOLLAR_AND_PLACEHOLDER;
        }
        const safeExpr = varExpr
            .replace(/\|/g, '__PIPE__')
            .replace(/:/g, '__COLON__');
        return `${VAR_PREFIX}${safeExpr}${VAR_SUFFIX}`;
    });
}

/**
 * 将占位符还原为 AMIS 变量表达式
 * __VAR_ids__ -> ${ids}
 * __DOLLAR_AND__ -> ${&}
 * __VAR_items__PIPE__count__ -> ${items|count}
 */
function restoreAmisVariables(str) {
    if (typeof str !== 'string') return str;

    let result = str;

    // 还原 __DOLLAR_DOLLAR__ -> $$
    result = result.replace(/__DOLLAR_DOLLAR__/g, '$$$$');  // $$$$ 在 replace 中表示 $$

    // 还原 __DOLLAR_AND__ -> ${&}
    result = result.replace(/__DOLLAR_AND__/g, '${&}');

    // 还原 __VAR_xxx__ -> ${xxx}
    // 使用更精确的正则：匹配变量名和可能的 PIPE/COLON 修饰符
    result = result.replace(/__VAR_([A-Za-z0-9_]+(?:__(?:PIPE|COLON)__[A-Za-z0-9_]+)*)__/g, (_, varExpr) => {
        const originalExpr = varExpr
            .replace(/__PIPE__/g, '|')
            .replace(/__COLON__/g, ':');
        return '${' + originalExpr + '}';
    });

    return result;
}

/**
 * 递归转义对象中的 AMIS 变量（用于前端显示）
 */
function escapeParamsForFrontend(obj) {
    if (!obj || typeof obj !== 'object') return;

    // 处理 "&": "$$" 的特殊情况
    if (obj['&'] === '$$' || obj['&'] === '[object Object]') {
        obj['&'] = DOLLAR_PLACEHOLDER;
    }

    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            // 尝试解析 JSON 字符串
            if (obj[key].trim().startsWith('{') || obj[key].trim().startsWith('[')) {
                try {
                    const innerObj = JSON.parse(obj[key]);
                    escapeParamsForFrontend(innerObj);
                    obj[key] = JSON.stringify(innerObj, null, 2);
                } catch (e) {
                    obj[key] = escapeAmisVariables(obj[key]);
                }
            } else if (obj[key] === '$$' || obj[key] === '[object Object]') {
                obj[key] = DOLLAR_PLACEHOLDER;
            } else if (obj[key].includes('${')) {
                obj[key] = escapeAmisVariables(obj[key]);
            }
        } else if (Array.isArray(obj[key])) {
            obj[key].forEach((item, index) => {
                if (typeof item === 'string') {
                    if (item === '$$' || item === '[object Object]') {
                        obj[key][index] = DOLLAR_PLACEHOLDER;
                    } else if (item.includes('${')) {
                        obj[key][index] = escapeAmisVariables(item);
                    }
                } else if (typeof item === 'object') {
                    escapeParamsForFrontend(item);
                }
            });
        } else if (typeof obj[key] === 'object') {
            escapeParamsForFrontend(obj[key]);
        }
    }
}

/**
 * 递归还原对象中的 AMIS 变量（用于保存到数据库）
 */
function sanitizeParams(obj) {
    if (!obj || typeof obj !== 'object') return;

    // 还原 "&": "$$"
    if (obj['&'] === '[object Object]' ||
        obj['&'] === '\\[object Object]' ||
        obj['&'] === DOLLAR_PLACEHOLDER ||
        (typeof obj['&'] === 'string' && obj['&'].includes('[object Object]'))) {
        obj['&'] = '$$';
    }

    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            // 尝试解析 JSON 字符串
            if (obj[key].trim().startsWith('{') || obj[key].trim().startsWith('[')) {
                try {
                    const innerObj = JSON.parse(obj[key]);
                    sanitizeParams(innerObj);
                    obj[key] = JSON.stringify(innerObj, null, 2);
                } catch (e) {
                    obj[key] = restoreAmisVariables(obj[key]);
                }
            }
            else if (obj[key] === '[object Object]' || obj[key] === DOLLAR_PLACEHOLDER) {
                obj[key] = '$$';
            } else if (obj[key] === DOLLAR_AND_PLACEHOLDER) {
                obj[key] = '${&}';
            } else if (obj[key].includes(VAR_PREFIX) || obj[key].includes('__DOLLAR')) {
                obj[key] = restoreAmisVariables(obj[key]);
            }
        } else if (Array.isArray(obj[key])) {
            obj[key].forEach((item, index) => {
                if (typeof item === 'string') {
                    if (item === '[object Object]' || item === DOLLAR_PLACEHOLDER) {
                        obj[key][index] = '$$';
                    } else if (item === DOLLAR_AND_PLACEHOLDER) {
                        obj[key][index] = '${&}';
                    } else if (item.includes(VAR_PREFIX) || item.includes('__DOLLAR')) {
                        obj[key][index] = restoreAmisVariables(item);
                    }
                } else if (typeof item === 'object') {
                    sanitizeParams(item);
                }
            });
        } else if (typeof obj[key] === 'object') {
            sanitizeParams(obj[key]);
        }
    }
}

module.exports = {
    DOLLAR_PLACEHOLDER,
    DOLLAR_AND_PLACEHOLDER,
    VAR_PREFIX,
    VAR_SUFFIX,
    escapeAmisVariables,
    restoreAmisVariables,
    escapeParamsForFrontend,
    sanitizeParams
};
