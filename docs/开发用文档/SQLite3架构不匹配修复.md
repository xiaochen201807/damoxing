# SQLite3 架构不匹配问题修复

## 问题描述

```
Error: Error loading shared library /app/node_modules/sqlite3/build/Release/node_sqlite3.node: Exec format error
```

## 原因分析

这是 **原生模块架构不匹配** 问题:

1. 你在本地(Windows/macOS)运行了 `npm install`
2. SQLite3 为本地架构编译了二进制文件
3. 这些二进制文件被复制到 Docker 容器(Linux Alpine)
4. Linux 无法运行 Windows/macOS 的二进制文件

## 解决方案

### 步骤 1: 更新 .dockerignore

已更新 `.dockerignore`,确保 `node_modules` 不会被复制:

```
# Node modules (必须排除,避免架构不匹配)
node_modules/
**/node_modules/
```

### 步骤 2: 清理本地构建缓存

```bash
# 停止并删除容器
docker-compose down

# 删除所有 Docker 构建缓存
docker system prune -a -f

# 删除 Docker volumes (可选,如果需要清理数据库)
docker volume prune -f
```

### 步骤 3: 重新构建

```bash
# 完全重新构建,不使用任何缓存
docker-compose build --no-cache

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 验证修复

构建成功后,检查服务状态:

```bash
# 查看容器状态
docker-compose ps

# 查看后端日志
docker-compose logs nodejs

# 测试健康检查
curl http://localhost/health
```

## 为什么会发生这个问题?

### Docker 构建流程

```
本地文件系统
    ↓
COPY server/ ./  ← 如果 .dockerignore 没有排除 node_modules
    ↓
容器中包含本地架构的二进制文件 ❌
```

### 正确的流程

```
本地文件系统 (.dockerignore 排除 node_modules)
    ↓
COPY server/package*.json ./
    ↓
RUN npm ci --only=production  ← 在容器中安装,生成 Linux 架构的二进制文件 ✅
    ↓
COPY server/ ./  ← 只复制源代码,不包含 node_modules
```

## 预防措施

### 1. 始终使用 .dockerignore

确保 `.dockerignore` 包含:

```
node_modules/
**/node_modules/
client/node_modules/
server/node_modules/
```

### 2. 不要在本地安装生产依赖

如果需要在本地运行:

```bash
# 开发环境
cd server
npm install  # 安装所有依赖

# Docker 构建
# 不要手动 npm install,让 Docker 在容器中安装
```

### 3. 清理本地 node_modules (可选)

如果要确保干净的构建:

```bash
# 删除本地 node_modules
rm -rf server/node_modules
rm -rf client/node_modules

# Docker 会在容器中重新安装
```

## 常见问题

### Q: 为什么本地可以运行,Docker 不行?

**A**: 因为本地和 Docker 容器的操作系统/架构不同:
- 本地: Windows/macOS (x64)
- Docker: Linux Alpine (x64-musl)

虽然都是 x64,但二进制格式不同。

### Q: 如何确认 .dockerignore 生效?

**A**: 查看 Docker 构建日志:

```bash
docker-compose build --no-cache 2>&1 | grep "COPY server/"
```

如果看到 "COPY server/" 步骤很快完成(几秒),说明没有复制大量文件。

### Q: 还是失败怎么办?

**A**: 尝试完全清理:

```bash
# 1. 停止所有容器
docker-compose down -v

# 2. 删除所有镜像
docker rmi $(docker images -q damoxing*)

# 3. 清理构建缓存
docker builder prune -a -f

# 4. 重新构建
docker-compose build --no-cache
```

## 其他原生模块

除了 SQLite3,以下模块也可能有类似问题:

- `bcrypt`
- `sharp`
- `node-sass`
- `canvas`

**解决方案**: 都是确保在 Docker 容器中安装,不要复制本地的 `node_modules`。

---

**修复完成后,服务应该能正常启动!** 🎉
