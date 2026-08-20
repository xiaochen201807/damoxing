# 大模型项目 README

## 项目简介

大模型是一个基于 **AMIS 低代码框架** 的智能页面生成系统，支持通过 AI 工作流动态生成数据可视化页面。

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
- **系统库**: SQLite 3
- **业务库**: Oracle / 达梦 (多数据源多租户动态路由)
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
# 核心配置：编辑 server/config/datasources.json 配置您的 Oracle 或 达梦 (DaMeng) 业务数据源

# 前端配置
cd ../client
cp .env.example .env.development
# 编辑 .env.development 文件
```

### 数据库迁移与初始化

```bash
cd server
# 1. 迁移系统库 (SQLite)
npm run db:migrate

# 2. 初始化业务标准/业务规则相关业务库 (若使用 Oracle / 达梦)
# 请确保已在 server/config/datasources.json 中配置好相关库连接
# npm run db:init:oracle
# npm run db:init:dm

# 3. 独立初始化程序规则控制管理表 gjj_cxgzkz
# 支持 Oracle / 达梦 / PostgreSQL / openGauss / 人大金仓
npm run db:init:cxgzkz

# 4. 验证 cxgzkz 多数据源表结构与基础 CRUD 能力
npm run db:verify:cxgzkz
```

### cxgzkz 独立初始化文件

`cxgzkz` 没有和标准库/业务规则初始化 SQL 绑定，采用独立文件维护：

- Oracle: [server/data/init_cxgzkz_oracle.sql](/Users/xiaochen/Downloads/damoxing/server/data/init_cxgzkz_oracle.sql)
- 达梦: [server/data/init_cxgzkz_dm.sql](/Users/xiaochen/Downloads/damoxing/server/data/init_cxgzkz_dm.sql)
- PostgreSQL / openGauss / 人大金仓: [server/data/init_cxgzkz_pg_family.sql](/Users/xiaochen/Downloads/damoxing/server/data/init_cxgzkz_pg_family.sql)

对应脚本：

- 初始化: [server/scripts/init_cxgzkz_multids.js](/Users/xiaochen/Downloads/damoxing/server/scripts/init_cxgzkz_multids.js)
- 验证: [server/scripts/verify_cxgzkz_multids.js](/Users/xiaochen/Downloads/damoxing/server/scripts/verify_cxgzkz_multids.js)

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
├── client/                 # 前端项目 (React + TypeScript + AMIS)
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
├── server/                # 后端项目 (Node.js + Express)
│   ├── db/
│   │   ├── migrations/    # 数据库迁移脚本
│   │   └── migrate.js     # 迁移工具
│   ├── middleware/        # Express 中间件
│   ├── routes/            # API 路由
│   ├── utils/             # 工具函数
│   ├── .env.example       # 环境变量示例
│   └── package.json
│
├── schema-builder/        # 独立的 Python 模板生成工具
│   ├── templates/         # Jinja2 模板文件
│   │   ├── base/         # 基础模板（颜色、变量）
│   │   ├── components/   # 可复用组件
│   │   └── pages/        # 页面主模板
│   ├── configs/          # JSON 配置文件
│   ├── output/           # 生成的 Schema 输出
│   ├── build_schema.py   # 构建脚本
│   ├── template_helpers.py # 辅助函数
│   ├── requirements.txt  # Python 依赖
│   └── README.md         # 详细文档
│
└── docs/                  # 项目文档
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

### 4. 数据初始化与长期 Token 颁发（Java / 自动化运维集成）

系统支持一键聚合抽取「标准库 (ywbzk)」、「关键数据算法 (ywbz)」与「程序规则控制 (cxgzkz)」的 7 张核心表数据（Tabular 紧凑格式 + Gzip 压缩），供 Java 程序初始化入库。

#### 4.1 生成长期 Token (两种方式)

* **方式 A：命令行快速生成（推荐运维使用）**：
  ```bash
  cd server
  # 默认生成 10 年有效期的 admin 长期 Token
  npm run issue-token

  # 或带参数指定用户、机构码与有效期
  node scripts/issue_token.js --user=java_admin --jgbh=320100 --expires=3650d
  ```

* **方式 B：HTTP 接口在线生成（免登录白名单接口）**：
  ```bash
  curl -X POST http://localhost:3001/api/init-package/issue-token \
    -H "Content-Type: application/json" \
    -d '{
      "username": "java_init_service",
      "role": "admin",
      "jgbh": "",
      "zjgbh": "",
      "expiresIn": "3650d"
    }'
  ```

#### 4.2 Java 程序获取初始化数据包

携带上述生成的 Token 调用初始化接口：

```bash
TOKEN="<上一步生成的Token>"

curl -X POST http://localhost:3001/api/init-package/data \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept-Encoding: gzip" \
  -d '{
    "targetJgbh": "320100",
    "targetZjgbh": "32010001",
    "modules": ["ywbzk", "ywbz", "cxgzkz"]
  }'
```

#### 4.3 查看表执行依赖顺序元数据

```bash
curl -X GET http://localhost:3001/api/init-package/meta \
  -H "Authorization: Bearer ${TOKEN}"
```

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

### 通过 SSH 白名单主机推送 Harbor 镜像

当本机不能直接访问 Harbor，但可以 SSH 登录一台位于 Harbor IP 白名单内的服务器时，使用：

```text
push-multiarch-to-harbor-rgzn-ssh.sh
```

本机需要安装：

- `ssh`
- `curl`
- `skopeo`

推荐使用默认的 SSH SOCKS5 模式。脚本默认使用兼容性更好的 `socks5://` 代理写法，并保留 Harbor 原始域名、TLS/SNI 和认证 token realm：

```bash
SSH_TARGET=deploy@白名单服务器地址 \
SSH_PORT=22 \
SSH_KEY=~/.ssh/id_ed25519 \
SSH_PROXY_SCHEME=socks5 \
SRC=ghcr.io/xiaochen201807/damoxing:20260711-1601-x86 \
DST=harbor.sjgjj.cn:10443/gjjrgzn/damoxing:202607111601-gjjrgzn \
REGISTRY_AUTH_FILE=~/.config/containers/auth.json \
./push-multiarch-to-harbor-rgzn-ssh.sh
```

如果当前 `skopeo` 仍不支持通过 SOCKS 代理环境变量访问 Registry，可以改用 SSH 本地端口映射模式：

```bash
SSH_MODE=local \
SSH_TARGET=deploy@白名单服务器地址 \
SSH_PORT=22 \
SSH_KEY=~/.ssh/id_ed25519 \
SSH_LOCAL_PORT=18443 \
SRC=ghcr.io/xiaochen201807/damoxing:20260711-1601-x86 \
DST=harbor.sjgjj.cn:10443/gjjrgzn/damoxing:202607111601-gjjrgzn \
REGISTRY_AUTH_FILE=~/.config/containers/auth.json \
./push-multiarch-to-harbor-rgzn-ssh.sh
```

认证信息优先通过 `REGISTRY_AUTH_FILE` 提供，文件中应包含源 Registry 和 Harbor 的登录信息。也可以临时设置 `SRC_CREDS=user:token`、`DST_CREDS=user:password`，但不建议把真实密码直接写入脚本或 shell 历史。

如果不传 `DST`，脚本会从 `SRC` 提取 tag，移除其中的连字符，再追加 `DST_SUFFIX`（默认 `gjjrgzn`）：

```bash
SSH_TARGET=deploy@白名单服务器地址 \
SRC=ghcr.io/xiaochen201807/damoxing:20260711-1601-x86 \
DST_REPO=harbor.sjgjj.cn:10443/gjjrgzn/damoxing \
DST_SUFFIX=gjjrgzn \
./push-multiarch-to-harbor-rgzn-ssh.sh
```

脚本会在推送前检查 Harbor `/v2/` 连通性，使用 `skopeo copy --all` 保留多架构 manifest，推送完成后校验目标镜像，并在退出时自动关闭 SSH 隧道。

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

**感谢使用大模型系统！** 🎉
