/**
 * 注册任务项运行配置工具升级版页面
 *
 * 使用方法: node scripts/register_task_config_upgrade.js
 */

const path = require('path');
const nunjucks = require('nunjucks');
const db = require('../db');

const CONFIG = {
    route: {
        key: 'gjsj',
        name: '公积金设计',
        path: '/gjsj',
        icon: 'fa fa-sitemap',
        component_type: 'dynamic',
        order_num: 10,
        description: '公积金设计配置化页面'
    },
    page: {
        key: 'task_config_upgrade',
        title: '任务项运行配置工具',
        template_file: 'pages/task_config_upgrade.j2',
        description: '关键数据算法升级版任务项运行配置页面原型'
    },
    menu: {
        label: '任务项运行配置工具',
        icon: 'fa fa-sitemap',
        order: 30
    }
};

const env = nunjucks.configure(path.join(__dirname, '../templates'), {
    autoescape: false,
    throwOnUndefined: false,
    noCache: true
});

env.addFilter('tojson', function (value) {
    return JSON.stringify(value);
});

env.addFilter('fromjson', function (str) {
    if (!str) return null;
    try {
        return typeof str === 'string' ? JSON.parse(str) : str;
    } catch (_e) {
        return str;
    }
});

async function columnExists(table, column) {
    const rows = await db.all(`PRAGMA table_info(${table})`);
    return rows.some(row => row.name === column);
}

async function ensureRoute() {
    const route = await db.get('SELECT * FROM sys_routes WHERE route_key = ?', [CONFIG.route.key]);

    if (route) {
        await db.run(
            `UPDATE sys_routes
             SET route_name = ?, route_path = ?, icon = ?, component_type = ?, order_num = ?, description = ?, is_active = 1, updated_at = datetime('now', '+08:00')
             WHERE route_key = ?`,
            [
                CONFIG.route.name,
                CONFIG.route.path,
                CONFIG.route.icon,
                CONFIG.route.component_type,
                CONFIG.route.order_num,
                CONFIG.route.description,
                CONFIG.route.key
            ]
        );
        return 'updated';
    }

    await db.run(
        `INSERT INTO sys_routes
         (route_key, route_path, route_name, icon, component_type, order_num, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            CONFIG.route.key,
            CONFIG.route.path,
            CONFIG.route.name,
            CONFIG.route.icon,
            CONFIG.route.component_type,
            CONFIG.route.order_num,
            CONFIG.route.description
        ]
    );

    return 'created';
}

async function ensurePage(schemaJson) {
    const existingPage = await db.get(
        'SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1',
        [CONFIG.page.key]
    );

    if (existingPage) {
        await db.run(
            `UPDATE sys_page_template
             SET schema_json = ?, title = ?, updated_at = datetime('now', '+08:00'), source_template_id = ?, source_params = ?
             WHERE id = ?`,
            [
                schemaJson,
                CONFIG.page.title,
                CONFIG.page.key,
                JSON.stringify({}),
                existingPage.id
            ]
        );
        return 'updated';
    }

    await db.run(
        `INSERT INTO sys_page_template
         (page_key, title, schema_json, version, is_active, source_template_id, source_params)
         VALUES (?, ?, ?, 1, 1, ?, ?)`,
        [
            CONFIG.page.key,
            CONFIG.page.title,
            schemaJson,
            CONFIG.page.key,
            JSON.stringify({})
        ]
    );

    return 'created';
}

async function ensureMenu() {
    const menuPath = `${CONFIG.route.path}/${CONFIG.page.key}`;
    const existingMenu = await db.get('SELECT * FROM sys_menu WHERE page_key = ?', [CONFIG.page.key]);
    const hasRouteKey = await columnExists('sys_menu', 'route_key');

    if (existingMenu) {
        if (hasRouteKey) {
            await db.run(
                `UPDATE sys_menu
                 SET label = ?, path = ?, icon = ?, \`order\` = ?, route_key = ?
                 WHERE page_key = ?`,
                [
                    CONFIG.menu.label,
                    menuPath,
                    CONFIG.menu.icon,
                    CONFIG.menu.order,
                    CONFIG.route.key,
                    CONFIG.page.key
                ]
            );
        } else {
            await db.run(
                `UPDATE sys_menu
                 SET label = ?, path = ?, icon = ?, \`order\` = ?
                 WHERE page_key = ?`,
                [
                    CONFIG.menu.label,
                    menuPath,
                    CONFIG.menu.icon,
                    CONFIG.menu.order,
                    CONFIG.page.key
                ]
            );
        }

        return 'updated';
    }

    if (hasRouteKey) {
        await db.run(
            `INSERT INTO sys_menu (label, page_key, path, icon, \`order\`, route_key)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                CONFIG.menu.label,
                CONFIG.page.key,
                menuPath,
                CONFIG.menu.icon,
                CONFIG.menu.order,
                CONFIG.route.key
            ]
        );
    } else {
        await db.run(
            `INSERT INTO sys_menu (label, page_key, path, icon, \`order\`)
             VALUES (?, ?, ?, ?, ?)`,
            [
                CONFIG.menu.label,
                CONFIG.page.key,
                menuPath,
                CONFIG.menu.icon,
                CONFIG.menu.order
            ]
        );
    }

    return 'created';
}

async function ensureTemplateConfig() {
    const existingConfig = await db.get(
        'SELECT * FROM sys_page_templates_config WHERE template_id = ?',
        [CONFIG.page.key]
    );
    const components = JSON.stringify(['crud', 'form', 'dialog']);
    const paramsSchema = JSON.stringify({ type: 'object', properties: {} });
    const defaultParams = JSON.stringify({});

    if (existingConfig) {
        await db.run(
            `UPDATE sys_page_templates_config
             SET template_name = ?, description = ?, template_file = ?, components = ?, params_schema = ?, default_params = ?, preview_image = ?, theme_id = ?, is_active = 1
             WHERE template_id = ?`,
            [
                CONFIG.page.title,
                CONFIG.page.description,
                CONFIG.page.template_file,
                components,
                paramsSchema,
                defaultParams,
                '/templates/default.png',
                'cxd',
                CONFIG.page.key
            ]
        );
        return 'updated';
    }

    await db.run(
        `INSERT INTO sys_page_templates_config
         (template_id, template_name, description, template_file, components, params_schema, default_params, preview_image, theme_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            CONFIG.page.key,
            CONFIG.page.title,
            CONFIG.page.description,
            CONFIG.page.template_file,
            components,
            paramsSchema,
            defaultParams,
            '/templates/default.png',
            'cxd'
        ]
    );

    return 'created';
}

async function main() {
    const globalApiPrefix = process.env.API_ROUTE_PREFIX || '/api';
    const rendered = env.render(CONFIG.page.template_file, {
        title: CONFIG.page.title,
        GLOBAL_API_PREFIX: globalApiPrefix
    });
    const parsed = JSON.parse(rendered);
    const schemaJson = JSON.stringify(parsed);

    const routeStatus = await ensureRoute();
    const pageStatus = await ensurePage(schemaJson);
    const menuStatus = await ensureMenu();
    const templateStatus = await ensureTemplateConfig();

    console.log('任务项运行配置工具升级版页面注册完成');
    console.log(`- route: ${routeStatus}`);
    console.log(`- page: ${pageStatus}`);
    console.log(`- menu: ${menuStatus}`);
    console.log(`- template config: ${templateStatus}`);
    console.log(`- path: ${CONFIG.route.path}/${CONFIG.page.key}`);
}

main().catch(err => {
    console.error('注册失败:', err);
    process.exit(1);
});
