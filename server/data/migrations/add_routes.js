/**
 * 动态路由系统数据库迁移
 * 新增 sys_routes 表，修改 sys_menu 表
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/database.sqlite');
const db = new sqlite3.Database(DB_PATH);

console.log('🚀 开始动态路由系统数据库迁移...\n');

db.serialize(() => {
    // 1. 创建 sys_routes 表
    console.log('📋 Step 1: 创建 sys_routes 表...');
    db.run(`
        CREATE TABLE IF NOT EXISTS sys_routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route_key TEXT UNIQUE NOT NULL,
            route_path TEXT NOT NULL,
            route_name TEXT NOT NULL,
            icon TEXT,
            component_type TEXT DEFAULT 'dynamic',
            component_path TEXT,
            layout_type TEXT DEFAULT 'default',
            order_num INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            description TEXT,
            created_at DATETIME DEFAULT (datetime('now', '+08:00')),
            updated_at DATETIME DEFAULT (datetime('now', '+08:00'))
        )
    `, (err) => {
        if (err) {
            console.error('❌ 创建 sys_routes 表失败:', err.message);
            return;
        }
        console.log('✅ sys_routes 表创建成功\n');
    });

    // 2. 插入初始路由数据
    console.log('📋 Step 2: 插入初始路由数据...');
    const initialRoutes = [
        {
            route_key: 'dashboard',
            route_path: '/dashboard',
            route_name: '仪表板',
            icon: 'fa fa-dashboard',
            component_type: 'dynamic',
            order_num: 1,
            description: '动态页面模块，支持配置化页面'
        },
        {
            route_key: 'system',
            route_path: '/system',
            route_name: '系统管理',
            icon: 'fa fa-cog',
            component_type: 'static',
            component_path: '/system/config',
            order_num: 99,
            description: '系统配置和管理功能'
        }
    ];

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO sys_routes 
        (route_key, route_path, route_name, icon, component_type, component_path, order_num, description) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let insertCount = 0;
    initialRoutes.forEach(route => {
        insertStmt.run(
            route.route_key,
            route.route_path,
            route.route_name,
            route.icon,
            route.component_type,
            route.component_path || null,
            route.order_num,
            route.description,
            function (err) {
                if (err) {
                    console.error(`❌ 插入路由 ${route.route_key} 失败:`, err.message);
                } else if (this.changes > 0) {
                    insertCount++;
                    console.log(`✅ 插入路由: ${route.route_key} (${route.route_name})`);
                }
            }
        );
    });

    insertStmt.finalize(() => {
        console.log(`\n📊 共插入 ${insertCount} 条路由记录\n`);
    });

    // 3. 修改 sys_menu 表，添加 route_key 字段
    console.log('📋 Step 3: 修改 sys_menu 表...');

    // 检查字段是否已存在
    db.get("PRAGMA table_info(sys_menu)", (err, row) => {
        if (err) {
            console.error('❌ 查询表结构失败:', err.message);
            return;
        }

        // 查询所有列
        db.all("PRAGMA table_info(sys_menu)", (err, columns) => {
            const hasRouteKey = columns.some(col => col.name === 'route_key');

            if (hasRouteKey) {
                console.log('⚠️  route_key 字段已存在，跳过添加\n');
            } else {
                db.run(`
                    ALTER TABLE sys_menu ADD COLUMN route_key TEXT DEFAULT 'dashboard'
                `, (err) => {
                    if (err) {
                        console.error('❌ 添加 route_key 字段失败:', err.message);
                        return;
                    }
                    console.log('✅ 添加 route_key 字段成功\n');
                });
            }
        });
    });

    // 4. 更新现有菜单数据，设置默认 route_key
    console.log('📋 Step 4: 更新现有菜单数据...');
    db.run(`
        UPDATE sys_menu 
        SET route_key = 'dashboard' 
        WHERE route_key IS NULL OR route_key = ''
    `, function (err) {
        if (err) {
            console.error('❌ 更新菜单数据失败:', err.message);
            return;
        }
        console.log(`✅ 更新 ${this.changes} 条菜单记录的 route_key\n`);
    });

    // 5. 记录迁移到 schema_migrations
    db.run(`
        INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
        VALUES (?, ?, datetime('now', '+08:00'))
    `, ['006', 'add_dynamic_routes_system'], (err) => {
        if (err) {
            console.error('❌ 记录迁移失败:', err.message);
        } else {
            console.log('✅ 迁移记录已保存\n');
        }
    });
});

// 等待所有操作完成后关闭数据库
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('❌ 关闭数据库连接失败:', err.message);
        } else {
            console.log('🎉 数据库迁移完成！');
            console.log('\n下一步：');
            console.log('1. 运行 `node data/migrations/add_routes.js` 执行迁移');
            console.log('2. 实施 Phase 2: 创建路由配置 API');
        }
    });
}, 2000);
