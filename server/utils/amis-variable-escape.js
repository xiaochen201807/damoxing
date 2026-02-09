const DOLLAR_PLACEHOLDER = '__DOLLAR_DOLLAR__';
const DOLLAR_AND_PLACEHOLDER = '__DOLLAR_AND__';
const VAR_PREFIX = '__VAR_';
const VAR_SUFFIX = '__';
const AMIS_VAR_REGEX = /\$\{([^}]+)\}/g;

function escapeAmisVariables(str) {
    if (typeof str !== 'string') return str;
    return str.replace(AMIS_VAR_REGEX, (_m, varExpr) => {
        if (varExpr === '&') return DOLLAR_AND_PLACEHOLDER;
        const safeExpr = String(varExpr).replace(/\|/g, '__PIPE__').replace(/:/g, '__COLON__');
        return `${VAR_PREFIX}${safeExpr}${VAR_SUFFIX}`;
    });
}

function restoreAmisVariables(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/__DOLLAR_DOLLAR__/g, '$$$$')
        .replace(/__DOLLAR_AND__/g, '${&}')
        .replace(/__VAR_([A-Za-z0-9_]+(?:__(?:PIPE|COLON)__[A-Za-z0-9_]+)*)__/g, (_m, varExpr) => {
            const originalExpr = String(varExpr).replace(/__PIPE__/g, '|').replace(/__COLON__/g, ':');
            return '${' + originalExpr + '}';
        });
}

function looksLikeJsonString(value) {
    if (typeof value !== 'string') return false;
    const s = value.trim();
    if (!s) return false;
    const first = s[0];
    const last = s[s.length - 1];
    return (first === '{' && last === '}') || (first === '[' && last === ']');
}

function tryParseJson(value) {
    if (!looksLikeJsonString(value)) return null;
    try {
        return JSON.parse(value);
    } catch (_e) {
        return null;
    }
}

function walkInPlace(node, visitor) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
            const next = visitor(String(i), node[i], node);
            if (next !== undefined) node[i] = next;
            walkInPlace(node[i], visitor);
        }
        return;
    }
    for (const key of Object.keys(node)) {
        const next = visitor(key, node[key], node);
        if (next !== undefined) node[key] = next;
        walkInPlace(node[key], visitor);
    }
}

function escapeParamsForFrontend(obj) {
    walkInPlace(obj, (key, value) => {
        if (typeof value !== 'string') return;

        if (key === '&' && (value === '$$' || value === '[object Object]')) {
            return DOLLAR_PLACEHOLDER;
        }

        const parsed = tryParseJson(value);
        if (parsed && typeof parsed === 'object') {
            escapeParamsForFrontend(parsed);
            return JSON.stringify(parsed, null, 2);
        }

        if (value === '$$' || value === '[object Object]') return DOLLAR_PLACEHOLDER;
        if (value.includes('${')) return escapeAmisVariables(value);
    });
}

function sanitizeParams(obj) {
    walkInPlace(obj, (key, value, parent) => {
        if (typeof value !== 'string') return;

        if (key === '&' && (
            value === '[object Object]' ||
            value === '\\[object Object]' ||
            value === DOLLAR_PLACEHOLDER ||
            value.includes('[object Object]')
        )) {
            return '$$';
        }

        const parsed = tryParseJson(value);
        if (parsed && typeof parsed === 'object') {
            sanitizeParams(parsed);
            return JSON.stringify(parsed, null, 2);
        }

        if (value === '[object Object]' || value === DOLLAR_PLACEHOLDER) return '$$';
        if (value === DOLLAR_AND_PLACEHOLDER) return '${&}';
        if (value.includes(VAR_PREFIX) || value.includes('__DOLLAR')) return restoreAmisVariables(value);
    });
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
