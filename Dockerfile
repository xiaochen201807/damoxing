# ============================================
# 大模型项目 - 单容器部署 (前端 + 后端)
# ============================================

# 阶段 1: 构建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

# 复制前端 package 文件
COPY client/package*.json ./

# 安装前端依赖
RUN npm ci --only=production

# 复制前端源代码
COPY client/ ./

# 构建前端
RUN npm run build

# ============================================
# 阶段 2: 生产环境 (Nginx + Node.js)
# ============================================
FROM node:18-alpine

# 安装 Nginx 和 SQLite
RUN apk add --no-cache nginx sqlite supervisor

WORKDIR /app

# 复制后端代码
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ ./

# 从构建阶段复制前端构建产物
COPY --from=frontend-builder /app/client/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx-single.conf /etc/nginx/http.d/default.conf

# 复制 Supervisor 配置 (管理多进程)
COPY supervisord.conf /etc/supervisord.conf

# 创建必要的目录
RUN mkdir -p /app/data /app/logs /app/backups /run/nginx

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# 使用 Supervisor 启动 Nginx 和 Node.js
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
