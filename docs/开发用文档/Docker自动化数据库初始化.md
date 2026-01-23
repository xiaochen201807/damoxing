# Docker 自动化数据库初始化说明

## 实现方案

通过 **Docker ENTRYPOINT** 脚本实现数据库的自动初始化，完全消除手动操作。

---

## 工作原理

### 1. 构建时（Dockerfile）
```dockerfile
# 将数据库文件作为模板复制到镜像中
COPY server/database.sqlite /app/database.sqlite.template

# 设置启动脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
```

### 2. 运行时（docker-entrypoint.sh）
```bash
# 容器每次启动时执行
if [ ! -f /app/data/database.sqlite ]; then
    # 首次启动：从模板复制数据库
    cp /app/database.sqlite.template /app/data/database.sqlite
else
    # 后续启动：使用现有数据库
    echo "Database already exists"
fi
```

---

## 关键设计

### ✅ 优点

1. **零手动操作**
   - 不需要手动创建目录
   - 不需要手动复制数据库
   - 首次启动自动初始化

2. **数据持久化**
   - 数据库存储在挂载的 `./data/` 目录
   - 容器删除后数据不丢失
   - 重启容器不会重新初始化

3. **幂等性**
   - 多次启动容器是安全的
   - 只在首次启动时初始化
   - 不会覆盖现有数据

4. **灵活性**
   - 可以预先放置数据库文件（跳过初始化）
   - 可以手动替换数据库
   - 支持数据库迁移

### ⚠️ 注意事项

1. **镜像体积**
   - 数据库模板会打包到镜像中
   - 增加镜像大小（通常几 MB）
   - 如果数据库很大，考虑使用外部初始化

2. **数据库更新**
   - 修改数据库模板需要重新构建镜像
   - 现有容器不会自动更新数据库
   - 需要手动迁移或删除旧数据库

---

## 部署流程对比

### 优化前（手动）
```bash
# 1. 创建目录
mkdir -p data/logs data/backups

# 2. 复制数据库
cp server/database.sqlite data/database.sqlite

# 3. 设置权限
chmod 755 data data/logs data/backups
chmod 644 data/database.sqlite

# 4. 启动容器
docker-compose up -d
```

### 优化后（自动）✨
```bash
# 一条命令完成部署
docker-compose up -d
```

就这么简单！容器会自动：
- ✅ 创建 `data/logs` 和 `data/backups` 目录
- ✅ 从模板初始化数据库（如果不存在）
- ✅ 设置正确的权限
- ✅ 启动所有服务

---

## 启动日志示例

### 首次启动
```
=========================================
大模型项目容器启动
=========================================
[Init] Creating data directory structure...
[Init] Database not found, initializing from template...
[Init] Database initialized successfully from template
[Init] Database file: /app/data/database.sqlite (2.5M)
[Init] Existing backups: 0
=========================================
Starting services...
=========================================
2023-12-17 02:00:00,000 INFO supervisord started with pid 1
2023-12-17 02:00:01,001 INFO spawned: 'nginx' with pid 7
2023-12-17 02:00:01,002 INFO spawned: 'nodejs' with pid 8
2023-12-17 02:00:01,003 INFO spawned: 'crond' with pid 9
```

### 后续启动
```
=========================================
大模型项目容器启动
=========================================
[Init] Creating data directory structure...
[Init] Database already exists, skipping initialization
[Init] Database file: /app/data/database.sqlite (3.2M)
[Init] Existing backups: 5
=========================================
Starting services...
=========================================
2023-12-18 02:00:00,000 INFO supervisord started with pid 1
...
```

---

## 高级场景

### 场景 1: 使用现有数据库
```bash
# 在启动前放置数据库文件
mkdir -p data
cp my-existing-database.sqlite data/database.sqlite

# 启动容器（会跳过初始化）
docker-compose up -d
```

### 场景 2: 重置数据库
```bash
# 1. 停止容器
docker-compose down

# 2. 删除现有数据库
rm data/database.sqlite

# 3. 重启容器（会重新初始化）
docker-compose up -d
```

### 场景 3: 更新数据库模板
```bash
# 1. 更新 server/database.sqlite
# 2. 重新构建镜像
docker-compose build --no-cache

# 3. 对于现有部署，需要手动迁移
docker-compose down
rm data/database.sqlite  # 或备份后删除
docker-compose up -d
```

### 场景 4: 数据库迁移
```bash
# 1. 备份现有数据库
cp data/database.sqlite data/database.backup.sqlite

# 2. 进入容器执行迁移脚本
docker exec -it damoxing-app sh
sqlite3 /app/data/database.sqlite < /app/migrations/001_add_column.sql

# 3. 验证迁移
sqlite3 /app/data/database.sqlite ".schema"
```

---

## 文件清单

### 新增文件
- `docker-entrypoint.sh` - 容器启动脚本

### 修改文件
- `Dockerfile` - 添加数据库模板和 ENTRYPOINT

### 工作流程
```
构建时:
  server/database.sqlite → (COPY) → /app/database.sqlite.template

首次启动:
  /app/database.sqlite.template → (copy) → /app/data/database.sqlite
  
后续启动:
  /app/data/database.sqlite (已存在，跳过初始化)
```

---

## 与卷挂载的关系

### docker-compose.yml
```yaml
volumes:
  - ./data:/app/data  # 宿主机 data/ 映射到容器 /app/data
```

### 数据流向
```
宿主机                    容器
./data/                  /app/data/
├── database.sqlite  ←→  ├── database.sqlite (持久化)
├── logs/            ←→  ├── logs/
└── backups/         ←→  └── backups/

镜像内部（不持久化）
/app/database.sqlite.template (模板，仅用于初始化)
```

---

## 总结

| 特性 | 手动方式 | 自动方式 |
|------|----------|----------|
| 部署步骤 | 4 步 | 1 步 |
| 出错风险 | 高（人为操作） | 低（自动化） |
| 首次部署时间 | ~2 分钟 | ~30 秒 |
| 学习成本 | 需要阅读文档 | 无需操作 |
| 数据安全 | 依赖人工 | 自动检查 |
| 可重复性 | 中等 | 完美 |

**核心优势**：
- 🚀 **一键部署**：`docker-compose up -d` 即可
- 🔒 **数据安全**：不会覆盖现有数据
- 🛠️ **零运维**：自动创建目录和初始化
- 📦 **易迁移**：只需复制 `data/` 目录
