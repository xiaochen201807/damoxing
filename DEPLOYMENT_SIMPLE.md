# 🚀 简化部署指南 (单容器版本)

> **适用场景**: 小型项目、快速部署、资源有限的环境

## 📋 架构说明

### 单容器架构

```
┌─────────────────────────────────┐
│      Docker 容器 (damoxing-app)  │
│                                 │
│  ┌──────────┐    ┌───────────┐ │
│  │  Nginx   │◄──►│  Node.js  │ │
│  │  :80     │    │  :3001    │ │
│  │ (前端)    │    │  (后端)    │ │
│  └──────────┘    └─────┬─────┘ │
│                        │       │
│                 ┌──────▼─────┐ │
│                 │   SQLite   │ │
│                 │ (只读共享)  │ │
│                 └────────────┘ │
└─────────────────────────────────┘
         ▲
         │ Volume 挂载
         ▼
    ./data/database.sqlite
```

### 核心特性

- ✅ **单容器部署** - 前后端在同一容器
- ✅ **Supervisor 管理** - 自动管理 Nginx 和 Node.js 进程
- ✅ **资源占用小** - 适合小型项目
- ✅ **部署简单** - 一条命令启动

---

## 🚀 快速开始

### 1. 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 服务器内存 >= 512MB
- 磁盘空间 >= 2GB

### 2. 准备数据库

```bash
# 创建数据目录
mkdir -p data logs backups

# 如果是首次部署,需要初始化数据库
# 方法1: 本地初始化后复制
cd server
npm install
npm run db:migrate
cp database.sqlite ../data/

# 方法2: 使用临时容器初始化 (推荐)
docker-compose run --rm app sh -c "npm run db:migrate"
```

### 3. 构建并启动

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看状态
docker-compose ps
```

### 4. 验证部署

```bash
# 检查前端
curl http://localhost

# 检查 API
curl http://localhost/api/system/menu

# 检查健康状态
curl http://localhost/health
```

---

## 🔧 常用命令

### 服务管理

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 重启
docker-compose restart

# 查看日志
docker-compose logs -f

# 进入容器
docker-compose exec app sh
```

### 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

### 数据库管理

```bash
# 进入容器
docker-compose exec app sh

# 运行迁移
npm run db:migrate

# 备份数据库
npm run db:backup

# 退出
exit
```

---

## 📊 多副本部署 (可选)

虽然是单容器设计,但仍然可以启动多个副本:

### 方案 1: Docker Compose Scale

```bash
# 启动 3 个副本
docker-compose up -d --scale app=3

# 注意: 需要修改端口映射避免冲突
# 或者使用外部负载均衡器
```

**限制**: 端口会冲突,需要外部负载均衡器。

### 方案 2: 外部 Nginx 负载均衡

```yaml
# docker-compose.yml
services:
  app:
    ports:
      - "8001-8003:80"  # 映射到不同端口
```

然后配置外部 Nginx:

```nginx
upstream damoxing_cluster {
    server localhost:8001;
    server localhost:8002;
    server localhost:8003;
}

server {
    listen 80;
    location / {
        proxy_pass http://damoxing_cluster;
    }
}
```

### 推荐

对于小项目,**单副本**通常已经足够:
- ✅ 简单易维护
- ✅ 资源占用少
- ✅ 性能满足需求 (500-1000 QPS)

---

## 🗄️ 数据管理

### 数据库位置

```
./data/database.sqlite  (宿主机)
  ↓ 挂载到
/app/data/database.sqlite  (容器内)
```

### 备份策略

**手动备份**:
```bash
# 方法1: 直接复制文件
cp data/database.sqlite backups/database-$(date +%Y%m%d).sqlite

# 方法2: 使用容器内脚本
docker-compose exec app npm run db:backup
```

**自动备份** (crontab):
```bash
# 编辑 crontab
crontab -e

# 每天凌晨 3 点备份
0 3 * * * cd /path/to/damoxing && cp data/database.sqlite backups/database-$(date +\%Y\%m\%d).sqlite
```

### 数据恢复

```bash
# 停止服务
docker-compose down

# 恢复数据库
cp backups/database-20250101.sqlite data/database.sqlite

# 重启服务
docker-compose up -d
```

---

## ⚙️ 配置说明

### 环境变量

编辑 `server/.env`:

```bash
# 生产环境
NODE_ENV=production
PORT=3001

# 数据库路径
DB_PATH=/app/data/database.sqlite

# CORS 配置
CORS_ORIGIN=https://yourdomain.com

# 只读模式 (推荐)
SQLITE_READONLY=true

# Dify API (可选)
DIFY_API_KEY=
```

### 端口配置

修改 `docker-compose.yml`:

```yaml
ports:
  - "8080:80"  # 改为 8080 端口
```

### 资源限制

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

---

## 🔍 故障排查

### 问题 1: 容器无法启动

```bash
# 查看日志
docker-compose logs

# 常见原因:
# - 端口被占用: lsof -i :80
# - 数据库文件权限: chmod 644 data/database.sqlite
# - 构建失败: docker-compose build --no-cache
```

### 问题 2: API 无法访问

```bash
# 进入容器检查
docker-compose exec app sh

# 检查 Node.js 是否运行
ps aux | grep node

# 检查端口
netstat -tlnp | grep 3001

# 手动启动 Node.js (调试)
node /app/index.js
```

### 问题 3: 前端页面 404

```bash
# 检查前端文件是否存在
docker-compose exec app ls -la /usr/share/nginx/html

# 如果为空,重新构建
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 问题 4: Supervisor 进程异常

```bash
# 进入容器
docker-compose exec app sh

# 查看 Supervisor 状态
supervisorctl status

# 重启服务
supervisorctl restart nginx
supervisorctl restart nodejs

# 查看日志
tail -f /var/log/supervisord.log
```

---

## 📈 性能优化

### 单容器性能

| 指标 | 性能 |
|------|------|
| **并发请求** | 500-1000 QPS |
| **内存占用** | 300-500 MB |
| **CPU 占用** | 0.5-1.0 核 |
| **启动时间** | 5-10 秒 |

### 优化建议

1. **启用 Gzip** - 已在 Nginx 配置中启用
2. **静态资源缓存** - 已配置长期缓存
3. **数据库优化** - 只读模式 + 内存映射
4. **日志轮转** - Winston 自动轮转

---

## 🎯 生产环境部署

### 部署清单

- [ ] 前端已构建 (`cd client && npm run build`)
- [ ] 数据库已初始化
- [ ] 环境变量已配置 (`server/.env`)
- [ ] 数据目录已创建 (`mkdir -p data logs backups`)
- [ ] Docker 已安装

### 部署步骤

```bash
# 1. 克隆代码
git clone <repo> damoxing && cd damoxing

# 2. 构建前端
cd client && npm install && npm run build && cd ..

# 3. 配置环境变量
cp server/.env.example server/.env
nano server/.env  # 修改配置

# 4. 初始化数据库
docker-compose run --rm app npm run db:migrate

# 5. 启动服务
docker-compose up -d

# 6. 验证
curl http://localhost/health
```

### 配置 HTTPS (可选)

使用外部 Nginx 反向代理:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🆚 方案对比

### 单容器 vs 多容器

| 特性 | 单容器 | 多容器 |
|------|--------|--------|
| **复杂度** | ⭐ 简单 | ⭐⭐⭐ 复杂 |
| **资源占用** | ⭐⭐⭐ 低 | ⭐⭐ 中 |
| **扩展性** | ⭐⭐ 有限 | ⭐⭐⭐⭐⭐ 优秀 |
| **适用场景** | 小项目 | 大项目 |
| **并发能力** | 500-1000 QPS | 2000+ QPS |

### 何时升级到多容器?

当出现以下情况时,考虑升级:
- ✅ 并发请求 > 1000 QPS
- ✅ 需要独立扩展前后端
- ✅ 需要高可用 (多副本)
- ✅ 团队规模扩大

---

## 🎉 总结

### 优势

- ✅ **极简部署** - 一个容器搞定
- ✅ **资源友好** - 内存占用 < 500MB
- ✅ **易于维护** - 单一配置文件
- ✅ **快速启动** - 5-10 秒启动

### 适用场景

- ✅ 小型项目 (< 1000 QPS)
- ✅ 快速原型验证
- ✅ 资源受限环境
- ✅ 个人或小团队项目

### 下一步

如果项目规模扩大,可以参考:
- [DEPLOYMENT_MULTI_REPLICA.md](./DEPLOYMENT_MULTI_REPLICA.md) - 多副本部署
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 完整部署指南

---

**部署愉快!** 🚀
