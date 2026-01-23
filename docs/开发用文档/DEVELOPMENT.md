# 开发指南

## 项目概述

大模型是一个基于 AMIS 低代码框架的智能页面生成系统，本文档提供开发环境搭建、代码规范和开发流程指南。

---

## 开发环境搭建

### 1. 前置要求

- Node.js >= 16.x
- npm >= 8.x
- Git
- 代码编辑器（推荐 VS Code）

### 2. 克隆项目

```bash
git clone https://github.com/yourusername/damoxing.git
cd damoxing
```

### 3. 安装依赖

```bash
# 后端依赖
cd server
npm install

# 前端依赖
cd ../client
npm install --legacy-peer-deps
```

**注意**: 前端使用 `--legacy-peer-deps` 是因为 AMIS 内部依赖与 React 17 的 peer dependency 警告。

### 4. 配置环境变量

```bash
# 后端
cd server
cp .env.example .env
# 编辑 .env 文件

# 前端
cd ../client
cp .env.example .env.development
# 编辑 .env.development 文件
```

### 5. 初始化数据库

```bash
cd server
npm run db:migrate
```

### 6. 启动开发服务器

```bash
# 终端1: 启动后端
cd server
npm start

# 终端2: 启动前端
cd client
npm run dev
```

访问 http://localhost:3000

---

## 项目结构

```
damoxing/
├── client/                    # 前端项目
│   ├── src/
│   │   ├── components/       # React 组件
│   │   │   ├── AmisRenderer.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── pages/            # 页面组件
│   │   │   └── AutoDashboard.tsx
│   │   ├── layout/           # 布局组件
│   │   │   └── MainLayout.tsx
│   │   ├── routes/           # 路由配置
│   │   ├── types/            # TypeScript 类型定义
│   │   │   ├── api.ts
│   │   │   ├── amis.ts
│   │   │   └── models.ts
│   │   └── utils/            # 工具函数
│   │       └── fetcher.ts
│   ├── vite.config.ts        # Vite 配置
│   └── package.json
│
├── server/                    # 后端项目
│   ├── db/
│   │   ├── db.js             # 数据库初始化
│   │   ├── migrate.js        # 迁移工具
│   │   └── migrations/       # 迁移脚本
│   ├── middleware/           # Express 中间件
│   │   ├── errorHandler.js
│   │   ├── security.js
│   │   └── validator.js
│   ├── routes/               # API 路由
│   │   ├── ai.js
│   │   └── dify-config.js
│   ├── utils/                # 工具函数
│   │   └── logger.js
│   ├── index.js              # 入口文件
│   └── package.json
│
├── docs/                      # 文档
│   ├── API.md
│   └── DEPLOYMENT.md
│
└── README.md
```

---

## 代码规范

### TypeScript/JavaScript

- 使用 **TypeScript** 编写前端代码
- 使用 **ES6+** 语法
- 遵循 **Prettier** 格式化规则
- 遵循 **ESLint** 规则

### 命名规范

- **文件名**: PascalCase (组件) 或 camelCase (工具)
  - `AmisRenderer.tsx`
  - `fetcher.ts`
- **组件名**: PascalCase
  - `ErrorBoundary`
- **函数名**: camelCase
  - `fetchData()`
- **常量**: UPPER_SNAKE_CASE
  - `BASE_URL`
- **类型/接口**: PascalCase
  - `ApiResponse<T>`

### 代码格式化

使用 Prettier 自动格式化：

```bash
# 格式化所有文件
npm run format

# 检查格式
npm run format:check
```

---

## 开发流程

### 1. 创建新功能分支

```bash
git checkout -b feature/your-feature-name
```

### 2. 开发

按照以下步骤开发新功能：

#### 前端开发

1. **创建类型定义** (`client/src/types/`)
2. **创建组件** (`client/src/components/` 或 `client/src/pages/`)
3. **添加路由** (`client/src/routes/`)
4. **测试功能**

#### 后端开发

1. **设计 API 接口**
2. **创建验证 schema** (`server/middleware/validator.js`)
3. **创建路由处理器** (`server/routes/`)
4. **注册路由** (`server/index.js`)
5. **测试 API**

### 3. 数据库变更

如需修改数据库结构：

```bash
# 创建新迁移文件
# server/db/migrations/003_your_migration.js

# 执行迁移
npm run db:migrate

# 如需回滚
npm run db:rollback
```

### 4. 提交代码

```bash
git add .
git commit -m "feat: 添加新功能"
git push origin feature/your-feature-name
```

### 5. 创建 Pull Request

在 GitHub 上创建 PR，等待代码审查。

---

## 常用开发任务

### 添加新的 API 端点

1. **创建验证 schema** (`server/middleware/validator.js`):
```javascript
schemas.newEndpoint = Joi.object({
  field: Joi.string().required()
});
```

2. **创建路由** (`server/routes/your-route.js`):
```javascript
router.post('/endpoint', validate(schemas.newEndpoint), (req, res) => {
  // 处理逻辑
});
```

3. **注册路由** (`server/index.js`):
```javascript
const yourRoutes = require('./routes/your-route');
app.use('/api/your', yourRoutes);
```

### 添加新的前端页面

1. **创建类型** (`client/src/types/`):
```typescript
export interface YourData {
  id: number;
  name: string;
}
```

2. **创建页面组件** (`client/src/pages/YourPage.tsx`):
```typescript
import React from 'react';
import type { YourData } from '../types';

const YourPage: React.FC = () => {
  return <div>Your Page</div>;
};

export default YourPage;
```

3. **添加路由** (`client/src/routes/index.tsx`):
```typescript
{
  path: '/your-page',
  element: <YourPage />
}
```

### 添加数据库迁移

创建 `server/db/migrations/003_description.js`:

```javascript
module.exports = {
  up: (db) => {
    return new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE new_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
  
  down: (db) => {
    return new Promise((resolve, reject) => {
      db.run('DROP TABLE new_table', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};
```

---

## 调试技巧

### 前端调试

1. **使用 React DevTools**
2. **使用 Chrome DevTools**
3. **查看网络请求**:
   - 打开 Network 面板
   - 筛选 XHR 请求
   - 查看请求/响应

### 后端调试

1. **查看日志**:
```bash
tail -f server/logs/combined-$(date +%Y-%m-%d).log
```

2. **使用 console.log**:
```javascript
console.log('[DEBUG]', data);
```

3. **使用 VS Code 调试器**:
   - 在 `server/index.js` 设置断点
   - 按 F5 启动调试

---

## 测试

### 运行测试

```bash
# 前端测试
cd client
npm test

# 后端测试
cd server
npm test
```

### 编写测试

**前端组件测试** (`client/src/components/__tests__/`):
```typescript
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

test('renders error message', () => {
  // 测试逻辑
});
```

**后端 API 测试** (`server/__tests__/`):
```javascript
const request = require('supertest');
const app = require('../index');

describe('GET /api/system/menu', () => {
  it('should return menu items', async () => {
    const res = await request(app).get('/api/system/menu');
    expect(res.statusCode).toBe(200);
  });
});
```

---

## 常见问题

### Q1: npm install 失败

**解决**:
```bash
# 清理缓存
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Q2: TypeScript 类型错误

**解决**:
- 检查 `tsconfig.json` 配置
- 确保导入了正确的类型
- 运行 `npm run type-check`

### Q3: 数据库迁移失败

**解决**:
```bash
# 回滚并重试
npm run db:rollback
npm run db:migrate
```

---

## 性能优化建议

1. **使用 React.memo** 避免不必要的重渲染
2. **使用 useMemo/useCallback** 缓存计算结果
3. **代码分割** 已在 Vite 配置中实现
4. **懒加载路由** 使用 React.lazy
5. **优化图片** 使用 WebP 格式

---

## 安全最佳实践

1. **永远不要提交 .env 文件**
2. **使用参数验证** (Joi)
3. **防止 SQL 注入** (已实现)
4. **使用 HTTPS** (生产环境)
5. **定期更新依赖** (`npm audit fix`)

---

## 有用的命令

```bash
# 开发
npm run dev          # 启动开发服务器
npm start            # 启动生产服务器
npm run build        # 构建生产版本

# 数据库
npm run db:migrate   # 执行迁移
npm run db:rollback  # 回滚迁移

# 代码质量
npm run lint         # 运行 ESLint
npm run format       # 格式化代码
npm test             # 运行测试

# 部署
pm2 start index.js   # 使用 PM2 启动
pm2 logs             # 查看日志
pm2 restart all      # 重启服务
```

---

## 参考资源

- [AMIS 官方文档](https://aisuda.bce.baidu.com/amis/zh-CN/docs/index)
- [React 文档](https://react.dev/)
- [Vite 文档](https://vitejs.dev/)
- [Express 文档](https://expressjs.com/)
- [TypeScript 文档](https://www.typescriptlang.org/)

---

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

**代码审查标准**:
- 代码符合规范
- 通过所有测试
- 添加必要的文档
- 无安全漏洞

---

**祝开发愉快！** 🚀
