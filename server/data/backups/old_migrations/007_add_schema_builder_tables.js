/**
 * 添加组件库、模板配置和样式主题表
 * 支持统一页面生成架构
 */
const logger = require('../../utils/logger');

exports.up = function (db) {
    return db.serialize(() => {
        logger.info('Migration 007: Creating schema builder tables...');

        // 1. 创建组件库表
        db.run(`
            CREATE TABLE IF NOT EXISTS sys_component_library (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                component_id TEXT UNIQUE NOT NULL,
                component_name TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                template_path TEXT NOT NULL,
                params_schema TEXT NOT NULL,
                default_params TEXT,
                example_usage TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                logger.error('Migration 007: Failed to create sys_component_library:', err);
            } else {
                logger.info('Migration 007: Created sys_component_library table');
            }
        });

        // 2. 创建页面模板配置表
        db.run(`
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
        `, (err) => {
            if (err) {
                logger.error('Migration 007: Failed to create sys_page_templates_config:', err);
            } else {
                logger.info('Migration 007: Created sys_page_templates_config table');
            }
        });

        // 3. 创建样式主题表
        db.run(`
            CREATE TABLE IF NOT EXISTS sys_style_themes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                theme_id TEXT UNIQUE NOT NULL,
                theme_name TEXT NOT NULL,
                description TEXT,
                amis_theme TEXT NOT NULL,
                css_variables TEXT,
                custom_css TEXT,
                preview_image TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                logger.error('Migration 007: Failed to create sys_style_themes:', err);
            } else {
                logger.info('Migration 007: Created sys_style_themes table');

                // 插入默认主题数据
                insertDefaultThemes(db);
            }
        });
    });
};

// 插入默认主题
function insertDefaultThemes(db) {
    const themes = [
        {
            theme_id: 'cxd',
            theme_name: 'Element UI 风格',
            description: '清新优雅的数据可视化风格（AMIS 默认主题）',
            amis_theme: 'cxd',
            css_variables: JSON.stringify({
                '--primary-color': '#409EFF',
                '--success-color': '#67C23A',
                '--border-radius': '6px',
                '--card-shadow': '0 2px 12px 0 rgba(0, 0, 0, 0.1)'
            }),
            custom_css: '',
            preview_image: '/themes/cxd-preview.png'
        },
        {
            theme_id: 'antd',
            theme_name: 'Ant Design 风格',
            description: '简洁现代的企业级设计语言',
            amis_theme: 'antd',
            css_variables: JSON.stringify({
                '--primary-color': '#1890ff',
                '--border-radius': '4px',
                '--card-shadow': '0 1px 2px rgba(0,0,0,0.1)'
            }),
            custom_css: '',
            preview_image: '/themes/antd-preview.png'
        },
        {
            theme_id: 'dark',
            theme_name: 'Dark Mode 风格',
            description: '深色护眼模式，适合监控大屏',
            amis_theme: 'dark',
            css_variables: JSON.stringify({
                '--background-color': '#1f1f1f',
                '--text-color': '#e5e5e5',
                '--primary-color': '#3aa1ff',
                '--card-background': '#2a2a2a'
            }),
            custom_css: '',
            preview_image: '/themes/dark-preview.png'
        }
    ];

    themes.forEach((theme, index) => {
        db.run(`
            INSERT OR IGNORE INTO sys_style_themes 
            (theme_id, theme_name, description, amis_theme, css_variables, custom_css, preview_image)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            theme.theme_id,
            theme.theme_name,
            theme.description,
            theme.amis_theme,
            theme.css_variables,
            theme.custom_css,
            theme.preview_image
        ], (err) => {
            if (err) {
                logger.error(`Migration 007: Failed to insert theme ${theme.theme_id}:`, err);
            } else {
                logger.info(`Migration 007: Inserted default theme: ${theme.theme_name}`);

                // 最后一个主题插入完成
                if (index === themes.length - 1) {
                    logger.info('Migration 007: Migration completed successfully');
                }
            }
        });
    });
}

exports.down = function (db) {
    return db.serialize(() => {
        logger.info('Migration 007: Rolling back schema builder tables...');

        db.run(`DROP TABLE IF EXISTS sys_component_library`, (err) => {
            if (err) logger.error('Migration 007: Failed to drop sys_component_library:', err);
        });

        db.run(`DROP TABLE IF EXISTS sys_page_templates_config`, (err) => {
            if (err) logger.error('Migration 007: Failed to drop sys_page_templates_config:', err);
        });

        db.run(`DROP TABLE IF EXISTS sys_style_themes`, (err) => {
            if (err) logger.error('Migration 007: Failed to drop sys_style_themes:', err);
            else logger.info('Migration 007: Rolled back successfully');
        });
    });
};
