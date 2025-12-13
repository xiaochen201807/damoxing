// client/src/components/AmisRenderer.tsx
import React from 'react';
import { render as renderAmis } from 'amis';
import { ToastComponent, AlertComponent, toast } from 'amis-ui';
import { fetcher } from '../utils/fetcher';
import { useNavigate, useLocation } from 'react-router-dom';

interface Props {
  schema: any;
  data?: any;
}

const AmisRenderer: React.FC<Props> = ({ schema, data = {} }) => {
  const navigate = useNavigate();
  const location = useLocation();

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
          fetcher: fetcher as any, // <--- 移到这里

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