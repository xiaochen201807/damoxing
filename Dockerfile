# ============================================
# 大模型项目 - 单容器部署 (前端 + 后端)
# ============================================

# 阶段 1: 构建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

# 配置 npm 使用淘宝镜像源 (加速下载)
# 同时增加超时时间和重试次数，解决网络不稳定问题
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# 复制前端 package 文件
COPY client/package*.json ./

# 安装前端依赖 (包含 devDependencies,因为构建需要)
# 移除 --only=production 以确保安装可选依赖 (如 @rollup/rollup-linux-x64-musl)
# 使用 --prefer-offline 优先使用缓存，减少网络请求
RUN npm ci --prefer-offline || npm ci || npm ci

# 复制前端源代码
COPY client/ ./

# 构建前端 (增加 Node.js 内存限制)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# ============================================
# 阶段 2: 生产环境 (Nginx + Node.js)
# ============================================
FROM node:18-alpine

# 安装 Nginx、SQLite 和 cronie（定时任务）
RUN apk add --no-cache nginx sqlite supervisor dcron

WORKDIR /app

# 配置 npm 使用淘宝镜像源 (加速下载)
# 同时增加超时时间和重试次数
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# 复制后端代码
COPY server/package*.json ./
RUN npm ci --only=production --prefer-offline || npm ci --only=production
COPY server/ ./

# 复制数据库模板（用于首次启动时初始化）
COPY server/database.sqlite /app/database.sqlite.template

# 从构建阶段复制前端构建产物
COPY --from=frontend-builder /app/client/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx-single.conf /etc/nginx/http.d/default.conf

# 复制 Supervisor 配置 (管理多进程)
COPY supervisord.conf /etc/supervisord.conf

# 复制备份脚本和 crontab
COPY backup-db.sh /app/backup-db.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /app/backup-db.sh

# 复制并设置启动脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 创建统一的 data 目录结构
# data/
#   ├── database.sqlite    (数据库文件，首次启动时从模板复制)
#   ├── logs/              (日志目录)
#   └── backups/           (备份目录)
RUN mkdir -p /app/data/logs /app/data/backups /run/nginx

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# 设置启动脚本为入口点
ENTRYPOINT ["/docker-entrypoint.sh"]

# 使用 Supervisor 启动 Nginx、Node.js 和 Cron
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]


