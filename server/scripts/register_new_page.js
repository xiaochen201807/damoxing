/**
 * 注册新页面脚本
 * 用于自动注册路由、模板和菜单
 * 
 * 使用方法: node scripts/register_new_page.js
 */
const db = require('../db');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 =================
const CONFIG = {
    // 路由配置 (使用 gjsj 前缀，适配 gjsj-1.0 分支)
    route: {
        key: 'gjsj',                  // 路由标识
        name: '公积金设计',            // 路由显示名称
        path: '/gjsj',                // 路由路径
        component_type: 'dynamic',    // 组件类型
        order_num: 10                 // 排序
    },
    // 页面模板配置
    page: {
        key: 'business_standard',     // 页面标识
        title: '业务标准库',           // 页面标题
        template_file: 'business_standard.j2' // 模板文件名
    },
    // 菜单配置
    menu: {
        label: '业务标准库',           // 菜单显示名称
        icon: 'fa fa-book',           // 菜单图标
        order: 10                     // 排序
    }
};
// ===========================================

const templatePath = path.join(__dirname, '../templates/pages', CONFIG.page.template_file);

// 辅助函数：Promise 化 database run
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// 辅助函数：Promise 化 database get
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row); // row 可能为 undefined
        });
    });
}

async function main() {
    console.log('🚀 开始注册新页面...\n');

    try {
        // 1. 读取模板文件
        if (!fs.existsSync(templatePath)) {
            throw new Error(`找不到模板文件: ${templatePath}`);
        }
        console.log(`📖 读取模板文件: ${CONFIG.page.template_file}`);
        let schemaContent = fs.readFileSync(templatePath, 'utf-8');

        // 尝试解析 JSON 确保格式正确
        try {
            const json = JSON.parse(schemaContent);
            schemaContent = JSON.stringify(json);
        } catch (e) {
            console.log('   (模板包含非标准 JSON 内容，将作为字符串存储)');
        }

        // 2. 注册/更新路由 (sys_routes)
        console.log(`\n🛣️  检查路由: ${CONFIG.route.key}`);
        const existingRoute = await dbGet('SELECT * FROM sys_routes WHERE route_key = ?', [CONFIG.route.key]);

        if (existingRoute) {
            console.log('   路由已存在，更新信息...');
            await dbRun(
                `UPDATE sys_routes SET route_name = ?, is_active = 1, updated_at = datetime('now', '+08:00') WHERE route_key = ?`,
                [CONFIG.route.name, CONFIG.route.key]
            );
        } else {
            console.log('   创建新路由...');
            await dbRun(
                `INSERT INTO sys_routes (route_key, route_path, route_name, component_type, order_num) VALUES (?, ?, ?, ?, ?)`,
                [CONFIG.route.key, CONFIG.route.path, CONFIG.route.name, CONFIG.route.component_type, CONFIG.route.order_num]
            );
        }

        // 3. 注册/更新页面模板 (sys_page_template)
        console.log(`\n📄 注册页面模板: ${CONFIG.page.key}`);
        const existingPage = await dbGet('SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1', [CONFIG.page.key]);

        if (existingPage) {
            console.log('   页面已存在，创建新版本...');
            // 更新当前版本
            await dbRun(
                'UPDATE sys_page_template SET schema_json = ?, title = ? WHERE id = ?',
                [schemaContent, CONFIG.page.title, existingPage.id]
            );
        } else {
            console.log('   创建新页面...');
            await dbRun(
                'INSERT INTO sys_page_template (page_key, title, schema_json, version, is_active) VALUES (?, ?, ?, 1, 1)',
                [CONFIG.page.key, CONFIG.page.title, schemaContent]
            );
        }

        // 4. 注册/更新菜单 (sys_menu)
        console.log(`\n🧭 注册菜单: ${CONFIG.menu.label}`);
        const menuPath = `${CONFIG.route.path}/${CONFIG.page.key}`; // /gjsj/business_standard
        const existingMenu = await dbGet('SELECT * FROM sys_menu WHERE page_key = ?', [CONFIG.page.key]);

        if (existingMenu) {
            console.log('   菜单已存在，更新信息...');
            await dbRun(
                `UPDATE sys_menu SET label = ?, icon = ?, route_key = ?, path = ? WHERE page_key = ?`,
                [CONFIG.menu.label, CONFIG.menu.icon, CONFIG.route.key, menuPath, CONFIG.page.key]
            );
        } else {
            console.log('   创建新菜单...');
            await dbRun(
                `INSERT INTO sys_menu (label, page_key, path, icon, \`order\`, route_key) VALUES (?, ?, ?, ?, ?, ?)`,
                [CONFIG.menu.label, CONFIG.page.key, menuPath, CONFIG.menu.icon, CONFIG.menu.order, CONFIG.route.key]
            );
        }

        // 5. 注册/更新模板配置 (sys_page_templates_config) - 适配管理后台列表
        console.log(`\n📚 注册模板配置: ${CONFIG.page.key}`);
        const existingTemplateConfig = await dbGet('SELECT * FROM sys_page_templates_config WHERE template_id = ?', [CONFIG.page.key]);
        const templateFileRelative = `pages/${CONFIG.page.template_file}`;

        if (existingTemplateConfig) {
            console.log('   模板配置已存在，更新信息...');
            await dbRun(
                `UPDATE sys_page_templates_config SET 
                    template_name = ?, 
                    template_file = ?,
                    components = ?,
                    params_schema = ?,
                    default_params = ?,
                    preview_image = ?,
                    theme_id = ?
                  WHERE template_id = ?`,
                [
                    CONFIG.page.title,
                    templateFileRelative,
                    JSON.stringify(['crud']),
                    JSON.stringify({ type: 'object', properties: {} }),
                    JSON.stringify({}),
                    '/templates/default.png',
                    'antd',
                    CONFIG.page.key
                ]
            );
        } else {
            console.log('   创建新模板配置...');
            await dbRun(
                `INSERT INTO sys_page_templates_config (
                    template_id, template_name, description, template_file, 
                    components, params_schema, default_params, preview_image, theme_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    CONFIG.page.key,
                    CONFIG.page.title,
                    '业务标准库页面模板',
                    templateFileRelative,
                    JSON.stringify(['crud']), // components
                    JSON.stringify({ type: 'object', properties: {} }), // params_schema
                    JSON.stringify({}), // default_params
                    '/templates/default.png', // preview_image
                    'antd' // theme_id
                ]
            );
        }

        console.log('\n✅ 注册完成！');
        console.log(`👉 访问地址: http://localhost:xxxx${menuPath}`);

    } catch (err) {
        console.error('\n❌ 发生错误:', err);
        process.exit(1);
    }
}

main();
