// client/src/utils/fetcher.ts
import axios from 'axios';

// 后端服务地址
const BASE_URL = '';

/**
 * AMIS 请求适配器
 * @param url 接口地址
 * @param method 请求方法
 * @param data 请求数据
 * @param config 额外配置
 */
export const fetcher = ({
  url, // 接口地址
  method, // 请求方法 get, post, ...
  data, // 请求数据
  responseType,
  config, // 其他配置
  headers // 请求头
}: any) => {
  
  // 处理 URL，如果不是 http 开头，则拼接 Base URL
  config = config || {};
  config.withCredentials = true;
  responseType && (config.responseType = responseType);

  if (config.cancelExecutor) {
    config.cancelToken = new axios.CancelToken(config.cancelExecutor);
  }

  config.headers = headers || {};

  // 处理 URL：如果是 /api 开头，拼上后端地址
  let requestUrl = url;
  if (url.startsWith('/api')) {
    requestUrl = `${BASE_URL}${url}`;
  } else if (!url.startsWith('http')) {
     // 支持 amis 内部的一些相对路径
     requestUrl = `${BASE_URL}${url}`;
  }

  return axios(requestUrl, {
    method,
    data,
    ...config
  }).then((response: any) => {
    // Axios 包装了一层 data，AMIS 需要直接的响应体
    const res = response.data;
    
    // 适配逻辑：如果你后端的 status 字段定义不同，可以在这里转换
    // 我们之前的后端定义是 { status: 0, msg: 'success', data: ... }，这符合 AMIS 规范
    // AMIS 默认规范：status === 0 表示成功
    
    return {
      data: res // AMIS 期望返回 { data: { status: 0, data: ... } } 或者直接返回 res 供 adapter 处理
    };
  }).catch((error: any) => {
    // 错误处理
    if (error.response) {
      return {
        status: error.response.status,
        msg: error.response.data.msg || '网络请求错误'
      };
    }
    return {
      status: 500,
      msg: error.message
    };
  });
};