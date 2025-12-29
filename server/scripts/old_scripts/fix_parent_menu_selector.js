/**
 * 修复菜单管理的父菜单选择器
 * 简化数据源配置，直接使用 API 返回的数据
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');

console.log('🔧 修复父菜单选择器...\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ 数据库连接失败:', err.message);
        process.exit(1);
    }
});

db.get(
    "SELECT schema_json FROM sys_page_template WHERE page_key = 'config' AND is_active = 1",
    (err, row) => {
        if (err) {
            console.error('❌ 查询失败:', err.message);
            db.close();
            process.exit(1);
        }

        if (!row) {
            console.error('❌ 未找到 config 页面');
            db.close();
            process.exit(1);
        }

        try {
            const schema = JSON.parse(row.schema_json);
            const tabs = schema.body[0].tabs;
            const menuTab = tabs.find(t => t.title === '📋 菜单管理');

            if (!menuTab) {
                console.error('❌ 未找到菜单管理标签页');
                db.close();
                process.exit(1);
            }

            // 1. 修复新建菜单表单的父菜单选择器
            const createButton = menuTab.body[0].headerToolbar.find(item => item.label === '新建菜单');
            if (createButton && createButton.dialog && createButton.dialog.body) {
                const formBody = createButton.dialog.body.body;
                const parentIdField = formBody.find(field => field.name === 'parent_id');

                if (parentIdField) {
                    // 简化配置，使用 autoComplete 方式
                    Object.assign(parentIdField, {
                        type: "select",
                        name: "parent_id",
                        label: "父菜单",
                        placeholder: "选择父菜单（留空为根级菜单）",
                        clearable: true,
                        source: "/api/system/menu?route_key=dashboard",
                        labelField: "label",
                        valueField: "id",
                        description: "💡 选择一个父菜单，或留空创建根级菜单"
                    });
                    console.log('✅ 已修复新建表单的父菜单选择器');
                }
            }

            // 2. 修复编辑菜单表单的父菜单选择器
            const crud = menuTab.body[0];
            if (crud.columns) {
                const operationColumn = crud.columns.find(col => col.type === 'operation');
                if (operationColumn && operationColumn.buttons) {
                    const editButton = operationColumn.buttons.find(btn => btn.label === '编辑');
                    if (editButton && editButton.dialog && editButton.dialog.body) {
                        const editFormBody = editButton.dialog.body.body;
                        const editParentIdField = editFormBody.find(field => field.name === 'parent_id');

                        if (editParentIdField) {
                            Object.assign(editParentIdField, {
                                type: "select",
                                name: "parent_id",
                                label: "父菜单",
                                placeholder: "选择父菜单（留空为根级菜单）",
                                clearable: true,
                                source: "/api/system/menu?route_key=dashboard",
                                labelField: "label",
                                valueField: "id",
                                description: "💡 选择一个父菜单，或留空设为根级菜单"
                            });
                            console.log('✅ 已修复编辑表单的父菜单选择器');
                        }
                    }
                }
            }

            // 3. 更新数据库
            const updatedSchema = JSON.stringify(schema, null, 2);

            db.run(
                `UPDATE sys_page_template 
                 SET schema_json = ?, 
                     version = version + 1, 
                     updated_at = datetime('now', '+08:00')
                 WHERE page_key = 'config' AND is_active = 1`,
                [updatedSchema],
                function (err) {
                    if (err) {
                        console.error('❌ 更新失败:', err.message);
                        db.close();
                        process.exit(1);
                    }

                    console.log('\n🎉 父菜单选择器修复成功！');
                    console.log(`   更新行数: ${this.changes}`);
                    console.log('\n💡 刷新浏览器即可看到修复效果！');

                    db.close();
                }
            );

        } catch (e) {
            console.error('❌ JSON 解析失败:', e.message);
            db.close();
            process.exit(1);
        }
    }
);
