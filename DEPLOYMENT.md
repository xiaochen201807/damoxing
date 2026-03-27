# 🚀 大模型项目部署指南

## 📋 目录

- [部署方案对比](#部署方案对比)
- [Docker 部署 (推荐)](#docker-部署-推荐)
- [传统部署](#传统部署)
- [数据库管理](#数据库管理)
- [常见问题](#常见问题)

---

## 🎯 部署方案对比

### Docker 部署 ✅ (推荐)

**优势**:
- ✅ **数据库自管理**: SQLite 通过 Volume 持久化,运维无需关心数据库细节
- ✅ **环境一致**: 开发、测试、生产环境完全一致
- ✅ **部署简单**: 一条命令启动所有服务
- ✅ **易于回滚**: 切换镜像版本即可
- ✅ **资源隔离**: 容器之间互不影响
- ✅ **易于扩展**: 未来添加 Redis、PostgreSQL 等只需修改配置

**劣势**:
- ❌ 需要学习 Docker 基础知识
- ❌ 服务器需要安装 Docker

### 传统部署

**优势**:
- ✅ 不需要 Docker 环境
- ✅ 直接访问文件系统

**劣势**:
- ❌ 环境配置复杂 (Node.js 版本、依赖版本)
- ❌ 需要手动管理多个服务 (PM2、Nginx)
- ❌ 数据库路径需要手动配置
- ❌ 回滚困难
- ❌ 扩展性差

---

## 🐳 Docker 部署 (推荐)

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 服务器内存 >= 1GB
- 磁盘空间 >= 5GB

### 部署架构

```
┌─────────────────────────────────────────┐
│           Docker Host (服务器)           │
│                                         │
│  ┌─────────────┐      ┌──────────────┐ │
│  │   Client    │      │    Server    │ │
│  │   (Nginx)   │◄────►│  (Express)   │ │
│  │   :80       │      │   :3001      │ │
│  └─────────────┘      └──────┬───────┘ │
│                              │         │
│                       ┌──────▼───────┐ │
│                       │   Volumes    │ │
│                       │  (数据持久化) │ │
│                       │ - database   │ │
│                       │ - logs       │ │
│                       │ - backups    │ │
│                       └──────────────┘ │
└─────────────────────────────────────────┘
```

### 1. 准备工作

#### 1.1 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker-compose --version
```

#### 1.2 克隆项目

```bash
git clone <your-repo-url> damoxing
cd damoxing
```

#### 1.3 配置环境变量

```bash
# 复制生产环境配置
cp .env.production server/.env

# 编辑配置 (修改域名、API Key 等)
nano server/.env
```

**重要配置项**:
```bash
# CORS 配置 (必须修改为实际域名)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Dify API (可选)
DIFY_API_KEY=app-your-key-here
```

### 2. 构建和启动

```bash
# 构建镜像
docker-compose build

# 启动服务 (后台运行)
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看服务状态
docker-compose ps
```

### 3. 初始化数据库

```bash
# 进入后端容器
docker-compose exec server sh

# 运行数据库迁移
npm run db:migrate

# 独立初始化程序规则控制管理表 gjj_cxgzkz
npm run db:init:cxgzkz

# 可选：验证 cxgzkz 在多数据源下的建表与基础 CRUD 能力
npm run db:verify:cxgzkz

# 退出容器
exit
```

说明：

- `npm run db:init:oracle` / `npm run db:init:dm` 仍用于标准库、业务规则等既有业务库对象初始化。
- `gjj_cxgzkz` 采用独立初始化文件，不和标准库/业务规则初始化脚本绑定。
- `npm run db:init:cxgzkz` 会按 `server/config/datasources.json` 中配置的数据源类型，分别执行对应的独立 SQL：
  - Oracle: `server/data/init_cxgzkz_oracle.sql`
  - 达梦: `server/data/init_cxgzkz_dm.sql`
  - PostgreSQL / openGauss / 人大金仓: `server/data/init_cxgzkz_pg_family.sql`

### 4. 验证部署

```bash
# 检查前端
curl http://localhost

# 检查后端 API
curl http://localhost:3001/api/system/menu

# 检查健康状态
curl http://localhost:3001/health/detailed
```

### 5. 配置反向代理 (生产环境)

如果需要 HTTPS 和域名访问,使用 Nginx 反向代理:

```nginx
# /etc/nginx/sites-available/damoxing
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

然后配置 SSL:
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## 🔧 Docker 常用命令

### 服务管理

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f server
docker-compose logs -f client

# 查看服务状态
docker-compose ps
```

### 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build

# 或者分步操作
docker-compose build
docker-compose down
docker-compose up -d
```

### 数据库管理

```bash
# 进入后端容器
docker-compose exec server sh

# 备份数据库
npm run db:backup

# 查看数据库
sqlite3 /app/data/database.sqlite

# 退出容器
exit
```

### 清理资源

```bash
# 停止并删除容器
docker-compose down

# 删除容器和数据卷 (危险!)
docker-compose down -v

# 清理未使用的镜像
docker image prune -a
```

---

## 📁 数据持久化

### Volume 映射

Docker Compose 配置了以下 Volume 映射:

```yaml
volumes:
  - ./data:/app/data          # 数据库文件
  - ./logs:/app/logs          # 日志文件
  - ./backups:/app/backups    # 备份文件
```

### 目录结构

```
damoxing/
├── data/                    # 数据库目录 (自动创建)
│   └── database.sqlite      # SQLite 数据库
├── logs/                    # 日志目录 (自动创建)
│   ├── combined-*.log
│   └── error-*.log
├── backups/                 # 备份目录 (自动创建)
│   └── database-*.sqlite
└── server/.env              # 环境变量
```

### 备份策略

**手动备份**:
```bash
# 备份数据库
docker-compose exec server npm run db:backup

# 备份整个 data 目录
tar -czf damoxing-backup-$(date +%Y%m%d).tar.gz data/ logs/
```

**自动备份** (使用 cron):
```bash
# 编辑 crontab
crontab -e

# 添加定时任务 (每天凌晨 3 点备份)
0 3 * * * cd /path/to/damoxing && docker-compose exec -T server npm run db:backup
```

---

## 🏗️ 传统部署 (不推荐)

如果无法使用 Docker,可以使用传统方式部署:

### 1. 安装依赖

```bash
# 后端
cd server
npm install --production
npm run db:migrate

# 前端
cd ../client
npm install
npm run build
```

### 2. 配置 PM2

```bash
# 安装 PM2
npm install -g pm2

# 启动后端
cd server
pm2 start index.js --name damoxing-api

# 保存配置
pm2 save
pm2 startup
```

### 3. 配置 Nginx

参考 `nginx.conf.example` 文件配置 Nginx。

详细步骤见 [nginx.conf.example](./nginx.conf.example)。

---

## 🗄️ 数据库管理

### SQLite 特点

- ✅ **零配置**: 无需安装数据库服务器
- ✅ **文件存储**: 数据库就是一个文件
- ✅ **轻量级**: 适合中小型应用
- ⚠️ **并发限制**: 不适合高并发写入

### 数据库迁移

```bash
# Docker 环境
docker-compose exec server npm run db:migrate

# 传统环境
cd server
npm run db:migrate
```

### 数据库备份

```bash
# 使用内置脚本
docker-compose exec server npm run db:backup

# 手动备份
cp data/database.sqlite backups/database-$(date +%Y%m%d).sqlite
```

### 数据库恢复

```bash
# 使用内置脚本
docker-compose exec server npm run db:restore

# 手动恢复
cp backups/database-20250101.sqlite data/database.sqlite
docker-compose restart server
```

---

## ❓ 常见问题

### Q1: 数据库文件在哪里?

**Docker 部署**: `./data/database.sqlite` (宿主机路径)  
**传统部署**: `./server/database.sqlite`

### Q2: 如何修改端口?

编辑 `docker-compose.yml`:
```yaml
ports:
  - "8080:80"      # 前端改为 8080
  - "8001:3001"    # 后端改为 8001
```

### Q3: 如何查看日志?

```bash
# Docker
docker-compose logs -f server

# 传统部署
tail -f server/logs/combined-*.log
```

### Q4: 数据库迁移失败怎么办?

```bash
# 检查数据库文件权限
ls -la data/database.sqlite

# 重新运行迁移
docker-compose exec server npm run db:migrate

# 如果还是失败,删除数据库重新初始化
rm data/database.sqlite
docker-compose restart server
docker-compose exec server npm run db:migrate
```

### Q5: 如何更新到新版本?

```bash
# 1. 备份数据库
docker-compose exec server npm run db:backup

# 2. 拉取新代码
git pull

# 3. 重新构建
docker-compose up -d --build

# 4. 运行迁移 (如果有新的)
docker-compose exec server npm run db:migrate
```

### Q6: 容器无法启动?

```bash
# 查看日志
docker-compose logs server
docker-compose logs client

# 检查端口占用
lsof -i :80
lsof -i :3001

# 重新构建
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 📊 性能监控

### Docker Stats

```bash
# 查看容器资源使用
docker stats damoxing-server damoxing-client
```

### 健康检查

```bash
# 检查服务健康状态
docker-compose ps

# 详细健康信息
curl http://localhost:3001/health/detailed
```

---

## 🎉 总结

### 推荐部署方案

| 场景 | 推荐方案 |
|------|---------|
| **生产环境** | Docker + Nginx 反向代理 + SSL |
| **测试环境** | Docker Compose |
| **开发环境** | 本地运行 (npm run dev) |

### 数据库管理建议

- ✅ 使用 Docker Volume 持久化数据库
- ✅ 定期备份 (每天凌晨)
- ✅ 保留最近 7 天的备份
- ✅ 重要更新前手动备份

### 安全建议

- ✅ 修改默认 CORS 配置
- ✅ 配置 HTTPS (Let's Encrypt)
- ✅ 定期更新依赖 (`npm audit`)
- ✅ 限制数据库文件访问权限

---

**部署愉快!** 🚀

如有问题,请查看项目 [README.md](./README.md) 或提交 Issue。
