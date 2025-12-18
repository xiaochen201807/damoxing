/**
 * 统一数据库迁移脚本 (v1.0.1)
 * 合并所有历史迁移，按顺序执行
 * 
 * Migrations:
 * - Migration 001: 添加 source_template_id 和 source_params 字段（追溯性）
 * - Migration 002: 重构 sys_dify_config 表（1:N 工作流支持）
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 数据库路径（新位置）
const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const MIGRATIONS_TABLE = 'schema_migrations';

class DatabaseMigrator {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async initMigrationsTable() {
        await this.run(`
            CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration_name TEXT UNIQUE NOT NULL,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Migrations table initialized');
    }

    async isMigrationApplied(migrationName) {
        const row = await this.get(
            `SELECT id FROM ${MIGRATIONS_TABLE} WHERE migration_name = ?`,
            [migrationName]
        );
        return !!row;
    }

    async recordMigration(migrationName) {
        await this.run(
            `INSERT INTO ${MIGRATIONS_TABLE} (migration_name) VALUES (?)`,
            [migrationName]
        );
    }

    // ========== Migration 001: 追溯性字段 ==========
    async migration001_addSourceColumns() {
        const migrationName = '001_add_source_columns';

        if (await this.isMigrationApplied(migrationName)) {
            console.log(`⏭️  Migration ${migrationName} already applied`);
            return;
        }

        console.log(`🔄 Running ${migrationName}...`);

        // 检查字段是否存在
        const columns = await this.all('PRAGMA table_info(sys_page_template)');
        const columnNames = columns.map(c => c.name);

        const fieldsToAdd = [
            { name: 'source_template_id', sql: 'ALTER TABLE sys_page_template ADD COLUMN source_template_id TEXT' },
            { name: 'source_params', sql: 'ALTER TABLE sys_page_template ADD COLUMN source_params TEXT' }
        ];

        for (const field of fieldsToAdd) {
            if (columnNames.includes(field.name)) {
                console.log(`   ✓ Column ${field.name} already exists`);
            } else {
                await this.run(field.sql);
                console.log(`   ✓ Added column: ${field.name}`);
            }
        }

        await this.recordMigration(migrationName);
        console.log(`✅ ${migrationName} completed`);
    }

    // ========== Migration 002: Dify 1:N 工作流 ==========
    async migration002_refactorDifyConfig() {
        const migrationName = '002_refactor_dify_config';

        if (await this.isMigrationApplied(migrationName)) {
            console.log(`⏭️  Migration ${migrationName} already applied`);
            return;
        }

        console.log(`🔄 Running ${migrationName}...`);

        // 检查新表是否已存在
        const tableExists = await this.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='sys_dify_config'"
        );

        if (!tableExists) {
            console.log('   ⚠️  sys_dify_config table does not exist, skipping migration');
            await this.recordMigration(migrationName);
            return;
        }

        // 检查表结构
        const columns = await this.all('PRAGMA table_info(sys_dify_config)');
        const columnNames = columns.map(c => c.name);

        // 如果已经是新结构（有id字段），跳过
        if (columnNames.includes('id') && columnNames.includes('workflow_type')) {
            console.log('   ✓ Table already has new structure');
            await this.recordMigration(migrationName);
            return;
        }

        // 执行迁移
        await this.run('BEGIN TRANSACTION');

        try {
            // 1. 创建新表
            await this.run(`
                CREATE TABLE sys_dify_config_new (
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
            `);
            console.log('   ✓ Created new table structure');

            // 2. 迁移数据
            await this.run(`
                INSERT INTO sys_dify_config_new 
                    (page_key, workflow_name, workflow_type, api_url, api_key, enabled, description)
                SELECT 
                    page_key, 
                    workflow_name,
                    'ai_analysis' as workflow_type,
                    api_url, 
                    api_key, 
                    enabled,
                    description
                FROM sys_dify_config
            `);

            const migratedCount = await this.get('SELECT COUNT(*) as count FROM sys_dify_config_new');
            console.log(`   ✓ Migrated ${migratedCount.count} records`);

            // 3. 替换表
            await this.run('DROP TABLE sys_dify_config');
            await this.run('ALTER TABLE sys_dify_config_new RENAME TO sys_dify_config');
            console.log('   ✓ Replaced old table');

            // 4. 创建索引
            await this.run('CREATE INDEX IF NOT EXISTS idx_dify_page_key ON sys_dify_config(page_key)');
            console.log('   ✓ Created index');

            await this.run('COMMIT');
            await this.recordMigration(migrationName);
            console.log(`✅ ${migrationName} completed`);
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }

    // ========== 执行所有迁移 ==========
    async runAll() {
        console.log('🚀 Starting database migrations...\n');

        try {
            await this.connect();
            await this.initMigrationsTable();

            // 按顺序执行迁移
            await this.migration001_addSourceColumns();
            await this.migration002_refactorDifyConfig();

            console.log('\n🎉 All migrations completed successfully!');
        } catch (error) {
            console.error('\n❌ Migration failed:', error.message);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// ========== 主程序 ==========
async function main() {
    // 检查是否需要迁移旧数据库
    const oldDbPath = path.join(__dirname, '../../database.sqlite');
    const newDbPath = path.join(__dirname, '../database.sqlite');

    if (fs.existsSync(oldDbPath) && !fs.existsSync(newDbPath)) {
        console.log('📦 Copying database to new location...');
        fs.copyFileSync(oldDbPath, newDbPath);
        console.log(`   ✓ Copied: database.sqlite → data/database.sqlite\n`);
    }

    const migrator = new DatabaseMigrator(newDbPath);
    await migrator.runAll();
}

// 运行迁移
if (require.main === module) {
    main().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { DatabaseMigrator };
