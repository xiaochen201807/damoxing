# 🐳 Docker 部署手册

## 目录

- [部署概述](#部署概述)
- [前置要求](#前置要求)
- [快速部署](#快速部署)
- [详细部署步骤](#详细部署步骤)
- [配置说明](#配置说明)
- [服务管理](#服务管理)
- [数据管理](#数据管理)
- [生产环境部署](#生产环境部署)
- [故障排查](#故障排查)
- [性能优化](#性能优化)

---

## 部署概述

### 架构说明

本项目采用 **单容器部署方案**,在一个 Docker 容器中运行 Nginx 和 Node.js 两个服务,通过 Supervisor 进行进程管理。

```
┌─────────────────────────────────────────┐
│           Docker Container              │
│                                         │
│  ┌─────────────┐      ┌──────────────┐ │
│  │   Nginx     │      │   Node.js    │ │
│  │   (前端)     │◄────►│   (后端)      │ │
│  │   :80       │      │   :3001      │ │
│  └─────────────┘      └──────┬───────┘ │
│                              │         │
│         Supervisor (进程管理) │         │
│                       ┌──────▼───────┐ │
│                       │   Volumes    │ │
│                       │  (数据持久化) │ │
│                       │ - database   │ │
│                       │ - logs       │ │
│                       │ - backups    │ │
│                       └──────────────┘ │
└─────────────────────────────────────────┘
         ▲
         │ 端口映射: 80 → 80
         │
    外部访问
```

### 为什么选择 Docker?

✅ **环境一致性** - 开发、测试、生产环境完全一致  
✅ **快速部署** - 一条命令启动所有服务  
✅ **数据持久化** - SQLite 数据库通过 Volume 自动管理  
✅ **易于维护** - 简化服务器配置和依赖管理  
✅ **易于回滚** - 切换镜像版本即可回滚  
✅ **资源隔离** - 容器之间互不影响  

---

## 前置要求

### 系统要求

- **操作系统**: Linux (Ubuntu/Debian/CentOS) 或 macOS
- **内存**: ≥ 1GB
- **磁盘空间**: ≥ 5GB
- **网络**: 能够访问 Docker Hub 和 npm registry

### 软件要求

- **Docker**: 20.10 或更高版本
- **Docker Compose**: 2.0 或更高版本

### 安装 Docker

#### Ubuntu/Debian

```bash
# 使用官方安装脚本
curl -fsSL https://get.docker.com | sh

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER

# 重新加载用户组
newgrp docker

# 验证安装
docker --version
docker-compose --version
```

#### CentOS

```bash
# 安装依赖
sudo yum install -y yum-utils

# 添加 Docker 仓库
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装 Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

#### macOS

```bash
# 下载并安装 Docker Desktop
# https://www.docker.com/products/docker-desktop

# 验证安装
docker --version
docker-compose --version
```

---

## 快速部署

### 使用自动部署脚本

项目提供了自动化部署脚本,适合快速部署:

```bash
# 1. 克隆项目
git clone <your-repo-url> damoxing
cd damoxing

# 2. 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

脚本会自动完成以下操作:
- ✅ 检查 Docker 环境
- ✅ 创建必要的目录
- ✅ 构建前端(如果未构建)
- ✅ 初始化数据库
- ✅ 构建 Docker 镜像
- ✅ 启动服务
- ✅ 健康检查

部署完成后,访问 http://localhost 即可使用系统。

---

## 详细部署步骤

如果需要手动控制部署流程,请按以下步骤操作:

### 步骤 1: 准备项目

```bash
# 克隆项目
git clone <your-repo-url> damoxing
cd damoxing

# 创建必要的目录
mkdir -p data logs backups
```

### 步骤 2: 配置环境变量

```bash
# 复制生产环境配置模板
cp .env.production server/.env

# 编辑配置文件
nano server/.env
```

**必须修改的配置项**:

```bash
# CORS 配置 - 修改为实际域名
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Dify API 配置 (如果使用 AI 功能)
DIFY_API_KEY=app-your-key-here
```

**完整配置示例**:

```bash
# 服务器配置
NODE_ENV=production
PORT=3001

# 数据库路径 (容器内路径,无需修改)
DB_PATH=/app/data/database.sqlite

# CORS 配置 (根据实际域名修改)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Dify API 配置 (可选)
DIFY_API_URL=https://api.dify.ai/v1
DIFY_API_KEY=app-xxxxxxxxxxxxxxxx

# 日志配置
LOG_LEVEL=info
LOG_DIR=/app/logs
```

### 步骤 3: 构建 Docker 镜像

```bash
# 构建镜像
docker-compose build

# 查看构建的镜像
docker images | grep damoxing
```

### 步骤 4: 初始化数据库

```bash
# 启动临时容器运行数据库迁移
docker-compose run --rm app npm run db:migrate

# 验证数据库文件已创建
ls -lh data/database.sqlite
```

### 步骤 5: 启动服务

```bash
# 后台启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 步骤 6: 验证部署

```bash
# 检查前端
curl http://localhost

# 检查后端 API
curl http://localhost/api/system/menu

# 检查健康状态
curl http://localhost/health
```

如果所有检查都返回正常响应,说明部署成功! 🎉

---

## 配置说明

### docker-compose.yml 配置

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: damoxing-app
    restart: unless-stopped
    ports:
      - "80:80"              # 前端端口映射
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_PATH=/app/data/database.sqlite
      - LOG_DIR=/app/logs
      - CORS_ORIGIN=http://localhost
    volumes:
      - ./data:/app/data     # 数据库持久化
      - ./logs:/app/logs     # 日志持久化
      - ./backups:/app/backups  # 备份持久化
      - ./server/.env:/app/.env:ro  # 环境变量文件
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
```

### Dockerfile 说明

项目使用多阶段构建:

**阶段 1: 构建前端**
```dockerfile
FROM node:18-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --only=production
COPY client/ ./
RUN npm run build
```

**阶段 2: 生产环境**
```dockerfile
FROM node:18-alpine
RUN apk add --no-cache nginx sqlite supervisor
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ ./
COPY --from=frontend-builder /app/client/dist /usr/share/nginx/html
COPY nginx-single.conf /etc/nginx/http.d/default.conf
COPY supervisord.conf /etc/supervisord.conf
```

### Supervisor 配置

Supervisor 负责管理容器内的多个进程:

```ini
[supervisord]
nodaemon=true
user=root

# Nginx 进程
[program:nginx]
command=/usr/sbin/nginx -g 'daemon off;'
autostart=true
autorestart=true
priority=10

# Node.js 后端进程
[program:nodejs]
command=node /app/index.js
directory=/app
autostart=true
autorestart=true
priority=20
environment=NODE_ENV="production",PORT="3001"
```

### Nginx 配置

Nginx 作为反向代理,处理静态文件和 API 请求:

```nginx
server {
    listen 80;
    server_name localhost;

    # Gzip 压缩
    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript;

    # API 反向代理到 Node.js
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 前端静态文件
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 服务管理

### 常用命令

#### 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 启动并查看日志
docker-compose up
```

#### 停止服务

```bash
# 停止服务
docker-compose down

# 停止服务并删除数据卷 (危险!)
docker-compose down -v
```

#### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启单个服务
docker-compose restart app
```

#### 查看状态

```bash
# 查看服务状态
docker-compose ps

# 查看容器详细信息
docker inspect damoxing-app

# 查看资源使用情况
docker stats damoxing-app
```

#### 查看日志

```bash
# 查看所有日志
docker-compose logs

# 实时查看日志
docker-compose logs -f

# 查看最近 100 行日志
docker-compose logs --tail=100

# 查看应用日志文件
tail -f logs/combined-*.log
tail -f logs/error-*.log
```

#### 进入容器

```bash
# 进入容器 Shell
docker-compose exec app sh

# 在容器内执行命令
docker-compose exec app npm run db:backup
docker-compose exec app ls -la /app/data
```

### 更新部署

#### 方案 1: 拉取最新代码并重新构建

```bash
# 1. 备份数据库
docker-compose exec app npm run db:backup

# 2. 拉取最新代码
git pull

# 3. 重新构建并启动
docker-compose up -d --build

# 4. 运行数据库迁移 (如果有新的)
docker-compose exec app npm run db:migrate

# 5. 验证部署
curl http://localhost/health
```

#### 方案 2: 分步更新

```bash
# 1. 备份数据库
docker-compose exec app npm run db:backup

# 2. 停止服务
docker-compose down

# 3. 拉取最新代码
git pull

# 4. 重新构建镜像
docker-compose build

# 5. 启动服务
docker-compose up -d

# 6. 运行数据库迁移
docker-compose exec app npm run db:migrate
```

---

## 数据管理

### 数据持久化

Docker Compose 配置了以下 Volume 映射:

| 容器路径 | 宿主机路径 | 说明 |
|----------|-----------|------|
| `/app/data` | `./data` | SQLite 数据库文件 |
| `/app/logs` | `./logs` | 应用日志文件 |
| `/app/backups` | `./backups` | 数据库备份文件 |

### 目录结构

```
damoxing/
├── data/                    # 数据库目录
│   └── database.sqlite      # SQLite 数据库
├── logs/                    # 日志目录
│   ├── combined-2025-12-16.log
│   └── error-2025-12-16.log
├── backups/                 # 备份目录
│   └── database-20251216.sqlite
└── server/.env              # 环境变量
```

### 数据库备份

#### 手动备份

```bash
# 使用内置脚本备份
docker-compose exec app npm run db:backup

# 手动复制数据库文件
cp data/database.sqlite backups/database-$(date +%Y%m%d-%H%M%S).sqlite

# 备份整个 data 目录
tar -czf damoxing-backup-$(date +%Y%m%d).tar.gz data/ logs/
```

#### 自动备份 (使用 cron)

```bash
# 编辑 crontab
crontab -e

# 添加定时任务 (每天凌晨 3 点备份)
0 3 * * * cd /path/to/damoxing && docker-compose exec -T app npm run db:backup

# 添加定时任务 (每周日凌晨 2 点备份整个目录)
0 2 * * 0 cd /path/to/damoxing && tar -czf backups/full-backup-$(date +\%Y\%m\%d).tar.gz data/ logs/
```

### 数据库恢复

```bash
# 使用内置脚本恢复
docker-compose exec app npm run db:restore

# 手动恢复
docker-compose down
cp backups/database-20251216.sqlite data/database.sqlite
docker-compose up -d
```

### 数据库维护

```bash
# 进入容器
docker-compose exec app sh

# 使用 SQLite 命令行
sqlite3 /app/data/database.sqlite

# 查看表结构
.schema

# 查看所有表
.tables

# 执行查询
SELECT * FROM sys_menu;

# 退出
.quit
```

---

## 生产环境部署

### 域名和 HTTPS 配置

#### 方案 1: 使用外部 Nginx 反向代理

在服务器上安装 Nginx,配置反向代理和 SSL:

```nginx
# /etc/nginx/sites-available/damoxing
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 反向代理到 Docker 容器
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**启用配置**:

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/damoxing /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

#### 方案 2: 使用 Let's Encrypt 自动配置 SSL

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 自动配置 SSL
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 测试自动续期
sudo certbot renew --dry-run
```

### 修改 Docker 端口映射

如果使用外部 Nginx,建议修改 Docker 容器端口映射:

```yaml
# docker-compose.yml
services:
  app:
    ports:
      - "127.0.0.1:8080:80"  # 只监听本地,避免直接暴露
```

### 环境变量配置

生产环境必须修改的配置:

```bash
# server/.env

# CORS 配置 - 修改为实际域名
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# 日志级别 - 生产环境使用 info 或 warn
LOG_LEVEL=info

# Dify API 配置
DIFY_API_KEY=app-production-key-here
```

### 安全加固

#### 1. 限制数据库文件权限

```bash
chmod 600 data/database.sqlite
chown 1000:1000 data/database.sqlite
```

#### 2. 配置防火墙

```bash
# 只允许 80 和 443 端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### 3. 定期更新依赖

```bash
# 检查安全漏洞
cd server
npm audit

# 修复漏洞
npm audit fix

# 重新构建镜像
docker-compose build
```

---

## 故障排查

### 问题 1: 容器无法启动

**症状**: `docker-compose up -d` 后容器立即退出

**排查步骤**:

```bash
# 1. 查看容器日志
docker-compose logs

# 2. 检查端口占用
lsof -i :80
lsof -i :3001

# 3. 检查配置文件
docker-compose config

# 4. 重新构建
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 问题 2: 数据库迁移失败

**症状**: 提示 "database is locked" 或 "migration failed"

**解决方案**:

```bash
# 1. 停止服务
docker-compose down

# 2. 检查数据库文件权限
ls -la data/database.sqlite

# 3. 删除数据库重新初始化 (谨慎!)
rm data/database.sqlite

# 4. 重新运行迁移
docker-compose run --rm app npm run db:migrate

# 5. 启动服务
docker-compose up -d
```

### 问题 3: 前端页面无法访问

**症状**: 访问 http://localhost 返回 502 或 404

**排查步骤**:

```bash
# 1. 检查 Nginx 是否运行
docker-compose exec app ps aux | grep nginx

# 2. 检查前端文件是否存在
docker-compose exec app ls -la /usr/share/nginx/html

# 3. 检查 Nginx 配置
docker-compose exec app nginx -t

# 4. 重启 Nginx
docker-compose exec app supervisorctl restart nginx
```

### 问题 4: API 请求失败

**症状**: 前端调用 API 返回 500 或超时

**排查步骤**:

```bash
# 1. 检查后端是否运行
docker-compose exec app ps aux | grep node

# 2. 查看后端日志
docker-compose logs -f app
tail -f logs/error-*.log

# 3. 测试后端健康状态
curl http://localhost/health

# 4. 重启后端
docker-compose exec app supervisorctl restart nodejs
```

### 问题 5: 磁盘空间不足

**症状**: 容器运行缓慢或日志提示 "no space left on device"

**解决方案**:

```bash
# 1. 检查磁盘使用情况
df -h

# 2. 清理 Docker 资源
docker system prune -a

# 3. 清理旧日志
find logs/ -name "*.log" -mtime +30 -delete

# 4. 清理旧备份
find backups/ -name "*.sqlite" -mtime +30 -delete
```

---

## 性能优化

### 监控资源使用

```bash
# 查看容器资源使用
docker stats damoxing-app

# 查看详细信息
docker inspect damoxing-app | grep -A 10 "Memory"
```

### 优化建议

#### 1. 调整日志保留策略

编辑 `server/utils/logger.js`:

```javascript
// 保留 7 天日志
maxFiles: '7d'
```

#### 2. 启用 SQLite 只读模式 (可选)

如果数据库不需要频繁写入,可以启用只读模式提升性能:

```yaml
# docker-compose.yml
environment:
  - SQLITE_READONLY=true
```

#### 3. 配置 Docker 资源限制

```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          memory: 512M
```

#### 4. 使用 CDN 加速静态资源

将前端静态文件部署到 CDN,减轻服务器压力。

---

## 附录

### 常用命令速查表

| 操作 | 命令 |
|------|------|
| 启动服务 | `docker-compose up -d` |
| 停止服务 | `docker-compose down` |
| 重启服务 | `docker-compose restart` |
| 查看日志 | `docker-compose logs -f` |
| 进入容器 | `docker-compose exec app sh` |
| 备份数据库 | `docker-compose exec app npm run db:backup` |
| 恢复数据库 | `docker-compose exec app npm run db:restore` |
| 更新部署 | `git pull && docker-compose up -d --build` |
| 查看状态 | `docker-compose ps` |
| 清理资源 | `docker system prune -a` |

### 相关文档

- [配置页面使用手册](./配置页面使用手册.md) - 系统配置管理
- [API 文档](./API.md) - API 接口说明
- [架构文档](./ARCHITECTURE.md) - 系统架构设计
- [开发文档](./DEVELOPMENT.md) - 开发指南

### 技术支持

如有问题,请:
1. 查看项目 [README.md](../README.md)
2. 查看 [故障排查](#故障排查) 章节
3. 查看容器日志: `docker-compose logs -f`
4. 提交 GitHub Issue

---

**祝您部署顺利!** 🚀
