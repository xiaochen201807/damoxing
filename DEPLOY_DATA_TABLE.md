# data_table 组件部署指南

## 部署步骤

在服务器上部署 `data_table` 组件需要以下步骤:

### 1. 上传组件模板文件

将组件模板文件上传到服务器:

```bash
# 本地执行 (从开发机器)
scp server/templates/components/data_table.j2 your-server:/path/to/project/server/templates/components/
```

### 2. 注册组件到数据库

有两种方式可以注册组件:

#### 方法 1: 使用 SQL 脚本 (推荐)

```bash
# 在服务器上执行
cd /path/to/project
sqlite3 server/data/database.sqlite < server/migrations/register_data_table.sql
```

**优点**: 简单快速,无需额外依赖

#### 方法 2: 使用 Node.js 脚本

```bash
# 在服务器上执行
cd /path/to/project/server
node register_data_table.js
```

**优点**: 有详细的输出和验证信息

### 3. 验证注册结果

```bash
# 查询数据库验证
sqlite3 server/data/database.sqlite "SELECT component_id, component_name, is_active FROM sys_component_library WHERE component_id = 'data_table';"
```

**期望输出**:
```
data_table|CRUD数据表格|1
```

### 4. 重启服务 (如需要)

如果你的 Node.js 服务使用了缓存,可能需要重启:

```bash
# 使用 PM2
pm2 restart your-app-name

# 或使用 systemd
sudo systemctl restart your-service
```

---

## 一键部署脚本

你也可以创建一个一键部署脚本:

```bash
#!/bin/bash
# deploy_data_table.sh

echo "🚀 开始部署 data_table 组件..."

# 1. 检查模板文件
if [ ! -f "server/templates/components/data_table.j2" ]; then
    echo "❌ 组件模板文件不存在"
    exit 1
fi

# 2. 注册组件
echo "📝 注册组件到数据库..."
sqlite3 server/data/database.sqlite < server/migrations/register_data_table.sql

# 3. 验证
echo "✅ 验证注册结果..."
sqlite3 server/data/database.sqlite "SELECT component_id, component_name, is_active FROM sys_component_library WHERE component_id = 'data_table';"

echo "🎉 部署完成!"
```

使用方法:
```bash
chmod +x deploy_data_table.sh
./deploy_data_table.sh
```

---

## Docker 环境部署

如果你的项目运行在 Docker 容器中:

### 方法 1: 进入容器执行

```bash
# 进入容器
docker exec -it your-container-name /bin/bash

# 在容器内执行
cd /app
sqlite3 server/data/database.sqlite < server/migrations/register_data_table.sql
```

### 方法 2: 直接执行

```bash
# 从宿主机直接执行
docker exec your-container-name sqlite3 /app/server/data/database.sqlite < server/migrations/register_data_table.sql
```

---

## 文件清单

部署需要的文件:

| 文件 | 路径 | 说明 |
|------|------|------|
| 组件模板 | `server/templates/components/data_table.j2` | 必需 |
| SQL 注册脚本 | `server/migrations/register_data_table.sql` | 推荐 |
| Node.js 注册脚本 | `server/register_data_table.js` | 可选 |

---

## 常见问题

### Q1: 注册后 MCP 工具看不到新组件?

**A**: 检查以下几点:
1. 确认数据库中 `is_active = 1`
2. 重启 MCP 服务或 Node.js 服务
3. 检查模板文件路径是否正确

### Q2: 组件模板渲染失败?

**A**: 检查:
1. 模板文件是否存在: `server/templates/components/data_table.j2`
2. 文件权限是否正确
3. Nunjucks 模板语法是否有误

### Q3: 如何更新组件配置?

**A**: 重新执行注册脚本即可,使用 `INSERT OR REPLACE` 会自动更新。

---

## 快速命令参考

```bash
# 上传模板文件
scp server/templates/components/data_table.j2 server:/path/to/project/server/templates/components/

# 注册组件 (SQL)
sqlite3 server/data/database.sqlite < server/migrations/register_data_table.sql

# 注册组件 (Node.js)
node server/register_data_table.js

# 验证注册
sqlite3 server/data/database.sqlite "SELECT * FROM sys_component_library WHERE component_id = 'data_table';"

# 查看所有组件
sqlite3 server/data/database.sqlite "SELECT component_id, component_name FROM sys_component_library WHERE is_active = 1;"
```
