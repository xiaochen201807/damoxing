/**
 * 数据库迁移脚本：sys_dify_config 表重构
 * 目标：支持一个页面配置多个 Dify 工作流 (1:N关系)
 * 
 * 变更：
 * - 旧设计：page_key 为主键（限制 1:1）
 * - 新设计：添加自增 id 主键，page_key + workflow_name 联合唯一
 * - 新增字段：workflow_type (工作流类型)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(DB_PATH);

console.log('🔄 开始迁移 sys_dify_config 表...');

db.serialize(() => {
    // Step 1: 创建新表结构
    console.log('  ✅ Step 1: 创建新表 sys_dify_config_new');
    db.run(`
        CREATE TABLE IF NOT EXISTS sys_dify_config_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page_key TEXT NOT NULL,
            workflow_name TEXT NOT NULL,
            workflow_type TEXT DEFAULT 'ai_analysis',
            api_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(page_key, workflow_name)
        )
    `, (err) => {
        if (err) {
            console.error('❌ 创建新表失败:', err.message);
            process.exit(1);
        }
    });

    // Step 2: 迁移数据（保留所有历史配置）
    console.log('  ✅ Step 2: 迁移数据到新表');
    db.run(`
        INSERT INTO sys_dify_config_new 
            (page_key, workflow_name, workflow_type, api_url, api_key, enabled, description)
        SELECT 
            page_key, 
            workflow_name,
            'ai_analysis' as workflow_type,  -- 默认类型
            api_url, 
            api_key, 
            enabled,
            description
        FROM sys_dify_config
    `, (err) => {
        if (err) {
            console.error('❌ 数据迁移失败:', err.message);
            console.log('   可能原因：旧表不存在或数据格式不匹配');
            // 不退出，继续执行（可能是全新安装）
        } else {
            console.log('  ✅ 数据迁移完成');
        }
    });

    // Step 3: 验证数据条数
    setTimeout(() => {
        db.get('SELECT COUNT(*) as count FROM sys_dify_config', (err, oldRow) => {
            if (err) {
                console.log('   ⚠️  旧表不存在，跳过数据验证');
                return;
            }

            db.get('SELECT COUNT(*) as count FROM sys_dify_config_new', (err, newRow) => {
                if (err) {
                    console.error('❌ 新表查询失败:', err.message);
                    return;
                }

                console.log(`  ✅ Step 3: 数据验证`);
                console.log(`     旧表记录数: ${oldRow.count}`);
                console.log(`     新表记录数: ${newRow.count}`);

                if (oldRow.count === newRow.count) {
                    console.log('     ✅ 数据迁移完整！');
                } else {
                    console.warn('     ⚠️  记录数不一致，请检查数据');
                }
            });
        });
    }, 500);

    // Step 4: 删除旧表，重命名新表
    setTimeout(() => {
        console.log('  ✅ Step 4: 替换旧表');
        db.run('DROP TABLE IF EXISTS sys_dify_config', (err) => {
            if (err) {
                console.error('❌ 删除旧表失败:', err.message);
                process.exit(1);
            }

            db.run('ALTER TABLE sys_dify_config_new RENAME TO sys_dify_config', (err) => {
                if (err) {
                    console.error('❌ 重命名表失败:', err.message);
                    process.exit(1);
                }

                // Step 5: 创建索引
                console.log('  ✅ Step 5: 创建索引');
                db.run('CREATE INDEX IF NOT EXISTS idx_dify_page_key ON sys_dify_config(page_key)', (err) => {
                    if (err) {
                        console.warn('⚠️  创建索引失败:', err.message);
                    }

                    console.log('');
                    console.log('🎉 迁移完成！新表结构：');
                    db.all('PRAGMA table_info(sys_dify_config)', (err, columns) => {
                        if (!err) {
                            console.table(columns.map(c => ({
                                字段名: c.name,
                                类型: c.type,
                                非空: c.notnull ? '是' : '否',
                                默认值: c.dflt_value || '-'
                            })));
                        }

                        db.close((err) => {
                            if (err) {
                                console.error('❌ 关闭数据库失败:', err.message);
                            } else {
                                console.log('✅ 数据库连接已关闭');
                            }
                        });
                    });
                });
            });
        });
    }, 1000);
});
