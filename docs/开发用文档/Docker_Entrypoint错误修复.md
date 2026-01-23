# Docker Entrypoint 错误修复

## 错误信息
```
exec /docker-entrypoint.sh: no such file or directory
```

## 原因
`.dockerignore` 文件可能排除了 shell 脚本文件，导致 `docker-entrypoint.sh` 和 `backup-db.sh` 没有被复制到镜像中。

## 修复
在 `.dockerignore` 文件末尾添加例外规则：

```gitignore
# 重要：允许必需的 shell 脚本
!docker-entrypoint.sh
!backup-db.sh
```

## 验证
重新构建后，检查文件是否存在：

```bash
# 构建镜像
docker-compose build --no-cache

# 检查文件是否在镜像中
docker run --rm damoxing-app ls -la /docker-entrypoint.sh
docker run --rm damoxing-app ls -la /app/backup-db.sh

# 启动容器
docker-compose up -d
```

## 预期结果
容器应该正常启动，显示初始化日志：
```
=========================================
大模型项目容器启动
=========================================
[Init] Creating data directory structure...
...
```
