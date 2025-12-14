/**
 * 数据库迁移工具
 * 用于执行和管理数据库迁移脚本
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// 加载环境变量
require('dotenv').config();

const dbPath = path.resolve(__dirname, '../database.sqlite');
const migrationsDir = path.resolve(__dirname, './migrations');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        logger.error('❌ 无法连接到数据库:', err);
        process.exit(1);
    }
    logger.info('✅ 已连接到数据库:', dbPath);
});

// 创建迁移记录表
function createMigrationTable() {
    return new Promise((resolve, reject) => {
        db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// 获取已执行的迁移
function getExecutedMigrations() {
    return new Promise((resolve, reject) => {
        db.all('SELECT name FROM migrations ORDER BY id', (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(row => row.name));
        });
    });
}

// 记录迁移执行
function recordMigration(name) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO migrations (name) VALUES (?)', [name], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// 删除迁移记录
function removeMigrationRecord(name) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM migrations WHERE name = ?', [name], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// 获取所有迁移文件
function getMigrationFiles() {
    if (!fs.existsSync(migrationsDir)) {
        logger.warn('⚠️  迁移目录不存在，创建目录:', migrationsDir);
        fs.mkdirSync(migrationsDir, { recursive: true });
        return [];
    }

    return fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.js'))
        .sort();
}

// 执行迁移（向上）
async function runMigrations() {
    try {
        await createMigrationTable();
        const executed = await getExecutedMigrations();
        const allMigrations = getMigrationFiles();
        const pending = allMigrations.filter(m => !executed.includes(m));

        if (pending.length === 0) {
            logger.info('✅ 没有待执行的迁移');
            return;
        }

        logger.info(`📦 发现 ${pending.length} 个待执行的迁移:\n`);

        for (const migration of pending) {
            logger.info(`⏳ 执行迁移: ${migration}`);
            const migrationModule = require(path.join(migrationsDir, migration));

            if (typeof migrationModule.up !== 'function') {
                logger.error(`❌ 迁移文件 ${migration} 缺少 up 方法`);
                continue;
            }

            await new Promise((resolve, reject) => {
                migrationModule.up(db);
                // 给一点时间让 serialize 完成
                setTimeout(() => {
                    recordMigration(migration)
                        .then(() => {
                            logger.info(`✅ 迁移完成: ${migration}\n`);
                            resolve();
                        })
                        .catch(reject);
                }, 100);
            });
        }

        logger.info('🎉 所有迁移执行完成！');
    } catch (error) {
        logger.error('❌ 迁移执行失败:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

// 回滚迁移（向下）
async function rollbackMigration() {
    try {
        await createMigrationTable();
        const executed = await getExecutedMigrations();

        if (executed.length === 0) {
            logger.info('✅ 没有可回滚的迁移');
            return;
        }

        const lastMigration = executed[executed.length - 1];
        logger.info(`⏳ 回滚迁移: ${lastMigration}`);

        const migrationModule = require(path.join(migrationsDir, lastMigration));

        if (typeof migrationModule.down !== 'function') {
            logger.error(`❌ 迁移文件 ${lastMigration} 缺少 down 方法`);
            return;
        }

        await new Promise((resolve, reject) => {
            migrationModule.down(db);
            setTimeout(() => {
                removeMigrationRecord(lastMigration)
                    .then(() => {
                        logger.info(`✅ 回滚完成: ${lastMigration}`);
                        resolve();
                    })
                    .catch(reject);
            }, 100);
        });

    } catch (error) {
        logger.error('❌ 回滚失败:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

// 命令行参数处理
const command = process.argv[2];

switch (command) {
    case 'up':
    case 'migrate':
        runMigrations();
        break;
    case 'down':
    case 'rollback':
        rollbackMigration();
        break;
    default:
        console.log(`
数据库迁移工具

用法:
  node db/migrate.js up        # 执行所有待执行的迁移
  node db/migrate.js migrate   # 同上
  node db/migrate.js down      # 回滚最后一次迁移
  node db/migrate.js rollback  # 同上

示例:
  npm run db:migrate           # 执行迁移
  npm run db:rollback          # 回滚迁移
    `);
        process.exit(0);
}
