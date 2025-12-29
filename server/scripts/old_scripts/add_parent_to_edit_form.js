/**
 * 为编辑菜单表单添加父菜单选择器
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');

console.log('🔧 为编辑菜单表单添加父菜单选择器...\n');

const db = new sqlite3.Database(DB_PATH);

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

            console.log('📋 找到菜单管理标签页\n');

            // 找到 CRUD 表格
            const crud = menuTab.body[0];
            if (!crud.columns) {
                console.error('❌ 未找到表格列配置');
                db.close();
                process.exit(1);
            }

            // 找到操作列
            const operationColumn = crud.columns.find(col => col.type === 'operation');
            if (!operationColumn || !operationColumn.buttons) {
                console.error('❌ 未找到操作列');
                db.close();
                process.exit(1);
            }

            // 找到编辑按钮
            const editButton = operationColumn.buttons.find(btn => btn.label === '编辑');
            if (!editButton) {
                console.error('❌ 未找到编辑按钮');
                db.close();
                process.exit(1);
            }

            console.log('✏️ 找到编辑按钮\n');

            // 检查编辑表单
            if (!editButton.dialog || !editButton.dialog.body || !editButton.dialog.body.body) {
                console.error('❌ 编辑按钮配置不完整');
                db.close();
                process.exit(1);
            }

            const editFormBody = editButton.dialog.body.body;
            console.log('当前编辑表单字段数:', editFormBody.length);
            console.log('字段列表:', editFormBody.map(f => f.name).join(', '));

            // 检查是否已有 parent_id 字段
            const hasParentId = editFormBody.some(field => field.name === 'parent_id');

            if (hasParentId) {
                console.log('\n⚠️ 编辑表单已有 parent_id 字段');
            } else {
                // 在 label 字段后插入 parent_id 字段
                const labelIndex = editFormBody.findIndex(field => field.name === 'label');
                if (labelIndex !== -1) {
                    editFormBody.splice(labelIndex + 1, 0, {
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
                    console.log('\n✅ 已在 label 字段后添加 parent_id 字段');
                    console.log('更新后字段数:', editFormBody.length);
                    console.log('更新后字段列表:', editFormBody.map(f => f.name).join(', '));
                }
            }

            // 更新数据库
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

                    console.log('\n🎉 编辑菜单表单更新成功！');
                    console.log(`   更新行数: ${this.changes}`);
                    console.log('\n💡 刷新浏览器即可看到父菜单选择器！');

                    db.close();
                }
            );

        } catch (e) {
            console.error('❌ 处理失败:', e.message);
            console.error(e.stack);
            db.close();
            process.exit(1);
        }
    }
);
