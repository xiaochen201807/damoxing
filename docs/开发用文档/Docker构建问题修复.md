# Docker 构建问题修复说明

## 问题 1: Rollup 依赖缺失

### 错误信息
```
Error: Cannot find module @rollup/rollup-linux-x64-musl
```

### 原因
在 Alpine Linux 环境下,使用 `npm ci --only=production` 不会安装可选依赖,导致 Rollup 缺少原生模块。

### 解决方案
```dockerfile
# 前端构建阶段 - 移除 --only=production
RUN npm ci  # 而不是 npm ci --only=production
```

---

## 问题 2: JavaScript 堆内存溢出

### 错误信息
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

### 原因
Vite 构建大型项目时,默认的 Node.js 堆内存 (约 2GB) 不足。

### 解决方案
```dockerfile
# 增加 Node.js 内存限制到 4GB
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build
```

---

## 优化 3: 使用国内镜像源

### 目的
加速 npm 依赖下载,特别是在中国大陆地区。

### 配置
```dockerfile
# 使用淘宝 npm 镜像
RUN npm config set registry https://registry.npmmirror.com
```

---

## 完整的 Dockerfile 修改

### 前端构建阶段
```dockerfile
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

# 配置 npm 使用淘宝镜像源 (加速下载)
RUN npm config set registry https://registry.npmmirror.com

# 复制前端 package 文件
COPY client/package*.json ./

# 安装前端依赖 (包含 devDependencies,因为构建需要)
# 移除 --only=production 以确保安装可选依赖 (如 @rollup/rollup-linux-x64-musl)
RUN npm ci

# 复制前端源代码
COPY client/ ./

# 构建前端 (增加 Node.js 内存限制)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build
```

### 后端阶段
```dockerfile
FROM node:18-alpine

# 安装 Nginx 和 SQLite
RUN apk add --no-cache nginx sqlite supervisor

WORKDIR /app

# 配置 npm 使用淘宝镜像源 (加速下载)
RUN npm config set registry https://registry.npmmirror.com

# 复制后端代码
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ ./
```

---

## 重新构建步骤

```bash
# 1. 清理旧的构建缓存
docker-compose down
docker system prune -f

# 2. 重新构建 (不使用缓存)
docker-compose build --no-cache

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```

---

## 预期构建时间

- **依赖下载**: 约 3-5 分钟 (使用国内镜像)
- **前端构建**: 约 2-3 分钟
- **总时间**: 约 5-8 分钟

---

## 故障排查

### 如果仍然内存不足

可以进一步增加内存限制:

```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=8192"  # 8GB
```

### 如果 npm 镜像源无法访问

可以尝试其他镜像源:

```dockerfile
# 官方源 (较慢)
RUN npm config set registry https://registry.npmjs.org

# 腾讯云镜像
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

# 华为云镜像
RUN npm config set registry https://mirrors.huaweicloud.com/repository/npm/
```

### Docker Desktop 内存设置

如果使用 Docker Desktop,确保分配足够内存:

1. 打开 Docker Desktop
2. Settings → Resources → Memory
3. 建议设置为至少 **4GB**

---

## 性能优化建议

### 1. 使用 .dockerignore

确保 `.dockerignore` 文件包含:
```
node_modules
client/node_modules
client/dist
server/node_modules
*.log
.git
```

### 2. 多阶段构建缓存

Docker 会缓存每一层,修改代码时只重新构建必要的层。

### 3. 本地预构建

如果频繁构建,可以先在本地构建前端:

```bash
cd client
npm run build
cd ..
docker-compose build
```

然后修改 Dockerfile 跳过前端构建步骤。

---

**修复完成!** 🎉
