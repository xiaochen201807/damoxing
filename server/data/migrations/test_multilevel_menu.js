/**
 * 测试脚本：创建多层级菜单示例数据
 * 用于验证多层菜单功能
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');

console.log('🧪 创建多层级菜单测试数据...\n');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    // 1. 查询现有菜单数量
    db.get("SELECT COUNT(*) as count FROM sys_menu", (err, row) => {
        if (err) {
            console.error('查询失败:', err);
            db.close();
            return;
        }

        console.log(`📊 当前菜单数量: ${row.count} 条\n`);

        // 2. 创建测试用的父菜单
        console.log('📝 创建测试菜单...\n');

        const insertSql = `
      INSERT INTO sys_menu (label, subtitle, page_key, path, icon, \`order\`, route_key, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

        // 创建一级菜单：系统设置
        db.run(insertSql, ['系统设置', '系统配置和管理', 'settings', '/dashboard/settings', 'fa fa-cogs', 100, 'dashboard', null], function (err) {
            if (err) {
                console.error('创建系统设置菜单失败:', err);
                return;
            }

            const settingsId = this.lastID;
            console.log(`✓ 创建一级菜单: 系统设置 (ID=${settingsId})`);

            // 创建二级菜单：用户管理
            db.run(insertSql, ['用户管理', '用户和角色管理', 'users', '/dashboard/users', 'fa fa-users', 1, 'dashboard', settingsId], function (err) {
                if (err) console.error('创建用户管理菜单失败:', err);
                else console.log(`  ├─ 创建二级菜单: 用户管理 (ID=${this.lastID}, parent=${settingsId})`);
            });

            // 创建二级菜单：权限设置
            db.run(insertSql, ['权限设置', '权限和角色配置', 'permissions', '/dashboard/permissions', 'fa fa-lock', 2, 'dashboard', settingsId], function (err) {
                if (err) console.error('创建权限设置菜单失败:', err);
                else {
                    const permissionsId = this.lastID;
                    console.log(`  ├─ 创建二级菜单: 权限设置 (ID=${permissionsId}, parent=${settingsId})`);

                    // 创建三级菜单：角色管理
                    db.run(insertSql, ['角色管理', '角色设置', 'roles', '/dashboard/roles', 'fa fa-id-badge', 1, 'dashboard', permissionsId], function (err) {
                        if (err) console.error('创建角色管理菜单失败:', err);
                        else console.log(`  │   └─ 创建三级菜单: 角色管理 (ID=${this.lastID}, parent=${permissionsId})`);
                    });
                }
            });

            // 创建二级菜单：日志查看
            db.run(insertSql, ['日志查看', '系统日志和审计', 'logs', '/dashboard/logs', 'fa fa-file-text', 3, 'dashboard', settingsId], function (err) {
                if (err) console.error('创建日志查看菜单失败:', err);
                else console.log(`  └─ 创建二级菜单: 日志查看 (ID=${this.lastID}, parent=${settingsId})`);

                // 等待所有插入完成后查询结果
                setTimeout(() => {
                    console.log('\n📊 验证菜单结构:\n');
                    db.all(`
            SELECT 
              id,
              label,
              parent_id,
              CASE 
                WHEN parent_id IS NULL THEN '根级'
                WHEN EXISTS(SELECT 1 FROM sys_menu p WHERE p.id = sys_menu.parent_id AND p.parent_id IS NULL) THEN '二级'
                ELSE '三级+'
              END as level,
              page_key,
              \`order\`
            FROM sys_menu
            ORDER BY route_key ASC, parent_id ASC NULLS FIRST, \`order\` ASC, id ASC
          `, (err, rows) => {
                        if (err) {
                            console.error('查询失败:', err);
                        } else {
                            rows.forEach(row => {
                                const indent = row.level === '根级' ? '└' : (row.level === '二级' ? '  ├' : '    └');
                                console.log(`${indent} [${row.level}] ${row.label} (ID=${row.id}, parent=${row.parent_id || 'NULL'})`);
                            });

                            console.log('\n🎉 测试数据创建完成！');
                            console.log('\n💡 提示：');
                            console.log('   - 启动前端应用查看多层菜单效果');
                            console.log('   - 点击"系统设置"可展开/折叠子菜单');
                            console.log('   - 点击"权限设置"可查看三级菜单"角色管理"');
                        }

                        db.close();
                    });
                }, 500);
            });
        });
    });
});
