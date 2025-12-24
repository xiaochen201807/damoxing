/**
 * 为菜单管理添加父菜单选择器
 * 在创建和编辑菜单时可以选择父菜单
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');

console.log('🔧 为菜单管理添加父菜单选择器...\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ 数据库连接失败:', err.message);
        process.exit(1);
    }
});

// 1. 获取当前的页面配置
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

            // 2. 找到菜单管理的标签页
            const tabs = schema.body[0].tabs;
            const menuTab = tabs.find(t => t.title === '📋 菜单管理');

            if (!menuTab) {
                console.error('❌ 未找到菜单管理标签页');
                db.close();
                process.exit(1);
            }

            console.log('📋 找到菜单管理标签页\n');

            // 3. 更新新建菜单表单 - 添加父菜单选择器
            const createButton = menuTab.body[0].headerToolbar.find(item => item.label === '新建菜单');
            if (createButton && createButton.dialog && createButton.dialog.body) {
                const formBody = createButton.dialog.body.body;

                // 检查是否已经有 parent_id 字段
                const hasParentId = formBody.some(field => field.name === 'parent_id');

                if (!hasParentId) {
                    // 在 label 后面插入父菜单选择器
                    formBody.splice(1, 0, {
                        type: "select",
                        name: "parent_id",
                        label: "父菜单",
                        placeholder: "选择父菜单（留空为根级菜单）",
                        clearable: true,
                        source: {
                            method: "get",
                            url: "/api/system/menu",
                            adaptor: `
                                // 过滤掉当前菜单自己（编辑时）
                                const menus = payload.data || [];
                                // 只显示根级菜单作为父菜单选项
                                const rootMenus = menus.filter(m => m.parent_id === null);
                                return {
                                    status: 0,
                                    options: rootMenus.map(m => ({
                                        label: m.label,
                                        value: m.id
                                    }))
                                };
                            `
                        },
                        description: "💡 选择一个父菜单，或留空创建根级菜单"
                    });
                    console.log('✅ 已添加父菜单选择器到新建表单');
                }
            }

            // 4. 为表格添加编辑和删除操作按钮
            const crud = menuTab.body[0];
            if (crud.columns) {
                // 检查是否已有操作列
                const hasOperationColumn = crud.columns.some(col => col.type === 'operation');

                if (!hasOperationColumn) {
                    // 添加父菜单显示列
                    crud.columns.splice(1, 0, {
                        name: "parent_id",
                        label: "父菜单",
                        width: 120,
                        type: "mapping",
                        source: {
                            method: "get",
                            url: "/api/system/menu"
                        },
                        map: "${label}",
                        placeholder: "根级菜单"
                    });

                    // 添加操作列
                    crud.columns.push({
                        type: "operation",
                        label: "操作",
                        width: 150,
                        buttons: [
                            {
                                label: "编辑",
                                icon: "fa fa-pencil",
                                level: "link",
                                actionType: "dialog",
                                dialog: {
                                    title: "编辑菜单 - ${label}",
                                    size: "md",
                                    body: {
                                        type: "form",
                                        api: {
                                            method: "put",
                                            url: "/api/system/menu/${page_key}"
                                        },
                                        initApi: "/api/system/menu?page_key=${page_key}",
                                        body: [
                                            {
                                                type: "input-text",
                                                name: "label",
                                                label: "菜单名称",
                                                required: true
                                            },
                                            {
                                                type: "select",
                                                name: "parent_id",
                                                label: "父菜单",
                                                placeholder: "选择父菜单（留空为根级菜单）",
                                                clearable: true,
                                                source: {
                                                    method: "get",
                                                    url: "/api/system/menu",
                                                    adaptor: `
                                                        const menus = payload.data || [];
                                                        const currentId = data.id;
                                                        // 过滤掉当前菜单自己
                                                        const availableMenus = menus.filter(m => m.id !== currentId && m.parent_id === null);
                                                        return {
                                                            status: 0,
                                                            options: availableMenus.map(m => ({
                                                                label: m.label,
                                                                value: m.id
                                                            }))
                                                        };
                                                    `
                                                },
                                                description: "💡 选择一个父菜单，或留空设为根级菜单"
                                            },
                                            {
                                                type: "input-text",
                                                name: "page_key",
                                                label: "Page Key",
                                                required: true
                                            },
                                            {
                                                type: "input-text",
                                                name: "icon",
                                                label: "图标",
                                                placeholder: "fa fa-home"
                                            },
                                            {
                                                type: "input-number",
                                                name: "order",
                                                label: "排序",
                                                value: 0
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                label: "删除",
                                icon: "fa fa-trash",
                                level: "link",
                                className: "text-danger",
                                actionType: "ajax",
                                confirmText: "确认删除菜单【${label}】？",
                                api: {
                                    method: "post",
                                    url: "/api/system/menu/delete",
                                    data: {
                                        page_key: "${page_key}"
                                    }
                                }
                            }
                        ]
                    });

                    console.log('✅ 已添加父菜单显示列和操作按钮');
                }
            }

            // 5. 更新数据库
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

                    console.log('\n🎉 菜单管理界面更新成功！');
                    console.log(`   更新行数: ${this.changes}`);
                    console.log('\n✨ 新增功能：');
                    console.log('   ├─ 新建菜单时可选择父菜单');
                    console.log('   ├─ 表格中显示父菜单信息');
                    console.log('   ├─ 编辑菜单可修改父菜单');
                    console.log('   └─ 删除菜单操作');
                    console.log('\n💡 刷新浏览器查看更新后的界面！');

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
