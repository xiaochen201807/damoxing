// client/src/utils/fetcher.ts
import axios, { AxiosError } from 'axios';
import type { FetcherConfig, FetcherResponse } from '../types/models';

// 后端服务地址（从环境变量读取，默认为空字符串依赖 Vite proxy）
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// API 路由前缀（优先读取运行时配置，其次环境变量，默认 /api）
const API_PREFIX = window.__APP_CONFIG__?.API_ROUTE_PREFIX || import.meta.env.VITE_API_ROUTE_PREFIX || '/api';

/**
 * AMIS 请求适配器
 * @param url 接口地址
 * @param method 请求方法
 * @param data 请求数据
 * @param config 额外配置
 */
export const fetcher = <T = any>({
  url,
  method,
  data,
  responseType,
  config,
  headers
}: FetcherConfig): Promise<FetcherResponse<T>> => {

  config = config || {};
  config.withCredentials = true;
  responseType && (config.responseType = responseType);

  if (config.cancelExecutor) {
    config.cancelToken = new axios.CancelToken(config.cancelExecutor);
  }

  config.headers = headers || {};

  // 自动携带 JWT Token（所有请求都携带）
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // 第三方网关信息透传（所有请求都携带）
  const gatewayInfo = localStorage.getItem('gateway_info');
  if (gatewayInfo) {
    try {
      const info = JSON.parse(gatewayInfo);

      // 从 login_token 中提取 channel（冒号后面的部分）
      // 例如：bc8f5b4845114d984d802677cf2a15ba63:zmd → zmd
      if (info.login_token) {
        const parts = info.login_token.split(':');
        if (parts.length > 1) {
          config.headers['channel'] = parts[1];
        }
        config.headers['login-token'] = info.login_token;
      }

      // 机构编号
      if (info.jgbh) {
        config.headers['jgbh'] = info.jgbh;
      }

      // 组织标识
      if (info.zzbs) {
        config.headers['zzbs'] = info.zzbs;
      }

      // 组织机构代码证
      if (info.zzjgdmz) {
        config.headers['zzjgdmz'] = info.zzjgdmz;
      }
    } catch (e) {
      console.warn('Failed to parse gateway_info:', e);
    }
  }

  let requestUrl = url;

  // URL 处理逻辑：
  // 1. 如果是完整 URL (http:// 或 https://)，直接使用，不添加任何前缀
  // 2. 如果是内部 API（以 /api 开头），替换为配置的前缀（如 /gjjrgzn/api）
  // 3. 如果是其他相对路径，保持原样（AMIS 配置的第三方接口）
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // 完整 URL，直接使用
    requestUrl = url;
  } else if (url.startsWith('/api')) {
    // 内部 API，替换 /api 为配置的前缀
    requestUrl = `${BASE_URL}${url.replace('/api', API_PREFIX)}`;
  } else if (url.startsWith(API_PREFIX)) {
    // 已经是完整的内部 API 路径
    requestUrl = `${BASE_URL}${url}`;
  } else {
    // 其他相对路径（配置的第三方接口），保持原样
    requestUrl = url;
  }

  // 构建 axios 请求配置
  // GET 和 DELETE 不应该有 data，应该放在 params 中（如果有的话）
  const requestMethod = method?.toLowerCase() || 'get'; // 默认为 GET

  const axiosConfig: any = {
    method: requestMethod,
    url: requestUrl,
    ...config
  };

  // 只有 POST、PUT、PATCH 才在 body 中发送 data
  if (['post', 'put', 'patch'].includes(requestMethod)) {
    axiosConfig.data = data || {};
    // 将网关信息合并到请求体中 (如果存在)
    if (gatewayInfo) {
      try {
        const info = JSON.parse(gatewayInfo);
        axiosConfig.data = { ...info, ...axiosConfig.data };
      } catch (e) { /* ignore */ }
    }
  } else {
    // GET、DELETE 等方法如果有数据，放到 params（查询字符串）
    axiosConfig.params = data || {};
    // 将网关信息合并到查询参数中 (如果存在)
    if (gatewayInfo) {
      try {
        const info = JSON.parse(gatewayInfo);
        axiosConfig.params = { ...info, ...axiosConfig.params };
      } catch (e) { /* ignore */ }
    }
  }

  return axios(axiosConfig).then((response) => {
    const res = response.data;

    // 处理文件下载：如果是 Blob 类型且有 Content-Disposition 响应头
    const disposition = response.headers['content-disposition'];
    if (res instanceof Blob && disposition) {
      // 提取文件名
      let fileName = 'download';
      const filenameMatch = disposition.match(/filename=(?:["']?)(.*?)(?:["']?)(?:;|$)/);
      if (filenameMatch && filenameMatch[1]) {
        fileName = decodeURIComponent(filenameMatch[1]);
      }

      // 触发浏览器下载动作
      const url = window.URL.createObjectURL(res);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // 返回成功给 AMIS，避免显示报错，同时也不需要 AMIS 再次处理下载
      return {
        status: 0,
        msg: '文件已开始下载',
        data: {}
      } as FetcherResponse<T>;
    }

    return {
      status: 0,
      msg: 'success',
      data: res,
      headers: response.headers
    } as FetcherResponse<T>;
  }).catch((error: AxiosError) => {
    // 处理 401 未授权错误
    if (error.response?.status === 401 || error.response?.status === 403) {
      // 清除本地存储
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      localStorage.removeItem('gateway_info');

      // 跳转到登录页（使用配置的基础路径）
      const basePath = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '');
      const loginPath = `${basePath}/login`;
      if (!window.location.pathname.includes('/login')) {
        window.location.href = loginPath;
      }
    }

    if (error.response) {
      return {
        status: error.response.status,
        msg: (error.response.data as any)?.msg || '网络请求错误',
        data: error.response.data as T
      } as FetcherResponse<T>;
    }
    return {
      status: 500,
      msg: error.message,
      data: null as T
    } as FetcherResponse<T>;
  });
};