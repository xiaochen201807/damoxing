const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(DB_PATH);

const UPDATE_SQL = `
UPDATE sys_page_template 
SET schema_json = ? 
WHERE page_key = 'config'
`;

db.serialize(() => {
    db.get("SELECT schema_json FROM sys_page_template WHERE page_key = 'config' AND is_active = 1", (err, row) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        if (!row) {
            console.error('Active config page not found');
            process.exit(1);
        }

        const schema = JSON.parse(row.schema_json);

        // Find the wizard
        // Structure: root -> body[0] (tabs component) -> tabs (array) -> tab (Visual Config) -> body[0] (page) -> body[0] (wizard)

        const tabsComponent = schema.body.find(item => item.type === 'tabs');
        if (!tabsComponent) {
            console.error('Tabs component not found in root body');
            process.exit(1);
        }

        const vizTab = tabsComponent.tabs.find(t => t.title === '可视化配置');
        if (!vizTab) {
            console.error('Visual Config tab not found');
            // Check if we need to create it? (Optional, but assuming it exists based on backup)
            process.exit(1);
        }

        const internalPage = vizTab.body[0];
        if (internalPage.type !== 'page') {
            console.error('Expected internal page in Visual Config tab');
            process.exit(1);
        }

        const wizard = internalPage.body[0];

        if (wizard.type !== 'wizard') {
            console.error('Wizard component not found');
            console.log('Found type:', wizard.type);
            process.exit(1);
        }

        // --- Modify Step 1: Select Template ---
        const step1 = wizard.steps[0];
        // Keep existing alerts/selects, append new ones
        // Existing: Alert, Select(template_id)

        // Check if we already added them (idempotency)
        if (step1.body.some(item => item.name === 'target_page_key')) {
            console.log('Fields already exist, skipping field addition.');
        } else {
            // Add "Target Page" Select
            step1.body.push({
                "type": "divider"
            });
            step1.body.push({
                "type": "select",
                "name": "target_page_key",
                "label": "绑定已有页面 (可选)",
                "source": {
                    "method": "get",
                    "url": "/api/system/template",
                    "adaptor": "return { ...payload, items: payload.data.map(item => ({ label: item.title + ' (' + item.page_key + ')', value: item.page_key })) }"
                },
                "description": "如果不选择，则创建新页面。如果选择，将**覆盖**该页面的配置。",
                "searchable": true,
                "clearable": true
            });

            // Add "Manual Page Key" Input
            step1.body.push({
                "type": "input-text",
                "name": "manual_page_key",
                "label": "新页面标识 (Page Key)",
                "required": true,
                "visibleOn": "${!target_page_key}",
                "validations": {
                    "isAlpha": true,
                    "maxLength": 50
                },
                "placeholder": "例如: detection_dashboard",
                "description": "只能包含字母、数字和下划线"
            });

            // Add "Page Title" Input
            step1.body.push({
                "type": "input-text",
                "name": "page_title",
                "label": "页面标题",
                "required": true,
                "placeholder": "例如: 风险监测看板"
            });
        }

        // --- Modify Step 3: Confirm Save ---
        const step3 = wizard.steps[2]; // Index 2
        // Update Alert content
        const alert = step3.body[0];
        alert.body = "## 确认配置\n\n- **模板ID**: ${template_id}\n- **操作模式**: ${target_page_key ? '更新页面' : '创建新页面'}\n- **页面标识**: ${target_page_key || manual_page_key}\n- **页面标题**: ${page_title}";

        // --- Update Wizard API ---
        wizard.api = {
            "method": "post",
            "url": "/api/schema/save",
            "data": {
                "template_id": "${template_id}",
                "target_page_key": "${target_page_key}",
                "manual_page_key": "${manual_page_key}",
                "page_title": "${page_title}",
                "params": "$$"
            }
        };

        // Save back to DB
        db.run(UPDATE_SQL, [JSON.stringify(schema, null, 2)], function (err) {
            if (err) {
                console.error('Update failed:', err);
            } else {
                console.log('Successfully updated config wizard schema.');
            }
        });

    });
});
