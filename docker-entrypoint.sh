#!/bin/sh
# Docker 容器启动脚本
# 负责初始化数据库和目录结构

set -e

echo "========================================="
echo "大模型项目容器启动"
echo "========================================="

# 1. 确保数据目录结构存在
echo "[Init] Creating data directory structure..."
mkdir -p /app/data/logs /app/data/backups

# 2. 检查并初始化数据库
if [ ! -f /app/data/database.sqlite ]; then
    echo "[Init] Database not found, initializing from template..."
    
    if [ -f /app/database.sqlite.template ]; then
        # 从模板复制数据库
        cp /app/database.sqlite.template /app/data/database.sqlite
        echo "[Init] Database initialized successfully from template"
    else
        echo "[Init] WARNING: No database template found!"
        echo "[Init] Creating empty database (you may need to initialize schema manually)"
        touch /app/data/database.sqlite
    fi
else
    echo "[Init] Database already exists, skipping initialization"
fi

# 3. 设置数据库文件权限
chmod 644 /app/data/database.sqlite 2>/dev/null || true
chmod 755 /app/data/logs /app/data/backups 2>/dev/null || true

# 4. 显示数据库信息
if [ -f /app/data/database.sqlite ]; then
    DB_SIZE=$(du -h /app/data/database.sqlite | cut -f1)
    echo "[Init] Database file: /app/data/database.sqlite ($DB_SIZE)"
fi

# 5. 显示备份信息
BACKUP_COUNT=$(find /app/data/backups -name "database_*.sqlite" -type f 2>/dev/null | wc -l)
echo "[Init] Existing backups: $BACKUP_COUNT"

echo "========================================="
echo "Starting services..."
echo "========================================="

# 6. 生成前端运行时配置
echo "[Init] Generating frontend runtime config..."
# 设置默认值
export API_ROUTE_PREFIX=${API_ROUTE_PREFIX:-/api}
export APP_BASE_PATH=${APP_BASE_PATH:-/}
export LINEAGE_ROUTE_PREFIX=${LINEAGE_ROUTE_PREFIX:-${APP_BASE_PATH%/}/lineage}
export LINEAGE_ROUTE_PREFIX=${LINEAGE_ROUTE_PREFIX%/}
export LINEAGE_UPSTREAM=${LINEAGE_UPSTREAM:-http://oracle-lineage-poc:8000}

if [ -z "$LINEAGE_ROUTE_PREFIX" ]; then
    export LINEAGE_ROUTE_PREFIX=/lineage
fi

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  API_ROUTE_PREFIX: "${API_ROUTE_PREFIX}",
  BASE_PATH: "${APP_BASE_PATH}"
};
EOF

# 7. 生成 Nginx 配置
echo "[Init] Generating Nginx configuration..."
# 使用 sed 替换模板中的变量 (替代 envsubst 以避免依赖 gettext)
# 使用 | 作为分隔符避免路径中的 / 冲突
sed -e "s|\${API_ROUTE_PREFIX}|${API_ROUTE_PREFIX}|g" \
    -e "s|\${APP_BASE_PATH}|${APP_BASE_PATH}|g" \
    -e "s|\${LINEAGE_ROUTE_PREFIX}|${LINEAGE_ROUTE_PREFIX}|g" \
    -e "s|\${LINEAGE_UPSTREAM}|${LINEAGE_UPSTREAM}|g" \
    /etc/nginx/http.d/default.conf.template > /etc/nginx/http.d/default.conf

# 6. 启动 supervisord（管理 nginx、node、crond）
exec "$@"
