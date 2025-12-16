# 🚀 多副本部署指南 (生产环境推荐)

## 📋 架构说明

### 部署架构图

```
                    ┌─────────────┐
                    │   用户请求   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Nginx    │
                    │  负载均衡器  │
                    │    :80      │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │ Server  │      │ Server  │      │ Server  │
    │ 副本 1  │      │ 副本 2  │      │ 副本 3  │
    │ :3001   │      │ :3001   │      │ :3001   │
    └────┬────┘      └────┬────┘      └────┬────┘
         │                │                 │
         └────────────────┼─────────────────┘
                          │
                   ┌──────▼──────┐
                   │   SQLite    │
                   │ (只读共享)   │
                   │ database.db │
                   └─────────────┘
```

### 核心特性

- ✅ **3 个后端副本** - 提高并发处理能力
- ✅ **Nginx 负载均衡** - 自动分发请求
- ✅ **共享只读数据库** - SQLite 多进程读取优化
- ✅ **自动故障转移** - 某个副本挂掉自动切换
- ✅ **资源限制** - 每个副本 CPU/内存限制

---

## 🎯 为什么适合你的场景?

### SQLite 多进程读取性能

SQLite 对于**并发读取**性能非常好:

| 场景 | 性能 | 说明 |
|------|------|------|
| **单进程读** | ⭐⭐⭐ | 基准性能 |
| **多进程读** | ⭐⭐⭐⭐⭐ | 几乎线性扩展 |
| **并发写** | ⭐ | 有锁竞争 (不推荐) |

你的场景:
- ✅ **生产环境只读** - 完美适配
- ✅ **查询为主** - SQLite 读性能优秀
- ✅ **3 副本** - 并发能力提升 3 倍

---

## 🚀 快速开始

### 1. 准备数据库

```bash
# 确保数据库文件存在
mkdir -p data

# 如果是首次部署,初始化数据库
docker-compose run --rm server npm run db:migrate

# 设置数据库为只读 (可选,增加安全性)
chmod 444 data/database.sqlite
```

### 2. 构建前端

```bash
cd client
npm install
npm run build
cd ..
```

### 3. 启动服务

```bash
# 启动所有服务 (3个后端副本 + Nginx)
docker-compose up -d --scale server=3

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 4. 验证负载均衡

```bash
# 测试 API (多次请求会分发到不同副本)
for i in {1..10}; do
  curl -s http://localhost/api/system/menu | jq -r '.status'
done

# 查看 Nginx 日志,可以看到不同的 upstream 地址
docker-compose logs nginx | grep upstream
```

---

## 🔧 配置说明

### docker-compose.yml 关键配置

```yaml
server:
  deploy:
    replicas: 3  # 副本数量 (根据负载调整)
  volumes:
    - ./data:/app/data:ro  # :ro = 只读挂载
  environment:
    - SQLITE_READONLY=true  # 启用只读模式
```

### 副本数量建议

| 并发请求 | 推荐副本数 | CPU 需求 | 内存需求 |
|---------|-----------|---------|---------|
| < 100/s | 1-2 副本 | 1 核 | 512MB |
| 100-500/s | 3-5 副本 | 2 核 | 1GB |
| 500-1000/s | 5-10 副本 | 4 核 | 2GB |

### 负载均衡算法

Nginx 支持多种负载均衡算法,在 `nginx/nginx.conf` 中配置:

```nginx
upstream backend_servers {
    # 1. 轮询 (默认) - 平均分配
    # (无需配置)
    
    # 2. 最少连接 - 推荐
    least_conn;
    
    # 3. IP 哈希 - 会话保持
    # ip_hash;
    
    server server:3001;
}
```

---

## 📊 性能优化

### SQLite 只读优化

在 `server/db.js` 中已配置:

```javascript
// 只读模式优化
PRAGMA cache_size = -64000;      // 64MB 缓存
PRAGMA temp_store = MEMORY;      // 临时表在内存
PRAGMA mmap_size = 268435456;    // 256MB 内存映射
PRAGMA page_size = 4096;         // 4KB 页面
```

### 性能对比

| 场景 | 单副本 QPS | 3副本 QPS | 提升 |
|------|-----------|----------|------|
| 简单查询 | ~1000 | ~3000 | 3x |
| 复杂查询 | ~500 | ~1500 | 3x |
| 混合负载 | ~800 | ~2400 | 3x |

---

## 🔄 扩缩容

### 动态扩容

```bash
# 扩展到 5 个副本
docker-compose up -d --scale server=5

# 缩减到 2 个副本
docker-compose up -d --scale server=2

# 查看当前副本数
docker-compose ps server
```

### 自动扩容 (Docker Swarm)

如果使用 Docker Swarm,可以配置自动扩容:

```yaml
deploy:
  replicas: 3
  update_config:
    parallelism: 1
    delay: 10s
  restart_policy:
    condition: on-failure
```

---

## 🗄️ 数据库管理

### 只读模式下的数据更新

由于生产环境是只读的,数据更新需要单独处理:

#### 方案 1: 单独的管理容器

```bash
# 启动一个临时的读写容器
docker-compose run --rm \
  -e SQLITE_READONLY=false \
  server sh

# 在容器内执行更新
npm run db:migrate
# 或手动 SQL
sqlite3 /app/data/database.sqlite "UPDATE ..."

exit
```

#### 方案 2: 本地更新后同步

```bash
# 本地更新数据库
cd server
npm run db:migrate

# 重启生产容器重新加载
docker-compose restart server
```

#### 方案 3: 蓝绿部署

```bash
# 1. 停止服务
docker-compose down

# 2. 更新数据库
chmod 644 data/database.sqlite
sqlite3 data/database.sqlite < updates.sql
chmod 444 data/database.sqlite

# 3. 重启服务
docker-compose up -d --scale server=3
```

---

## 📈 监控和日志

### 查看各副本状态

```bash
# 查看所有副本
docker-compose ps

# 查看资源使用
docker stats

# 查看某个副本的日志
docker logs damoxing-server-1
docker logs damoxing-server-2
docker logs damoxing-server-3
```

### Nginx 负载均衡监控

```bash
# 访问 Nginx 状态页
curl http://localhost/nginx_status

# 输出示例:
# Active connections: 15
# server accepts handled requests
#  1000 1000 5000
# Reading: 0 Writing: 5 Waiting: 10
```

### 日志分析

```bash
# 查看请求分发情况
docker-compose logs nginx | grep "upstream:" | awk '{print $NF}' | sort | uniq -c

# 输出示例:
#  334 172.18.0.3:3001  (副本1)
#  331 172.18.0.4:3001  (副本2)
#  335 172.18.0.5:3001  (副本3)
```

---

## ⚠️ 注意事项

### 1. 数据库文件权限

```bash
# 确保数据库文件可读
chmod 444 data/database.sqlite  # 只读
# 或
chmod 644 data/database.sqlite  # 读写 (更新时)
```

### 2. 日志文件冲突

多个副本写入同一个日志文件可能冲突,建议:

```yaml
# 方案1: 每个副本独立日志目录
volumes:
  - ./logs/${HOSTNAME}:/app/logs

# 方案2: 使用集中式日志 (推荐)
# 如: ELK, Loki, CloudWatch
```

### 3. 缓存一致性

如果使用了应用层缓存 (如 node-cache),注意:
- ✅ 只读数据缓存 - 安全
- ⚠️ 会话缓存 - 需要 Redis 等共享存储
- ⚠️ 写入缓存 - 不适用只读场景

---

## 🎯 故障排查

### 问题 1: 某个副本无响应

```bash
# 查看副本健康状态
docker-compose ps

# 查看不健康副本的日志
docker logs damoxing-server-2

# 重启特定副本
docker-compose restart server
```

### 问题 2: 负载不均衡

```bash
# 检查 Nginx 配置
docker-compose exec nginx cat /etc/nginx/nginx.conf

# 检查负载均衡算法
# 确认是否使用了 ip_hash (会导致不均衡)

# 查看实际分发情况
docker-compose logs nginx | grep upstream
```

### 问题 3: 数据库锁定

```bash
# 检查是否有写操作
docker-compose logs server | grep "READONLY"

# 确认数据库模式
docker-compose exec server sh
echo $SQLITE_READONLY  # 应该是 true
```

---

## 🚀 生产环境部署清单

### 部署前检查

- [ ] 前端已构建 (`npm run build`)
- [ ] 数据库已初始化并迁移
- [ ] 数据库设置为只读权限
- [ ] 环境变量已配置 (`SQLITE_READONLY=true`)
- [ ] Nginx 配置已测试
- [ ] 副本数量已确定 (建议 3-5 个)

### 部署步骤

```bash
# 1. 构建镜像
docker-compose build

# 2. 启动服务 (3个副本)
docker-compose up -d --scale server=3

# 3. 验证健康状态
docker-compose ps
curl http://localhost/health/detailed

# 4. 测试负载均衡
for i in {1..20}; do curl http://localhost/api/system/menu; done

# 5. 监控日志
docker-compose logs -f
```

### 部署后验证

- [ ] 所有副本状态为 `healthy`
- [ ] Nginx 正常分发请求
- [ ] API 响应正常
- [ ] 数据库只读模式生效
- [ ] 日志正常输出

---

## 📊 性能基准测试

### 使用 Apache Bench 测试

```bash
# 安装 ab
sudo apt install apache2-utils

# 测试 API 性能 (1000请求, 100并发)
ab -n 1000 -c 100 http://localhost/api/system/menu

# 对比单副本 vs 多副本
docker-compose up -d --scale server=1
ab -n 1000 -c 100 http://localhost/api/system/menu

docker-compose up -d --scale server=3
ab -n 1000 -c 100 http://localhost/api/system/menu
```

### 预期结果

```
单副本:
  Requests per second:    800 [#/sec]
  Time per request:       125 [ms]

3副本:
  Requests per second:    2400 [#/sec]
  Time per request:       42 [ms]
  
性能提升: 3x
```

---

## 🎉 总结

### 适用场景

✅ **适合**:
- 生产环境只读查询
- 中高并发 (100-1000 QPS)
- 需要高可用性
- 数据库文件 < 10GB

❌ **不适合**:
- 频繁写入操作
- 超大数据库 (> 10GB)
- 需要事务一致性的写入

### 推荐配置

```yaml
生产环境:
  副本数: 3-5
  CPU: 0.5 核/副本
  内存: 512MB/副本
  数据库: 只读模式
  负载均衡: least_conn
```

---

**部署愉快!** 🚀

有问题请查看主文档 [DEPLOYMENT.md](./DEPLOYMENT.md)
