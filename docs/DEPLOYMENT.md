# 大魔星项目部署指南

## 部署概述

本文档提供大魔星项目在不同环境下的部署指南。

---

## 环境要求

### 服务器要求
- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 7+) 或 macOS
- **Node.js**: >= 16.x
- **npm**: >= 8.x
- **内存**: 最小 2GB，推荐 4GB+
- **磁盘**: 最小 10GB 可用空间

### 网络要求
- 开放端口: 3000 (前端), 3001 (后端)
- 如需使用 Dify AI: 需要访问 `api.dify.ai`

---

## 快速部署（单机部署）

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/damoxing.git
cd damoxing
```

### 2. 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 3. 配置环境变量

**后端配置** (`server/.env`):
```bash
# 服务器配置
NODE_ENV=production
PORT=3001

# 数据库配置
DB_PATH=./database.sqlite

# Dify API 配置（可选）
DIFY_API_URL=https://api.dify.ai/v1
DIFY_API_KEY=your-production-api-key

# 日志配置
LOG_LEVEL=info
LOG_DIR=./logs
```

**前端配置** (`client/.env.production`):
```bash
# API 基础地址
VITE_API_BASE_URL=http://your-domain.com:3001

# 应用信息
VITE_APP_NAME=大魔星系统
VITE_APP_VERSION=1.0.0
```

### 4. 数据库迁移

```bash
cd server
npm run db:migrate
```

### 5. 构建前端

```bash
cd client
npm run build
```

构建产物在 `client/dist/` 目录。

### 6. 启动服务

```bash
# 启动后端（使用 PM2）
cd server
npm install -g pm2
pm2 start index.js --name damoxing-server

# 查看日志
pm2 logs damoxing-server

# 设置开机自启
pm2 startup
pm2 save
```

### 7. 配置 Nginx（推荐）

创建 Nginx 配置文件 `/etc/nginx/sites-available/damoxing`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/damoxing/client/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/damoxing /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Docker 部署

### 1. 创建 Dockerfile（后端）

`server/Dockerfile`:
```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3001

CMD ["node", "index.js"]
```

### 2. 创建 Dockerfile（前端）

`client/Dockerfile`:
```dockerfile
FROM node:16-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3. 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    volumes:
      - ./server/database.sqlite:/app/database.sqlite
      - ./server/logs:/app/logs
    restart: unless-stopped

  frontend:
    build: ./client
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

### 4. 启动服务

```bash
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## 生产环境优化

### 1. 使用 PM2 进程管理

创建 `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'damoxing-server',
    script: './index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '500M'
  }]
};
```

启动：
```bash
pm2 start ecosystem.config.js
```

### 2. 配置 HTTPS

使用 Let's Encrypt 免费证书：
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. 数据库备份

创建备份脚本 `backup.sh`:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/path/to/backups"
DB_PATH="/path/to/damoxing/server/database.sqlite"

cp $DB_PATH $BACKUP_DIR/database_$DATE.sqlite

# 保留最近 7 天的备份
find $BACKUP_DIR -name "database_*.sqlite" -mtime +7 -delete
```

添加到 crontab（每天凌晨 2 点备份）:
```bash
0 2 * * * /path/to/backup.sh
```

### 4. 日志轮转

Winston 已配置自动轮转，保留 14 天。如需调整：

编辑 `server/utils/logger.js`:
```javascript
maxFiles: '30d'  // 保留 30 天
```

---

## 监控和维护

### 1. 健康检查

添加健康检查端点 `server/index.js`:
```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### 2. PM2 监控

```bash
# 查看进程状态
pm2 status

# 查看实时日志
pm2 logs

# 查看监控面板
pm2 monit

# 重启服务
pm2 restart damoxing-server
```

### 3. 性能监控

推荐使用：
- **PM2 Plus**: https://pm2.io/
- **New Relic**: https://newrelic.com/
- **Datadog**: https://www.datadoghq.com/

---

## 故障排查

### 问题1: 后端启动失败

**检查**:
```bash
# 查看日志
pm2 logs damoxing-server

# 检查端口占用
lsof -i :3001

# 检查环境变量
cat server/.env
```

### 问题2: 前端无法访问后端

**检查**:
```bash
# 测试后端 API
curl http://localhost:3001/health

# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

### 问题3: 数据库迁移失败

**解决**:
```bash
cd server
npm run db:rollback
npm run db:migrate
```

---

## 安全建议

1. **使用 HTTPS** - 生产环境必须使用 HTTPS
2. **限制 API 访问** - 配置防火墙规则
3. **定期更新依赖** - `npm audit fix`
4. **备份数据库** - 定期备份 SQLite 文件
5. **监控日志** - 定期检查错误日志
6. **环境变量保护** - 不要提交 `.env` 文件到 Git

---

## 更新部署

### 零停机更新

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
cd server && npm install
cd ../client && npm install

# 3. 运行数据库迁移
cd server && npm run db:migrate

# 4. 构建前端
cd ../client && npm run build

# 5. 重启后端（PM2 会自动实现零停机）
pm2 reload damoxing-server
```

---

## 性能优化建议

1. **启用 Gzip** - Nginx 配置已包含
2. **CDN 加速** - 将静态资源上传到 CDN
3. **数据库索引** - 已在迁移中添加
4. **Redis 缓存** - 可选，用于 AI 响应缓存
5. **负载均衡** - 使用 PM2 cluster 模式

---

## 联系支持

- 问题反馈: [GitHub Issues](https://github.com/yourusername/damoxing/issues)
- 文档: [README.md](../README.md)

---

**部署完成后，访问 `http://your-domain.com` 即可使用系统！** 🚀
