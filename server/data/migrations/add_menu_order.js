/**
 * 添加 order 字段到 sys_menu 表
 * 支持菜单排序功能
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(DB_PATH);

console.log('🚀 开始添加 sys_menu 表的 order 字段...\n');

db.serialize(() => {
    // 1. 检查字段是否已存在
    console.log('📋 Step 1: 检查 order 字段是否存在...');
    
    db.all("PRAGMA table_info(sys_menu)", (err, columns) => {
        if (err) {
            console.error('❌ 查询表结构失败:', err.message);
            db.close();
            process.exit(1);
        }

        const hasOrderField = columns.some(col => col.name === 'order');

        if (hasOrderField) {
            console.log('⚠️  order 字段已存在，跳过添加\n');
            db.close();
            process.exit(0);
        } else {
            console.log('✅ order 字段不存在，准备添加...\n');
            
            // 2. 添加 order 字段
            console.log('📋 Step 2: 添加 order 字段...');
            db.run(`
                ALTER TABLE sys_menu ADD COLUMN \`order\` INTEGER DEFAULT 0
            `, (err) => {
                if (err) {
                    console.error('❌ 添加 order 字段失败:', err.message);
                    db.close();
                    process.exit(1);
                }
                console.log('✅ order 字段添加成功\n');

                // 3. 为现有菜单设置默认 order 值（根据当前 id 排序）
                console.log('📋 Step 3: 为现有菜单设置 order 值...');
                db.run(`
                    UPDATE sys_menu 
                    SET \`order\` = id * 10
                    WHERE \`order\` = 0 OR \`order\` IS NULL
                `, function (err) {
                    if (err) {
                        console.error('❌ 更新 order 值失败:', err.message);
                        db.close();
                        process.exit(1);
                    }
                    console.log(`✅ 更新了 ${this.changes} 条菜单的 order 值\n`);

                    // 4. 记录迁移
                    db.run(`
                        INSERT OR IGNORE INTO schema_migrations (migration_name)
                        VALUES ('add_menu_order')
                    `, (err) => {
                        if (err) {
                            console.error('❌ 记录迁移失败:', err.message);
                        } else {
                            console.log('✅ 迁移记录已保存\n');
                        }

                        console.log('🎉 迁移完成！');
                        console.log('\n下一步：');
                        console.log('1. 更新后端 API 以支持 order 字段');
                        console.log('2. 更新前端 Schema 以显示和编辑 order 字段');
                        
                        db.close();
                    });
                });
            });
        }
    });
});
