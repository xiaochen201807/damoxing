#!/bin/bash
#
# 数据库恢复脚本
# 用法: ./scripts/restore-db.sh <backup-file>
#

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$SERVER_DIR/backups"
DB_FILE="$SERVER_DIR/database.sqlite"

# 检查参数
if [ -z "$1" ]; then
    echo "用法: $0 <backup-file>"
    echo ""
    echo "可用的备份文件:"
    ls -1 "$BACKUP_DIR"/*.sqlite 2>/dev/null | while read backup; do
        echo "  - $(basename "$backup")"
    done
    exit 1
fi

BACKUP_FILE="$1"

# 如果只提供了文件名，添加完整路径
if [ ! -f "$BACKUP_FILE" ]; then
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

# 如果备份文件没有 .sqlite 后缀，添加它
if [[ "$BACKUP_FILE" != *.sqlite ]]; then
    BACKUP_FILE="${BACKUP_FILE}.sqlite"
fi

# 检查备份文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ 错误: 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  警告: 此操作将覆盖当前数据库!"
echo "   当前数据库: $DB_FILE"
echo "   备份文件: $BACKUP_FILE"
echo ""
read -p "继续? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "已取消恢复"
    exit 0
fi

# 先备份当前数据库
if [ -f "$DB_FILE" ]; then
    echo "📦 备份当前数据库..."
    CURRENT_BACKUP="$BACKUP_DIR/before_restore_$(date +%Y%m%d_%H%M%S).sqlite"
    cp "$DB_FILE" "$CURRENT_BACKUP"
    echo "✅ 当前数据库已备份至: $CURRENT_BACKUP"
fi

# 恢复数据库
echo "🔄 恢复数据库..."
cp "$BACKUP_FILE" "$DB_FILE"

echo "✅ 数据库恢复完成!"
echo ""
echo "⚠️  请重启应用以使更改生效"
