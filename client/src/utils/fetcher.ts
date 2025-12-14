// client/src/utils/fetcher.ts
import axios, { AxiosError } from 'axios';
import type { FetcherConfig, FetcherResponse } from '../types/models';

// 后端服务地址（从环境变量读取，默认为空字符串依赖 Vite proxy）
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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

  let requestUrl = url;
  if (url.startsWith('/api')) {
    requestUrl = `${BASE_URL}${url}`;
  } else if (!url.startsWith('http')) {
    requestUrl = `${BASE_URL}${url}`;
  }

  return axios(requestUrl, {
    method,
    data,
    ...config
  }).then((response) => {
    const res = response.data;

    return {
      status: 0,
      msg: 'success',
      data: res
    } as FetcherResponse<T>;
  }).catch((error: AxiosError) => {
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