/**
 * Axios 客户端配置
 */

import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { env } from '@/config';
import type { ApiResponse } from '@/types/response';

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
    baseURL: env.API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 请求拦截器
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // 可以在这里添加 token
        // const token = localStorage.getItem('token');
        // if (token) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }

        if (env.DEV) {
            console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
        }

        return config;
    },
    (error: AxiosError) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
    }
);

// 响应拦截器
apiClient.interceptors.response.use(
    (response: AxiosResponse<ApiResponse<unknown>>) => {
        if (env.DEV) {
            console.log('📥 API Response:', response.config.url, response.data);
        }

        return response;
    },
    (error: AxiosError<ApiResponse>) => {
        console.error('❌ Response Error:', error);

        // 统一错误处理
        const errorMessage = error.response?.data?.msg || error.message || '请求失败';
        const status = error.response?.data?.status || error.response?.status || 500;

        // 可以在这里添加全局错误提示
        // message.error(errorMessage);

        return Promise.reject({
            status,
            msg: errorMessage,
            error: error.response?.data?.error,
        });
    }
);

export default apiClient;
