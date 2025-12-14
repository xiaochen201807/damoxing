#!/bin/bash
#
# 数据库备份脚本
# 用法: ./scripts/backup-db.sh [backup-name]
#

set -e  # 遇到错误立即退出

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$SERVER_DIR/backups"
DB_FILE="$SERVER_DIR/database.sqlite"
KEEP_DAYS=7  # 保留最近7天的备份

# 确保备份目录存在
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
if [ -n "$1" ]; then
    # 使用自定义名称
    BACKUP_NAME="$1"
else
    # 使用时间戳
    BACKUP_NAME="db_$(date +%Y%m%d_%H%M%S)"
fi

BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sqlite"

# 检查数据库文件是否存在
if [ ! -f "$DB_FILE" ]; then
    echo "❌ 错误: 数据库文件不存在: $DB_FILE"
    exit 1
fi

# 执行备份
echo "📦 开始备份数据库..."
echo "   源文件: $DB_FILE"
echo "   备份至: $BACKUP_FILE"

# 使用 sqlite3 的 backup 命令（比 cp 更安全）
if command -v sqlite3 &> /dev/null; then
    sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"
    echo "✅ 使用 sqlite3 backup 完成"
else
    # 如果没有 sqlite3 命令，使用 cp
    cp "$DB_FILE" "$BACKUP_FILE"
    echo "✅ 使用 cp 完成"
fi

# 显示备份文件大小
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "   备份大小: $BACKUP_SIZE"

# 清理旧备份
echo ""
echo "🧹 清理旧备份 (保留最近 ${KEEP_DAYS} 天)..."
DELETED_COUNT=0

# 查找并删除超过指定天数的备份文件
while IFS= read -r old_backup; do
    rm -f "$old_backup"
    echo "   删除: $(basename "$old_backup")"
    ((DELETED_COUNT++))
done < <(find "$BACKUP_DIR" -name "db_*.sqlite" -type f -mtime +$KEEP_DAYS)

if [ $DELETED_COUNT -eq 0 ]; then
    echo "   无需清理"
else
    echo "   已删除 $DELETED_COUNT 个旧备份"
fi

# 显示当前所有备份
echo ""
echo "📋 当前备份列表:"
ls -lh "$BACKUP_DIR"/*.sqlite 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'  || echo "   (无备份文件)"

echo ""
echo "✨ 备份完成!"
