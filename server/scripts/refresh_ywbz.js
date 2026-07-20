/**
 * 用最新 j2 模板重渲染并写回活跃页面 schema_json
 * - 关键数据计算模型: page_key=ywbz, template=business_rule
 * - 业务办理标准库: page_key=main (source_template_id=business_standard)
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const nunjucks = require('nunjucks');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const TEMPLATES_DIR = path.join(__dirname, '../templates');

const env = nunjucks.configure(TEMPLATES_DIR, {
    autoescape: false,
    noCache: true
});

env.addFilter('tojson', function (value) {
    return JSON.stringify(value);
});
env.addFilter('fromjson', function (str) {
    if (!str) return null;
    try {
        return typeof str === 'string' ? JSON.parse(str) : str;
    } catch (e) {
        return str;
    }
});

const PAGES = [
    {
        pageKey: 'ywbz',
        templateFile: 'pages/business_rule.j2',
        templateId: 'business_rule'
    },
    {
        pageKey: 'main',
        templateFile: 'pages/business_standard.j2',
        templateId: 'business_standard',
        // 仅刷新标准库来源的 main，避免误伤其它 main 页面
        requireSourceTemplateId: 'business_standard'
    }
];

const db = new sqlite3.Database(DB_PATH);

function getActivePage(pageKey) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1',
            [pageKey],
            (err, row) => (err ? reject(err) : resolve(row))
        );
    });
}

function updateSchema(id, schema) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE sys_page_template SET schema_json = ?, updated_at = datetime("now", "+08:00") WHERE id = ?',
            [schema, id],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

async function refreshOne(cfg) {
    const row = await getActivePage(cfg.pageKey);
    if (!row) {
        console.warn(`[skip] active page not found: ${cfg.pageKey}`);
        return;
    }
    if (cfg.requireSourceTemplateId && row.source_template_id !== cfg.requireSourceTemplateId) {
        console.warn(
            `[skip] ${cfg.pageKey} source_template_id=${row.source_template_id}, expect ${cfg.requireSourceTemplateId}`
        );
        return;
    }

    let params = {};
    if (row.source_params) {
        try {
            params = JSON.parse(row.source_params);
        } catch (e) {
            console.error('Error parsing source_params', e);
        }
    }

    const context = {
        ...params,
        page_key: row.page_key,
        title: row.title,
        GLOBAL_API_PREFIX: process.env.API_ROUTE_PREFIX || '/api',
        template_id: cfg.templateId
    };

    console.log(`[render] ${cfg.pageKey} id=${row.id} <- ${cfg.templateFile}`);
    const schema = env.render(cfg.templateFile, context);
    JSON.parse(schema); // validate

    // 关键标记校验，确保新交互已写入
    const checks = {
        ywbz: ['import_error', '导出完成', '全量导入关键数据计算模型', 'silent'],
        main: ['导出历史', '导出完成', 'export_history', 'silent']
    };
    const need = checks[cfg.pageKey] || [];
    for (const token of need) {
        if (!schema.includes(token)) {
            throw new Error(`rendered schema missing expected token: ${token}`);
        }
    }

    await updateSchema(row.id, schema);
    console.log(`[ok] updated schema_json for ${cfg.pageKey} id=${row.id}, len=${schema.length}`);
}

(async () => {
    try {
        for (const cfg of PAGES) {
            await refreshOne(cfg);
        }
        db.close();
        console.log('All done');
    } catch (e) {
        console.error(e);
        db.close();
        process.exit(1);
    }
})();
