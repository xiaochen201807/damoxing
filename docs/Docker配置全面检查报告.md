# Docker 配置全面检查报告

## 检查概览

已完成对 Docker 配置的全面审查，发现 **4 个需要注意的问题**，其中 **2 个是关键问题**。

---

## ✅ 已修复的问题

### 1. 前端 API 基础路径配置 ⭐ **已修复**

**文件**: `client/.env.production`

**问题**: 
```env
VITE_API_BASE_URL=https://api.yourdomain.com  # ❌ 占位符域名
```

**修复**:
```env
VITE_API_BASE_URL=  # ✅ 使用相对路径
```

**影响**: 这是导致空白页面的根本原因

---

## ⚠️ 发现的新问题

### 问题 1: 数据目录不存在 🔴 **关键问题**

**位置**: 项目根目录

**问题描述**:
- `docker-compose.yml` 配置了卷挂载: `./data:/app/data`
- 但本地 `data/` 目录不存在
- 容器启动时会自动创建空目录，但**没有数据库文件**

**影响**:
- 容器启动后，后端会尝试连接 `/app/data/database.sqlite`
- 如果文件不存在，SQLite 会创建一个**空数据库**
- 没有表结构，所有 API 调用都会失败
- 健康检查可能通过（因为数据库连接成功），但业务功能不可用

**解决方案**:

#### 方案 A: 使用现有数据库（推荐）

```bash
# 1. 创建 data 目录
mkdir -p data

# 2. 复制现有数据库
cp server/database.sqlite data/database.sqlite

# 3. 设置权限
chmod 644 data/database.sqlite
```

#### 方案 B: 添加数据库初始化脚本

在 Dockerfile 中添加数据库初始化：

```dockerfile
# 复制初始数据库（如果存在）
COPY server/database.sqlite /app/data/database.sqlite.template

# 在启动脚本中检查并初始化
RUN echo '#!/bin/sh\n\
if [ ! -f /app/data/database.sqlite ]; then\n\
  echo "Initializing database..."\n\
  cp /app/data/database.sqlite.template /app/data/database.sqlite\n\
fi\n\
exec "$@"' > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
```

---

### 问题 2: CORS 配置与 Docker 环境不匹配 🟡 **需要注意**

**文件**: `server/index.js` 和 `docker-compose.yml`

**当前配置**:

`docker-compose.yml`:
```yaml
environment:
  - CORS_ORIGIN=http://localhost
```

`server/index.js`:
```javascript
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ["http://localhost:3000", "http://127.0.0.1:3000"];
```

**问题**:
1. Docker 容器中，前端和后端在同一域名下（通过 Nginx 代理）
2. 前端请求来自浏览器，origin 是用户访问的域名（如 `http://localhost` 或 `http://your-server-ip`）
3. 但 CORS 配置只允许 `http://localhost`，不包括端口 80

**影响**:
- 如果用户通过 IP 地址访问（如 `http://192.168.1.100`），CORS 会阻止请求
- 虽然代码中有内网 IP 白名单，但可能不够全面

**解决方案**:

#### 方案 A: 允许所有来源（仅限内网部署）

```yaml
# docker-compose.yml
environment:
  - CORS_ORIGIN=*
```

#### 方案 B: 配置具体域名

```yaml
# docker-compose.yml
environment:
  - CORS_ORIGIN=http://localhost,http://your-domain.com,http://192.168.1.100
```

#### 方案 C: 修改后端逻辑（推荐）

```javascript
// server/index.js
const corsOptions = {
  origin: (origin, callback) => {
    // Docker 单容器部署：前后端同域，允许无 origin 的请求
    if (!origin) return callback(null, true);
    
    // 允许配置的域名
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // 允许内网 IP（更宽松的匹配）
    if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/)) {
      return callback(null, true);
    }
    
    logger.warn(`CORS blocked request from origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  // ...
};
```

---

### 问题 3: 端口环境变量冲突 🟡 **需要注意**

**位置**: `docker-compose.yml` 和 `supervisord.conf`

**当前配置**:

`docker-compose.yml`:
```yaml
environment:
  - PORT=3001
```

`supervisord.conf`:
```ini
[program:nodejs]
environment=NODE_ENV="production",PORT="3001"
```

**问题**:
- 端口号在两个地方都定义了
- 如果不一致，可能导致 Nginx 代理失败

**影响**:
- 目前两处都是 3001，暂无问题
- 但如果修改其中一处忘记同步，会导致连接失败

**解决方案**:

只在 `docker-compose.yml` 中定义，`supervisord.conf` 继承环境变量：

```ini
# supervisord.conf
[program:nodejs]
command=node /app/index.js
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=20
# 移除 environment 行，继承 docker-compose 的环境变量
```

---

### 问题 4: 缺少数据库备份机制 🔵 **建议改进**

**当前状态**:
- `docker-compose.yml` 挂载了 `./backups:/app/backups`
- 但没有自动备份脚本

**建议**:

添加定时备份脚本（可选）：

```bash
# backup.sh
#!/bin/sh
BACKUP_DIR=/app/backups
DB_PATH=/app/data/database.sqlite
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 创建备份
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/database_$TIMESTAMP.sqlite'"

# 保留最近7天的备份
find $BACKUP_DIR -name "database_*.sqlite" -mtime +7 -delete

echo "Backup completed: database_$TIMESTAMP.sqlite"
```

在 `supervisord.conf` 中添加定时任务（或使用 cron）。

---

## 📋 配置检查清单

### ✅ 正确的配置

1. **Dockerfile**
   - ✅ 多阶段构建，前端和后端分离
   - ✅ 使用 Alpine 镜像，体积小
   - ✅ 安装了 Nginx、SQLite、Supervisor
   - ✅ 设置了健康检查

2. **Nginx 配置** (`nginx-single.conf`)
   - ✅ API 反向代理到 `http://127.0.0.1:3001`
   - ✅ 前端静态文件服务
   - ✅ Gzip 压缩
   - ✅ 缓存策略（HTML 不缓存，JS/CSS 长期缓存）
   - ✅ 安全头配置

3. **Supervisor 配置**
   - ✅ 管理 Nginx 和 Node.js 两个进程
   - ✅ 自动重启
   - ✅ 日志输出到 stdout/stderr

4. **后端配置**
   - ✅ 健康检查端点 (`/health`)
   - ✅ 数据库连接
   - ✅ 日志系统
   - ✅ 错误处理中间件
   - ✅ 安全中间件（Helmet、限流、SQL 注入防护）

5. **前端配置**
   - ✅ Vite 构建优化
   - ✅ 代码分割
   - ✅ Gzip 压缩
   - ✅ 环境变量配置（已修复）

### ⚠️ 需要改进的配置

1. **数据库初始化** 🔴
   - ❌ 缺少初始数据库文件
   - ❌ 没有数据库初始化脚本

2. **CORS 配置** 🟡
   - ⚠️ 可能不支持 IP 地址访问
   - ⚠️ 配置不够灵活

3. **环境变量管理** 🟡
   - ⚠️ PORT 在两处定义
   - ⚠️ 缺少环境变量验证

4. **备份机制** 🔵
   - ℹ️ 没有自动备份

---

## 🚀 推荐的修复顺序

### 立即修复（关键）

1. **创建数据目录并复制数据库**
   ```bash
   mkdir -p data
   cp server/database.sqlite data/database.sqlite
   ```

2. **重新构建 Docker 镜像**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

### 后续优化（建议）

3. **优化 CORS 配置**
   - 修改 `server/index.js` 中的 CORS 逻辑
   - 或在 `docker-compose.yml` 中添加更多允许的域名

4. **统一环境变量**
   - 移除 `supervisord.conf` 中的 `environment` 配置
   - 只在 `docker-compose.yml` 中定义

5. **添加数据库初始化**
   - 修改 Dockerfile，添加数据库模板
   - 创建启动脚本，检查并初始化数据库

6. **添加备份脚本**（可选）
   - 创建定时备份脚本
   - 配置 cron 或 supervisor 定时任务

---

## 📝 完整的部署步骤

### 1. 准备数据

```bash
# 在项目根目录执行
cd /path/to/damoxing

# 创建必要的目录
mkdir -p data logs backups

# 复制数据库
cp server/database.sqlite data/database.sqlite

# 设置权限
chmod 755 data logs backups
chmod 644 data/database.sqlite
```

### 2. 验证配置

```bash
# 检查 .env.production
cat client/.env.production | grep VITE_API_BASE_URL
# 应该显示: VITE_API_BASE_URL=

# 检查 docker-compose.yml
cat docker-compose.yml | grep -A 5 environment
```

### 3. 构建和启动

```bash
# 停止旧容器
docker-compose down

# 清理旧镜像（可选）
docker rmi damoxing-app

# 构建新镜像
docker-compose build --no-cache

# 启动容器
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 4. 验证部署

```bash
# 检查容器状态（应该是 healthy）
docker ps

# 测试健康检查
curl http://localhost/health

# 测试 API
curl http://localhost/api/system/menu

# 浏览器访问
# http://localhost
```

### 5. 故障排查

如果仍有问题：

```bash
# 进入容器
docker exec -it damoxing-app sh

# 检查进程
ps aux

# 检查前端文件
ls -la /usr/share/nginx/html/

# 检查数据库
ls -la /app/data/
sqlite3 /app/data/database.sqlite ".tables"

# 检查日志
cat /var/log/nginx/error.log
cat /var/log/supervisord.log

# 测试后端
wget -O- http://127.0.0.1:3001/health
```

---

## 🎯 总结

### 已修复
- ✅ 前端 API 基础路径配置错误

### 需要立即处理
- 🔴 创建 `data/` 目录并复制数据库文件

### 建议优化
- 🟡 优化 CORS 配置，支持更多访问方式
- 🟡 统一环境变量管理
- 🔵 添加数据库初始化和备份机制

### 预期结果
完成上述修复后：
- ✅ 容器状态: `healthy`
- ✅ 页面正常显示
- ✅ API 调用正常
- ✅ 数据持久化
