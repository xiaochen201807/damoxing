// client/src/utils/fetcher.ts
import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig, Method } from 'axios';
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
export const fetcher = <T = unknown>({
  url,
  method,
  data,
  responseType,
  config,
  headers
}: FetcherConfig): Promise<FetcherResponse<T>> => {

  const baseConfig = config ?? {};
  const { cancelExecutor, ...restConfig } = baseConfig;
  const requestConfig: AxiosRequestConfig = {
    ...restConfig,
    withCredentials: true,
  };

  if (responseType) {
    requestConfig.responseType = responseType;
  }

  if (cancelExecutor) {
    requestConfig.cancelToken = new axios.CancelToken(cancelExecutor);
  }

  requestConfig.headers = {
    ...(headers ?? {}),
    ...((requestConfig.headers ?? {}) as Record<string, string>),
  };

  // 自动携带 JWT Token（所有请求都携带）
  const token = localStorage.getItem('auth_token');
  if (token) {
    (requestConfig.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
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
          (requestConfig.headers as Record<string, string>)['channel'] = parts[1];
        }
        (requestConfig.headers as Record<string, string>)['login-token'] = info.login_token;
      }

      // 机构编号
      if (info.jgbh) {
        (requestConfig.headers as Record<string, string>)['jgbh'] = info.jgbh;
      }

      // 子机构编号
      if (info.zjgbh) {
        (requestConfig.headers as Record<string, string>)['zjgbh'] = info.zjgbh;
      }

      // 组织标识
      if (info.zzbs) {
        (requestConfig.headers as Record<string, string>)['zzbs'] = info.zzbs;
      }

      // 组织机构代码证
      if (info.zzjgdmz) {
        (requestConfig.headers as Record<string, string>)['zzjgdmz'] = info.zzjgdmz;
      }
    } catch (_e) {
      console.warn('Failed to parse gateway_info:', _e);
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

  const axiosConfig: AxiosRequestConfig = {
    method: requestMethod as Method,
    url: requestUrl,
    ...requestConfig
  };

  // 只有 POST、PUT、PATCH 才在 body 中发送 data
  if (['post', 'put', 'patch'].includes(requestMethod)) {
    let requestData = data || {};

    // 特殊处理：如果 data 是 JSON 字符串，尝试解析为对象
    // 防止后续 spread 操作 (...) 将字符串打散成字符数组 {"0":"{", "1":"n", ...}
    if (typeof requestData === 'string') {
      try {
        const parsed = JSON.parse(requestData);
        if (typeof parsed === 'object' && parsed !== null) {
          requestData = parsed;
        }
      } catch (_e) {
        // 解析失败，说明可能只是普通字符串，保持原样
      }
    }

    axiosConfig.data = requestData;

    // 将网关信息合并到请求体中 (如果存在)
    if (gatewayInfo) {
      try {
        const info = JSON.parse(gatewayInfo);
        // 只有当 requestData 是普通对象时才进行合并
        // 避免影响 FormData、Blob、Buffer 或原始字符串请求
        if (Object.prototype.toString.call(axiosConfig.data) === '[object Object]') {
          axiosConfig.data = { ...info, ...axiosConfig.data };
        }
      } catch (_e) { /* ignore */ }
    }
  } else {
    // GET、DELETE 等方法如果有数据，放到 params（查询字符串）
    axiosConfig.params = data || {};
    // 将网关信息合并到查询参数中 (如果存在)
    if (gatewayInfo) {
      try {
        const info = JSON.parse(gatewayInfo);
        axiosConfig.params = { ...info, ...axiosConfig.params };
      } catch (_e) { /* ignore */ }
    }
  }

  return axios(axiosConfig).then((response) => {
    const res = response.data;

    // 处理文件下载：如果是 Blob 类型
    // 注意：有时候 CORS 配置问题会导致无法读取 Content-Disposition，此时降级使用默认文件名
    const disposition = response.headers['content-disposition'];
    if (res instanceof Blob) {
      // 提取文件名
      let fileName = 'download';
      if (disposition) {
        console.log('Download Disposition:', disposition);
        const filenameMatch = disposition.match(/filename=(?:["']?)(.*?)(?:["']?)(?:;|$)/);
        if (filenameMatch && filenameMatch[1]) {
          fileName = decodeURIComponent(filenameMatch[1]);
        }
      } else {
        // 尝试从 URL 中提取文件名，或者使用当前时间戳
        try {
          const urlParts = response.config.url?.split('/') || [];
          const lastPart = urlParts[urlParts.length - 1];
          if (lastPart && !lastPart.includes('?')) {
            fileName = lastPart;
          } else {
            fileName = `download_${new Date().getTime()}`;
          }
          // 如果是 csv
          if (res.type === 'text/csv' || res.type === 'application/csv') {
            fileName += '.csv';
          }
        } catch (_e) {
          // ignore
        }
      }

      // 补全扩展名（如果缺失）
      // 某些情况下浏览器或正则可能截断了扩展名，或者 MIME 类型对应的扩展名未自动添加
      console.log('Download File Type:', res.type);
      console.log('Extracted FileName:', fileName);

      const isCsv = res.type.includes('csv') || res.type.includes('excel') || res.type === 'application/vnd.ms-excel';
      if (isCsv && !fileName.toLowerCase().endsWith('.csv')) {
        fileName += '.csv';
        console.log('Appended .csv extension. New FileName:', fileName);
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
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      throw error;
    }

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
      type ErrorBody = { msg?: string } & Record<string, unknown>;
      const errorBody = error.response.data as ErrorBody;
      return {
        status: error.response.status,
        msg: errorBody?.msg || '网络请求错误',
        data: error.response.data as T
      } as FetcherResponse<T>;
    }
    return {
      status: 500,
      msg: error.message,
      data: null as unknown as T
    } as FetcherResponse<T>;
  });
};
