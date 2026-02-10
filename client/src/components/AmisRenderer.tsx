// client/src/components/AmisRenderer.tsx
import React from 'react';
import { render as renderAmis } from 'amis';
import { ToastComponent, AlertComponent, toast } from 'amis-ui';
import { fetcher } from '../utils/fetcher';
import { useNavigate, useLocation } from 'react-router-dom';
import type { AmisSchema } from '../types/amis';
import type { Api, Payload, RendererEnv } from 'amis-core';

interface Props {
  schema: AmisSchema;
  data?: Record<string, unknown>;
}

const AmisRenderer: React.FC<Props> = ({ schema, data = {} }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const amisFetcher: RendererEnv['fetcher'] = async (api: Api, apiData?: unknown): Promise<Payload> => {
    const apiObj = typeof api === 'string' ? { url: api } : api;
    const response = await fetcher({
      url: apiObj.url,
      method: (apiObj.method ?? 'get') as 'get' | 'post' | 'put' | 'delete' | 'patch',
      data: apiData ?? apiObj.data ?? apiObj.body ?? apiObj.query,
      responseType: (apiObj as any).responseType,
      config: apiObj.config,
      headers: apiObj.headers as Record<string, string> | undefined
    });

    const body = response.data as { status?: unknown; msg?: unknown; data?: unknown } & Record<string, unknown>;
    const status = typeof body.status === 'number' ? body.status : 0;
    const msg = typeof body.msg === 'string' ? body.msg : 'success';
    const payloadData = Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;

    return {
      ok: status === 0,
      status,
      msg,
      data: payloadData,
      headers: response.headers // 关键修复：必须返回 headers，否则 amis 无法获取 Content-Disposition
    } as any;
  };

  return (
    <div className="amis-renderer-box">
      <ToastComponent />
      <AlertComponent />

      {renderAmis(
        schema,
        // --- 第二个参数：数据与Props ---
        {
          data: {
            ...data
          }
        },
        // --- 第三个参数：环境变量 (Env) ---
        // 【关键修复】fetcher 必须放在这里，AMIS 才能找到它！
        {
          fetcher: amisFetcher,

          jumpTo: (to: string) => {
            navigate(to);
          },
          updateLocation: (to: string, replace?: boolean) => {
            if (replace) {
              navigate(to, { replace: true });
            } else {
              navigate(to);
            }
          },
          isCurrentUrl: (to: string) => {
            return location.pathname === to;
          },
          // 1. 将 type 改为 string (匹配 AMIS 定义)
          // 2. 使用 if/else 显式调用，避免 TS 索引报错
          notify: (type: string, msg: string) => {
            if (type === 'error') {
              toast.error(msg, '系统错误');
            } else if (type === 'success') {
              toast.success(msg, '系统消息');
            } else if (type === 'warning') {
              toast.warning(msg, '系统提示');
            } else {
              // 处理 'info' 或其他未知类型
              toast.info(msg, '系统消息');
            }
          },
          copy: (content: string) => {
            import('copy-to-clipboard').then(({ default: copy }) => {
              copy(content);
              toast.success('内容已复制到剪贴板');
            });
          },
          theme: 'cxd'
        }
      )}
    </div>
  );
};

export default AmisRenderer;
