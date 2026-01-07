/**
 * URL 参数解析工具
 */

/**
 * 从 URL 获取查询参数
 * @param {string} name - 参数名
 * @returns {string | null} - 参数值
 */
export function getUrlParam(name: string): string | null {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get(name);
}

/**
 * 从 URL 获取所有查询参数
 * @returns {Record<string, string>} - 所有参数的键值对
 */
export function getAllUrlParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(window.location.search);

    searchParams.forEach((value, key) => {
        params[key] = value;
    });

    return params;
}

/**
 * 从 URL 获取网关相关参数
 * @returns {Object} - 包含 ticket、tyLoginToken、qycode 的对象
 */
export function getGatewayParams() {
    return {
        ticket: getUrlParam('ticket'),
        tyLoginToken: getUrlParam('tyLoginToken'),
        qycode: getUrlParam('qycode'),
        cheque: getUrlParam('cheque')
    };
}

/**
 * 保存 URL 参数到 sessionStorage（用于页面刷新后保持）
 */
export function saveUrlParamsToSession() {
    const params = getGatewayParams();

    // 有任意网关参数时保存（包括 cheque）
    if (params.ticket || params.tyLoginToken || params.qycode || params.cheque) {
        sessionStorage.setItem('gateway_url_params', JSON.stringify(params));
    }
}

/**
 * 从 sessionStorage 读取保存的参数
 */
export function getUrlParamsFromSession() {
    const saved = sessionStorage.getItem('gateway_url_params');
    return saved ? JSON.parse(saved) : null;
}

/**
 * 获取网关参数（优先从 URL，其次从 sessionStorage）
 */
export function getGatewayParamsWithFallback() {
    const urlParams = getGatewayParams();
    const sessionParams = getUrlParamsFromSession();

    return {
        ticket: urlParams.ticket || sessionParams?.ticket || null,
        tyLoginToken: urlParams.tyLoginToken || sessionParams?.tyLoginToken || null,
        qycode: urlParams.qycode || sessionParams?.qycode || null,
        cheque: urlParams.cheque || sessionParams?.cheque || null
    };
}
