/**
 * 更新系统配置页面到数据库
 * 将 config_page_schema.json 更新到 sys_page_template 表中
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const schemaPath = path.resolve(__dirname, '../config_page_schema.json');

// 读取 JSON schema
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// 验证 JSON 格式
try {
    JSON.parse(schemaContent);
    logger.info('✅ Schema JSON 格式验证通过');
} catch (e) {
    logger.error('❌ Schema JSON 格式错误:', e.message);
    process.exit(1);
}

// 连接数据库
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        logger.error('❌ 无法连接到数据库:', err.message);
        process.exit(1);
    }
    logger.info('✅ 已连接到数据库');
});

const pageKey = 'config';
const title = '系统配置中心';

// 检查是否存在该页面模板
db.get(
    'SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1',
    [pageKey],
    (err, row) => {
        if (err) {
            logger.error('❌ 查询失败:', err.message);
            db.close();
            process.exit(1);
        }

        if (row) {
            // 存在则更新（会自动创建备份）
            logger.info(`📝 找到现有配置页面 (版本 ${row.version})，准备更新...`);
            updateTemplate(row);
        } else {
            // 不存在则创建
            logger.info('📝 配置页面不存在，准备创建...');
            createTemplate();
        }
    }
);

// 创建新模板
function createTemplate() {
    const sql = `INSERT INTO sys_page_template (page_key, title, schema_json, version, is_active) VALUES (?, ?, ?, 1, 1)`;

    db.run(sql, [pageKey, title, schemaContent], function (err) {
        if (err) {
            logger.error('❌ 创建失败:', err.message);
            db.close();
            process.exit(1);
        }

        logger.info('✅ 成功创建配置页面模板！');
        logger.info(`   ID: ${this.lastID}`);
        logger.info(`   page_key: ${pageKey}`);
        logger.info(`   title: ${title}`);
        logger.info(`   version: 1`);

        db.close();
    });
}

// 更新现有模板
function updateTemplate(currentRow) {
    const newVersion = currentRow.version + 1;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. 将当前版本标记为备份
        db.run(
            "UPDATE sys_page_template SET is_active = 0, backup_time = datetime('now', '+08:00') WHERE id = ?",
            [currentRow.id],
            (err) => {
                if (err) {
                    logger.error('❌ 备份当前版本失败:', err.message);
                    db.run('ROLLBACK');
                    db.close();
                    process.exit(1);
                }
                logger.info(`📦 已备份当前版本 (v${currentRow.version})`);
            }
        );

        // 2. 插入新版本
        db.run(
            'INSERT INTO sys_page_template (page_key, title, schema_json, version, is_active) VALUES (?, ?, ?, ?, 1)',
            [pageKey, title, schemaContent, newVersion],
            function (err) {
                if (err) {
                    logger.error('❌ 插入新版本失败:', err.message);
                    db.run('ROLLBACK');
                    db.close();
                    process.exit(1);
                }

                logger.info(`✅ 成功创建新版本 (v${newVersion})`);

                // 3. 清理旧备份（保留最近5个）
                db.run(
                    `DELETE FROM sys_page_template 
                     WHERE page_key = ? AND is_active = 0 
                     AND id NOT IN (
                         SELECT id FROM sys_page_template 
                         WHERE page_key = ? AND is_active = 0 
                         ORDER BY version DESC 
                         LIMIT 5
                     )`,
                    [pageKey, pageKey],
                    function (err) {
                        if (err) {
                            logger.error('⚠️  清理旧备份失败:', err.message);
                        } else if (this.changes > 0) {
                            logger.info(`🗑️  已清理 ${this.changes} 个旧备份`);
                        }

                        db.run('COMMIT');

                        logger.info('');
                        logger.info('🎉 配置页面更新完成！');
                        logger.info('');
                        logger.info('📊 更新摘要:');
                        logger.info(`   - page_key: ${pageKey}`);
                        logger.info(`   - title: ${title}`);
                        logger.info(`   - 旧版本: v${currentRow.version}`);
                        logger.info(`   - 新版本: v${newVersion}`);
                        logger.info('');
                        logger.info('💡 提示: 刷新浏览器 (http://localhost:5173/config) 查看更新');

                        db.close();
                    }
                );
            }
        );
    });
}
