#!/bin/sh
# 数据库自动备份脚本
# 每天凌晨 2 点执行一次备份

BACKUP_DIR=/app/data/backups
DB_PATH=/app/data/database.sqlite
LOG_FILE=/app/data/logs/backup.log
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/database_$TIMESTAMP.sqlite"

# 确保备份目录存在
mkdir -p "$BACKUP_DIR"

# 记录开始时间
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database backup..." >> "$LOG_FILE"

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Database file not found: $DB_PATH" >> "$LOG_FILE"
    exit 1
fi

# 使用 SQLite 的 .backup 命令进行备份（在线备份，不锁表）
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# 检查备份是否成功
if [ $? -eq 0 ]; then
    # 获取备份文件大小
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed successfully: $BACKUP_FILE ($BACKUP_SIZE)" >> "$LOG_FILE"
    
    # 保留最近 7 天的备份，删除旧备份
    find "$BACKUP_DIR" -name "database_*.sqlite" -type f -mtime +7 -delete
    
    # 统计当前备份数量
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "database_*.sqlite" -type f | wc -l)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Total backups: $BACKUP_COUNT (keeping last 7 days)" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup failed!" >> "$LOG_FILE"
    exit 1
fi

# 可选：压缩备份文件以节省空间
# gzip "$BACKUP_FILE"
# echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup compressed: ${BACKUP_FILE}.gz" >> "$LOG_FILE"

exit 0
