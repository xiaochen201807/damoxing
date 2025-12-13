# 大魔星项目 README

## 项目简介

大魔星是一个基于 **AMIS 低代码框架** 的智能页面生成系统，支持通过 AI 工作流动态生成数据可视化页面。

### 核心特性

- 🎨 **低代码开发** - 基于 AMIS 框架，快速构建数据可视化页面
- 🤖 **AI 智能生成** - 集成 Dify AI，支持自然语言生成页面
- 🔧 **灵活配置** - 每个页面独立配置工作流，支持多场景应用
- 🔒 **安全可靠** - 完善的安全防护和错误处理机制
- 📊 **日志监控** - Winston 日志系统，问题快速定位

---

## 技术栈

### 前端
- **框架**: React 17 + TypeScript
- **构建工具**: Vite 5
- **UI 框架**: AMIS 6.13
- **状态管理**: MobX 6
- **路由**: React Router 6

### 后端
- **运行时**: Node.js
- **框架**: Express 4
- **数据库**: SQLite 3
- **日志**: Winston
- **安全**: Helmet + Joi + Rate Limit

---

## 快速开始

### 环境要求

- Node.js >= 16
- npm >= 8

### 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 配置环境变量

```bash
# 后端配置
cd server
cp .env.example .env
# 编辑 .env 文件，配置 Dify API（可选）

# 前端配置
cd ../client
cp .env.example .env.development
# 编辑 .env.development 文件
```

### 数据库迁移

```bash
cd server
npm run db:migrate
```

### 启动服务

```bash
# 启动后端服务（端口 3001）
cd server
npm start

# 启动前端服务（端口 3000）
cd ../client
npm run dev
```

访问 http://localhost:3000

---

## 项目结构

```
damoxing/
├── client/                 # 前端项目
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── pages/         # 页面组件
│   │   ├── layout/        # 布局组件
│   │   ├── routes/        # 路由配置
│   │   ├── types/         # TypeScript 类型定义
│   │   └── utils/         # 工具函数
│   ├── .env.development   # 开发环境配置
│   └── package.json
│
└── server/                # 后端项目
    ├── db/
    │   ├── migrations/    # 数据库迁移脚本
    │   └── migrate.js     # 迁移工具
    ├── middleware/        # Express 中间件
    ├── routes/            # API 路由
    ├── utils/             # 工具函数
    ├── .env.example       # 环境变量示例
    └── package.json
```

---

## 核心功能

### 1. Dify 工作流配置

支持为每个页面配置独立的 AI 工作流：

```bash
# 创建配置
curl -X POST http://localhost:3001/api/dify/config \
  -H "Content-Type: application/json" \
  -d '{
    "page_key": "dashboard",
    "workflow_name": "数据分析工作流",
    "api_url": "https://api.dify.ai/v1",
    "api_key": "app-xxx"
  }'
```

### 2. AI 页面生成

```bash
# 生成页面
curl -X POST http://localhost:3001/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "生成一个贷款风险分析页面",
    "pageId": "loan_risk"
  }'
```

### 3. 动态页面渲染

系统自动根据 `pageId` 加载对应的 AMIS Schema 并渲染页面。

---

## 安全特性

- ✅ **Helmet 安全头** - CSP, HSTS, X-Frame-Options
- ✅ **API 限流** - 全局 15分钟100次，AI接口 1分钟10次
- ✅ **参数验证** - Joi schema 验证所有输入
- ✅ **SQL 注入防护** - 自动检测并拦截恶意模式
- ✅ **Error Boundary** - 前端错误捕获和降级 UI

---

## 日志系统

日志文件位置：`server/logs/`

- `combined-YYYY-MM-DD.log` - 所有日志
- `error-YYYY-MM-DD.log` - 仅错误日志

日志自动轮转，保留 14 天。

---

## 开发指南

### 添加新页面

1. 在数据库中添加菜单项
2. 创建页面模板或配置 Dify 工作流
3. 前端会自动加载并渲染

### 添加新 API

1. 在 `server/routes/` 创建路由文件
2. 添加参数验证 schema
3. 在 `server/index.js` 注册路由

### 数据库迁移

```bash
# 创建新迁移
# 在 server/db/migrations/ 创建新文件
# 格式：003_description.js

# 执行迁移
npm run db:migrate

# 回滚迁移
npm run db:rollback
```

---

## 部署

### 生产环境构建

```bash
# 构建前端
cd client
npm run build

# 构建产物在 client/dist/
```

### 环境变量

生产环境需要配置：

```bash
# 后端 .env
NODE_ENV=production
PORT=3001
DIFY_API_URL=https://api.dify.ai/v1
DIFY_API_KEY=your-production-key

# 前端 .env.production
VITE_API_BASE_URL=https://api.yourdomain.com
```

---

## 性能优化

- ✅ 代码分割 - AMIS、React、MobX 独立打包
- ✅ 懒加载 - 路由级别懒加载
- ✅ 缓存 - HTTP 缓存和 AI 响应缓存
- ✅ 压缩 - Gzip 压缩

---

## 故障排查

### 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3001
# 杀死进程
kill -9 <PID>
```

### 数据库迁移失败

```bash
# 检查数据库文件
ls -la server/database.sqlite

# 重新运行迁移
cd server
npm run db:migrate
```

### 前端类型错误

```bash
# 重新安装依赖
cd client
rm -rf node_modules package-lock.json
npm install
```

---

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 许可证

MIT License

---

## 联系方式

- 项目主页: [GitHub](https://github.com/yourusername/damoxing)
- 问题反馈: [Issues](https://github.com/yourusername/damoxing/issues)

---

## 更新日志

### v1.0.0 (2025-12-13)

**新功能**:
- ✅ Dify 配置数据库化
- ✅ 完善的错误处理和日志系统
- ✅ API 安全防护（限流、验证、SQL注入防护）
- ✅ TypeScript 类型定义
- ✅ 前端性能优化

**优化**:
- ✅ 环境变量管理规范化
- ✅ 代码分割和懒加载
- ✅ 数据库迁移机制

---

**感谢使用大魔星系统！** 🎉
