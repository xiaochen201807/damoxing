# 系统架构设计文档

## 系统概述

大魔星是一个基于 AMIS 低代码框架的智能页面生成系统，通过集成 Dify AI 工作流，实现自然语言到可视化页面的自动生成。

---

## 技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                      用户浏览器                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  React 17    │  │  AMIS 6.13   │  │  MobX 6      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │ HTTP
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Nginx (可选)                          │
│              静态文件服务 + API 反向代理                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Express 后端服务                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  中间件层                                         │  │
│  │  • Helmet (安全头)                                │  │
│  │  • Rate Limit (限流)                              │  │
│  │  • Joi Validator (参数验证)                       │  │
│  │  • Winston Logger (日志)                          │  │
│  │  • Error Handler (错误处理)                       │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  路由层                                           │  │
│  │  • /api/system/menu (系统菜单)                    │  │
│  │  • /api/page/:key (页面模板)                      │  │
│  │  • /api/dify/config (Dify配置)                    │  │
│  │  • /api/ai/generate (AI生成)                      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐      ┌──────────────────────┐
│   SQLite 数据库       │      │   Dify AI 服务       │
│  • sys_menu          │      │  • Chat Messages     │
│  • sys_page_template │      │  • Workflow API      │
│  • sys_dify_config   │      └──────────────────────┘
│  • migrations        │
└──────────────────────┘
```

---

## 前端架构

### 技术栈

- **框架**: React 17 (保持与 AMIS 兼容)
- **构建工具**: Vite 5
- **UI 框架**: AMIS 6.13 (低代码框架)
- **状态管理**: MobX 6
- **路由**: React Router 6
- **类型系统**: TypeScript 4.9

### 目录结构

```
client/src/
├── components/          # 可复用组件
│   ├── AmisRenderer.tsx    # AMIS 渲染器
│   └── ErrorBoundary.tsx   # 错误边界
├── pages/              # 页面组件
│   └── AutoDashboard.tsx   # 动态页面
├── layout/             # 布局组件
│   └── MainLayout.tsx      # 主布局
├── routes/             # 路由配置
│   └── index.tsx
├── types/              # TypeScript 类型
│   ├── api.ts              # API 类型
│   ├── amis.ts             # AMIS 类型
│   └── models.ts           # 数据模型
└── utils/              # 工具函数
    └── fetcher.ts          # HTTP 请求
```

### 核心组件

#### 1. AmisRenderer

AMIS 渲染器，负责将 JSON Schema 渲染成页面。

**职责**:
- 接收 AMIS Schema
- 配置 fetcher (HTTP 请求)
- 配置路由跳转
- 配置通知系统

#### 2. ErrorBoundary

React 错误边界，捕获组件树中的错误。

**职责**:
- 捕获渲染错误
- 显示降级 UI
- 记录错误日志

#### 3. AutoDashboard

动态页面组件，根据 URL 参数加载不同的页面模板。

**流程**:
1. 从 URL 获取 `pageId`
2. 调用 `/api/page/:pageId` 获取 Schema
3. 使用 AmisRenderer 渲染页面

---

## 后端架构

### 技术栈

- **运行时**: Node.js 16+
- **框架**: Express 4
- **数据库**: SQLite 3
- **日志**: Winston
- **验证**: Joi
- **安全**: Helmet + Rate Limit

### 分层架构

```
┌─────────────────────────────────────┐
│         中间件层 (Middleware)        │
│  • 安全防护 (Helmet, Rate Limit)    │
│  • 日志记录 (Winston)               │
│  • 参数验证 (Joi)                   │
│  • 错误处理 (Error Handler)         │
└─────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────┐
│          路由层 (Routes)             │
│  • 系统路由 (system)                │
│  • Dify 配置路由 (dify-config)      │
│  • AI 路由 (ai)                     │
└─────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────┐
│        数据访问层 (Database)         │
│  • SQLite 连接                      │
│  • 数据库迁移                        │
└─────────────────────────────────────┘
```

### 核心模块

#### 1. 中间件系统

**安全中间件** (`middleware/security.js`):
- Helmet: 设置安全 HTTP 头
- Rate Limit: 全局限流 (15分钟100次)
- AI Limiter: AI 接口限流 (1分钟10次)
- SQL 注入防护: 检测恶意 SQL 模式

**验证中间件** (`middleware/validator.js`):
- Joi Schema 定义
- 自动参数验证
- 错误格式化

**日志中间件** (`utils/logger.js`):
- Winston 配置
- 日志分级 (error, warn, info, http, debug)
- 日志轮转 (每天，保留14天)
- HTTP 请求自动记录

**错误处理** (`middleware/errorHandler.js`):
- 404 处理
- 全局错误捕获
- 错误日志记录
- 统一错误响应格式

#### 2. 数据库设计

**表结构**:

```sql
-- 系统菜单
CREATE TABLE sys_menu (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 页面模板
CREATE TABLE sys_page_template (
  id INTEGER PRIMARY KEY,
  page_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dify 配置
CREATE TABLE sys_dify_config (
  id INTEGER PRIMARY KEY,
  page_key TEXT UNIQUE NOT NULL,
  workflow_name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 迁移记录
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**索引**:
- `idx_menu_path` on `sys_menu(path)`
- `idx_page_key` on `sys_page_template(page_key)`
- `idx_dify_page_key` on `sys_dify_config(page_key)`
- `idx_dify_enabled` on `sys_dify_config(enabled)`

---

## 核心流程

### 1. 页面加载流程

```
用户访问 /dashboard/loan_risk
         ▼
MainLayout 加载系统菜单
         ▼
AutoDashboard 组件挂载
         ▼
从 URL 提取 pageId = "loan_risk"
         ▼
调用 GET /api/page/loan_risk
         ▼
后端从 sys_page_template 查询
         ▼
返回 AMIS Schema JSON
         ▼
AmisRenderer 渲染页面
         ▼
页面展示给用户
```

### 2. AI 生成流程

```
用户输入查询 "生成贷款风险分析页面"
         ▼
前端调用 POST /api/ai/generate
  - query: "生成贷款风险分析页面"
  - pageId: "loan_risk"
         ▼
后端查询 sys_dify_config (pageId)
         ▼
找到配置? ─── 是 ──▶ 使用数据库配置
    │
    否
    ▼
使用环境变量 DIFY_API_KEY
    │
    无配置?
    ▼
返回 Mock 数据
         ▼
调用 Dify API (Workflow/Chat)
         ▼
解析 AI 响应 (JSON)
         ▼
返回 AMIS Schema
         ▼
前端渲染页面
```

### 3. Dify 配置管理流程

```
管理员创建配置
         ▼
POST /api/dify/config
  - page_key: "dashboard"
  - workflow_name: "数据分析"
  - api_url: "https://api.dify.ai/v1"
  - api_key: "app-xxx"
         ▼
Joi 参数验证
         ▼
检查 page_key 唯一性
         ▼
插入 sys_dify_config 表
         ▼
返回创建的配置
         ▼
后续 AI 请求自动使用此配置
```

---

## 安全设计

### 1. 多层防护

```
请求 ──▶ Helmet (安全头)
      ──▶ Rate Limit (限流)
      ──▶ SQL 注入检测
      ──▶ Joi 参数验证
      ──▶ 业务逻辑
```

### 2. 安全措施

- **HTTPS**: 生产环境强制 HTTPS
- **CORS**: 配置允许的源
- **CSP**: Content Security Policy
- **限流**: 防止暴力攻击
- **参数验证**: 防止注入攻击
- **错误处理**: 不泄露敏感信息

---

## 性能优化

### 1. 前端优化

- **代码分割**: Vite 配置 manualChunks
  - amis-vendor: AMIS 相关库
  - react-vendor: React 相关库
  - mobx-vendor: MobX 相关库
- **懒加载**: 路由级别懒加载
- **缓存**: 静态资源长期缓存
- **Gzip**: Nginx 压缩

### 2. 后端优化

- **数据库索引**: 关键字段建立索引
- **连接池**: SQLite 连接复用
- **日志异步**: Winston 异步写入
- **PM2 Cluster**: 多进程负载均衡

---

## 扩展性设计

### 1. 水平扩展

```
Nginx 负载均衡
    ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Node 1  │  │ Node 2  │  │ Node 3  │
└─────────┘  └─────────┘  └─────────┘
    │            │            │
    └────────────┴────────────┘
              ▼
        共享 SQLite
    (或升级到 PostgreSQL)
```

### 2. 功能扩展

- **插件系统**: 支持自定义 AMIS 组件
- **多租户**: 添加租户隔离
- **权限系统**: RBAC 权限控制
- **缓存层**: Redis 缓存 AI 响应

---

## 监控和运维

### 1. 日志系统

```
Winston Logger
    ▼
┌──────────────┐  ┌──────────────┐
│ error.log    │  │ combined.log │
│ (错误日志)    │  │ (所有日志)    │
└──────────────┘  └──────────────┘
    ▼                  ▼
日志轮转 (每天)    保留 14 天
```

### 2. 监控指标

- **系统指标**: CPU, 内存, 磁盘
- **应用指标**: 请求量, 响应时间, 错误率
- **业务指标**: AI 调用次数, 页面生成数

---

## 部署架构

### 生产环境

```
Internet
    ▼
Nginx (80/443)
    │
    ├─▶ 静态文件 (client/dist/)
    │
    └─▶ API 代理 ──▶ Express (3001)
                        │
                        ├─▶ SQLite
                        └─▶ Dify API
```

---

## 技术选型理由

| 技术 | 选型理由 |
|------|----------|
| React 17 | AMIS 兼容性要求 |
| AMIS | 低代码框架，快速构建页面 |
| Vite | 快速开发体验，优秀的构建性能 |
| Express | 轻量级，生态丰富 |
| SQLite | 简单部署，适合中小规模 |
| Winston | 功能完善的日志库 |
| Joi | 强大的参数验证 |

---

## 未来规划

1. **升级到 PostgreSQL** - 支持更大规模
2. **添加 Redis 缓存** - 提升性能
3. **实现权限系统** - RBAC
4. **添加单元测试** - 提升代码质量
5. **CI/CD 集成** - 自动化部署

---

**文档版本**: v1.0  
**更新时间**: 2025-12-13
