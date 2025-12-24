/**
 * 数据库迁移：为 sys_menu 表添加 parent_id 字段
 * 用于支持多层级菜单结构
 * 
 * 执行方式：
 *   node server/data/migrations/add_menu_parent_id.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../database.sqlite');

console.log('🚀 开始菜单层级支持迁移...\n');
console.log(`数据库路径: ${DB_PATH}\n`);

// 1. 备份数据库
function backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, `../backups/database_backup_${timestamp}.sqlite`);

    // 确保备份目录存在
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('📦 备份数据库...');
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`   ✓ 备份完成: ${backupPath}\n`);

    return backupPath;
}

// 2. 执行迁移
async function migrate() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                reject(err);
                return;
            }
        });

        db.serialize(() => {
            // 检查字段是否已存在
            db.all("PRAGMA table_info(sys_menu)", (err, columns) => {
                if (err) {
                    db.close();
                    return reject(err);
                }

                const hasParentId = columns.some(col => col.name === 'parent_id');

                if (hasParentId) {
                    console.log('⏭️  parent_id 字段已存在，跳过迁移\n');
                    db.close();
                    resolve({ skipped: true });
                    return;
                }

                console.log('📝 添加 parent_id 字段到 sys_menu 表...');

                db.run(
                    `ALTER TABLE sys_menu ADD COLUMN parent_id INTEGER DEFAULT NULL`,
                    (err) => {
                        if (err) {
                            db.close();
                            return reject(err);
                        }

                        console.log('   ✓ parent_id 字段添加成功\n');

                        // 验证字段添加
                        db.all("PRAGMA table_info(sys_menu)", (err, updatedColumns) => {
                            if (err) {
                                db.close();
                                return reject(err);
                            }

                            const parentIdColumn = updatedColumns.find(col => col.name === 'parent_id');

                            if (parentIdColumn) {
                                console.log('✅ 验证成功！字段信息：');
                                console.log(`   - 字段名: ${parentIdColumn.name}`);
                                console.log(`   - 类型: ${parentIdColumn.type}`);
                                console.log(`   - 默认值: ${parentIdColumn.dflt_value || 'NULL'}\n`);

                                // 查询现有菜单数量
                                db.get("SELECT COUNT(*) as count FROM sys_menu", (err, row) => {
                                    if (err) {
                                        db.close();
                                        return reject(err);
                                    }

                                    console.log(`📊 现有菜单数量: ${row.count} 条`);
                                    console.log('   所有现有菜单的 parent_id 已自动设置为 NULL（根级菜单）\n');

                                    db.close();
                                    resolve({ success: true, menuCount: row.count });
                                });
                            } else {
                                db.close();
                                reject(new Error('字段添加验证失败'));
                            }
                        });
                    }
                );
            });
        });
    });
}

// 主程序
async function main() {
    try {
        // 备份数据库
        const backupPath = backupDatabase();

        // 执行迁移
        const result = await migrate();

        if (result.skipped) {
            console.log('🎉 迁移完成（已经执行过）');
        } else {
            console.log('🎉 迁移成功完成！');
            console.log('\n📋 迁移总结：');
            console.log(`   - 添加字段: parent_id (INTEGER, DEFAULT NULL)`);
            console.log(`   - 影响菜单: ${result.menuCount} 条`);
            console.log(`   - 备份位置: ${backupPath}`);
            console.log('\n✨ 现在可以创建多层级菜单了！');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ 迁移失败:', error.message);
        console.error('\n💡 提示：');
        console.error('   1. 检查数据库文件是否存在');
        console.error('   2. 确认没有其他程序正在使用数据库');
        console.error('   3. 如需回滚，可使用备份文件恢复\n');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { migrate, backupDatabase };
