/**
 * 数据库统一初始化脚本 (All-in-One)
 * 整合所有表结构创建和数据迁移
 * 
 * 包含内容：
 * 1. 所有表结构创建（来自 db/migrations/*.js）
 * 2. 数据迁移（来自旧的 scripts/*.js）
 * 
 * 使用方法：
 *   node data/migrations/init_database.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../database.sqlite');

class DatabaseInitializer {
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

    // 001 - 初始表结构
    async createInitialSchema() {
        console.log('📦 Creating initial schema...');

        await this.run(`
            CREATE TABLE IF NOT EXISTS sys_menu (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                path TEXT UNIQUE NOT NULL,
                icon TEXT,
                subtitle TEXT,
                page_key TEXT,
                \`order\` INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✓ sys_menu');

        await this.run(`
            CREATE TABLE IF NOT EXISTS sys_page_template (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                page_key TEXT NOT NULL,
                title TEXT NOT NULL,
                schema_json TEXT NOT NULL,
                version INTEGER DEFAULT 1,
                is_active INTEGER DEFAULT 1,
                backup_time DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                source_template_id TEXT,
                source_params TEXT,
                UNIQUE(page_key, version)
            )
        `);
        console.log('   ✓ sys_page_template');

        // 用户表
        await this.run(`
            CREATE TABLE IF NOT EXISTS sys_user (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                nickname TEXT,
                email TEXT,
                role TEXT DEFAULT 'user',
                is_active INTEGER DEFAULT 1,
                last_login DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✓ sys_user');

        // 检查是否存在默认管理员
        const adminExists = await this.get(
            'SELECT id FROM sys_user WHERE username = ?',
            ['admin']
        );

        if (!adminExists) {
            // 创建默认管理员账号 (密码: admin123)
            // 注意：密码使用明文存储仅用于演示，生产环境应使用 bcrypt 等哈希算法
            await this.run(`
                INSERT INTO sys_user (username, password, nickname, role)
                VALUES ('admin', 'admin123', '系统管理员', 'admin')
            `);
            console.log('   ✓ Created default admin user (admin/admin123)');
        }
    }

    // 002 - Dify 配置表
    async createDifyConfig() {
        console.log('📦 Creating Dify config table...');

        await this.run(`
            CREATE TABLE IF NOT EXISTS sys_dify_config (
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

        await this.run('CREATE INDEX IF NOT EXISTS idx_dify_page_key ON sys_dify_config(page_key)');
        console.log('   ✓ sys_dify_config');
    }

    // 003 - 后端配置表
    async createBackendConfig() {
        console.log('📦 Creating backend config table...');

        await this.run(`
            CREATE TABLE IF NOT EXISTS sys_backend_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_key TEXT UNIQUE NOT NULL,
                config_value TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✓ sys_backend_config');
    }

    // 007 - 组件库和模板配置表
    async createSchemaBuilderTables() {
        console.log('📦 Creating schema builder tables...');

        // 组件库表
        await this.run(`
            CREATE TABLE IF NOT EXISTS sys_component_library (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                component_id TEXT UNIQUE NOT NULL,
                component_name TEXT NOT NULL,
                category TEXT,
                description TEXT,
                template_file TEXT NOT NULL,
                params_schema TEXT,
                default_params TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✓ sys_component_library');

        // 模板配置表
        await this.run(`
            CREATE TABLE IF NOT EXISTS sys_page_templates_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id TEXT UNIQUE NOT NULL,
                template_name TEXT NOT NULL,
                description TEXT,
                template_file TEXT NOT NULL,
                components TEXT NOT NULL,
                params_schema TEXT NOT NULL,
                default_params TEXT,
                preview_image TEXT,
                theme_id TEXT DEFAULT 'cxd',
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✓ sys_page_templates_config');

        // 样式主题表
        await this.run(`
            CREATE TABLE IF NOT EXISTS sys_style_themes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                theme_id TEXT UNIQUE NOT NULL,
                theme_name TEXT NOT NULL,
                description TEXT,
                css_variables TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✓ sys_style_themes');
    }

    // 迁移记录表
    async createMigrationTable() {
        await this.run(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration_name TEXT UNIQUE NOT NULL,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    async isMigrationApplied(migrationName) {
        const row = await this.get(
            'SELECT id FROM schema_migrations WHERE migration_name = ?',
            [migrationName]
        );
        return !!row;
    }

    async recordMigration(migrationName) {
        await this.run(
            'INSERT OR IGNORE INTO schema_migrations (migration_name) VALUES (?)',
            [migrationName]
        );
    }

    // 执行完整初始化
    async initialize() {
        console.log('🚀 Starting database initialization...\n');

        try {
            await this.connect();
            await this.createMigrationTable();

            // 001 - 初始表结构
            if (!await this.isMigrationApplied('001_initial_schema')) {
                await this.createInitialSchema();
                await this.recordMigration('001_initial_schema');
            } else {
                console.log('⏭️  001_initial_schema already applied');
            }

            // 002 - Dify 配置
            if (!await this.isMigrationApplied('002_add_dify_config')) {
                await this.createDifyConfig();
                await this.recordMigration('002_add_dify_config');
            } else {
                console.log('⏭️  002_add_dify_config already applied');
            }

            // 003 - 后端配置
            if (!await this.isMigrationApplied('003_add_backend_config')) {
                await this.createBackendConfig();
                await this.recordMigration('003_add_backend_config');
            } else {
                console.log('⏭️  003_add_backend_config already applied');
            }

            // 007 - Schema Builder 表（包含了组件库和模板配置）
            if (!await this.isMigrationApplied('007_add_schema_builder_tables')) {
                await this.createSchemaBuilderTables();
                await this.recordMigration('007_add_schema_builder_tables');
            } else {
                console.log('⏭️  007_add_schema_builder_tables already applied');
            }

            console.log('\n🎉 Database initialization completed successfully!');
        } catch (error) {
            console.error('\n❌ Initialization failed:', error.message);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// 主程序
async function main() {
    // 检查是否需要从旧位置拷贝数据库
    const oldDbPath = path.join(__dirname, '../../database.sqlite');
    const newDbPath = path.join(__dirname, '../database.sqlite');

    if (fs.existsSync(oldDbPath) && !fs.existsSync(newDbPath)) {
        console.log('📦 Copying database from old location...');
        fs.copyFileSync(oldDbPath, newDbPath);
        console.log('   ✓ Copied to data/database.sqlite\n');
    }

    const initializer = new DatabaseInitializer(newDbPath);
    await initializer.initialize();
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { DatabaseInitializer };
