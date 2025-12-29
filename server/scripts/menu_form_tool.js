/**
 * 菜单表单字段管理工具
 * 用途：检查或修复菜单表单字段顺序和级联配置
 * 
 * 使用方法：
 *   node server/scripts/menu_form_tool.js          # 检查模式（默认）
 *   node server/scripts/menu_form_tool.js --fix    # 修复模式
 */

const db = require('../db');

// 解析命令行参数
const args = process.argv.slice(2);
const fixMode = args.includes('--fix') || args.includes('-f');

console.log('🔧 菜单表单字段管理工具');
console.log(`模式: ${fixMode ? '修复' : '检查'}\n`);

db.get(
    'SELECT schema_json FROM sys_page_template WHERE page_key = ? AND is_active = 1',
    ['config'],
    (err, row) => {
        if (err) {
            console.error('❌ 查询失败:', err);
            process.exit(1);
        }

        if (!row) {
            console.error('❌ 未找到 config 页面');
            process.exit(1);
        }

        try {
            const schema = JSON.parse(row.schema_json);

            // 验证 schema 结构
            if (schema.type !== 'page' || !Array.isArray(schema.body) || schema.body.length === 0) {
                console.error('❌ Schema 结构不正确');
                process.exit(1);
            }

            const bodyComponent = schema.body[0];

            if (bodyComponent.type !== 'tabs' || !Array.isArray(bodyComponent.tabs)) {
                console.error('❌ Body 组件不包含 tabs');
                process.exit(1);
            }

            const tabs = bodyComponent.tabs;

            // 定位到菜单管理标签页
            const menuTabIdx = tabs.findIndex(t => t.title && t.title.includes('菜单'));

            if (menuTabIdx === -1) {
                console.error('❌ 未找到菜单管理标签页');
                process.exit(1);
            }

            console.log('✅ 找到菜单管理标签页:', tabs[menuTabIdx].title);

            const crud = tabs[menuTabIdx].body[0];

            // 定位新建菜单按钮
            const createButtonIdx = crud.headerToolbar.findIndex(item =>
                typeof item === 'object' && item.label && item.label.includes('新建')
            );

            if (createButtonIdx === -1) {
                console.error('❌ 未找到新建菜单按钮');
                process.exit(1);
            }

            const createButton = crud.headerToolbar[createButtonIdx];
            const formBody = createButton.dialog.body.body;

            console.log('\n📋 当前字段顺序:');
            formBody.forEach((field, i) => {
                console.log(`  ${i + 1}. ${field.label || field.type} (${field.name})`);
            });

            // 找到关键字段
            const routeKeyIdx = formBody.findIndex(f => f.name === 'route_key');
            const parentIdIdx = formBody.findIndex(f => f.name === 'parent_id');

            if (routeKeyIdx === -1) {
                console.error('\n❌ 未找到 route_key 字段');
                process.exit(1);
            }

            if (parentIdIdx === -1) {
                console.error('\n❌ 未找到 parent_id 字段');
                process.exit(1);
            }

            console.log(`\n🔍 关键字段位置:`);
            console.log(`  route_key (所属路由): 索引 ${routeKeyIdx}`);
            console.log(`  parent_id (父菜单): 索引 ${parentIdIdx}`);

            // 检查父菜单的 source 配置
            const parentField = formBody[parentIdIdx];
            console.log('\n📍 父菜单当前配置:');
            console.log(`  source: ${parentField.source}`);
            console.log(`  description: ${parentField.description || '(无)'}`);

            // 判断是否需要修复
            const needReorder = routeKeyIdx > parentIdIdx;
            const needUpdateSource = !parentField.source.includes('${route_key}');

            if (!needReorder && !needUpdateSource) {
                console.log('\n✅ 配置正确，无需修复');
                process.exit(0);
            }

            console.log('\n⚠️  发现需要修复的问题:');
            if (needReorder) {
                console.log('  - 字段顺序不正确（route_key 应该在 parent_id 之前）');
            }
            if (needUpdateSource) {
                console.log('  - 父菜单 source 未配置动态级联');
            }

            if (!fixMode) {
                console.log('\n💡 运行 `node server/scripts/menu_form_tool.js --fix` 来修复');
                process.exit(0);
            }

            // 执行修复
            console.log('\n🔄 开始修复...');

            // 1. 调整字段顺序
            if (needReorder) {
                console.log('  ├─ 调整字段顺序...');
                const routeKeyField = formBody.splice(routeKeyIdx, 1)[0];
                formBody.splice(parentIdIdx, 0, routeKeyField);
                console.log('  ✅ 字段顺序已调整');
            }

            // 2. 更新父菜单配置
            if (needUpdateSource) {
                const newParentIdIdx = formBody.findIndex(f => f.name === 'parent_id');
                const parentField = formBody[newParentIdIdx];

                console.log('  ├─ 更新父菜单 source 配置...');
                parentField.source = '/api/system/menu?route_key=${route_key}';
                parentField.description = '💡 根据所选路由筛选父菜单，请先选择所属路由';
                console.log('  ✅ Source 已更新为动态级联');
            }

            // 3. 同步编辑表单
            const columns = crud.columns || [];
            const editColumn = columns.find(col =>
                col.type === 'operation' || (col.buttons && col.buttons.some(btn => btn.label && btn.label.includes('编辑')))
            );

            if (editColumn && editColumn.buttons) {
                const editButton = editColumn.buttons.find(btn => btn.label && btn.label.includes('编辑'));

                if (editButton && editButton.dialog && editButton.dialog.body && editButton.dialog.body.body) {
                    console.log('  ├─ 同步编辑表单...');
                    const editFormBody = editButton.dialog.body.body;

                    const editRouteKeyIdx = editFormBody.findIndex(f => f.name === 'route_key');
                    const editParentIdIdx = editFormBody.findIndex(f => f.name === 'parent_id');

                    if (editRouteKeyIdx !== -1 && editParentIdIdx !== -1 && editRouteKeyIdx > editParentIdIdx) {
                        const editRouteKeyField = editFormBody.splice(editRouteKeyIdx, 1)[0];
                        editFormBody.splice(editParentIdIdx, 0, editRouteKeyField);
                    }

                    const newEditParentIdIdx = editFormBody.findIndex(f => f.name === 'parent_id');
                    if (newEditParentIdIdx !== -1) {
                        editFormBody[newEditParentIdIdx].source = '/api/system/menu?route_key=${route_key}';
                        editFormBody[newEditParentIdIdx].description = '💡 根据所选路由筛选父菜单，请先选择所属路由';
                    }

                    console.log('  ✅ 编辑表单已同步');
                }
            }

            console.log('\n📋 修复后的字段顺序:');
            formBody.forEach((field, i) => {
                console.log(`  ${i + 1}. ${field.label || field.type} (${field.name})`);
            });

            // 保存更改
            const updatedSchemaJson = JSON.stringify(schema);

            db.run(
                `UPDATE sys_page_template 
                 SET schema_json = ?, 
                     version = version + 1, 
                     updated_at = datetime('now', '+08:00') 
                 WHERE page_key = ? AND is_active = 1`,
                [updatedSchemaJson, 'config'],
                function (err) {
                    if (err) {
                        console.error('\n❌ 保存失败:', err);
                        process.exit(1);
                    }

                    console.log('\n✅ 配置已成功保存到数据库');
                    console.log(`   影响行数: ${this.changes}`);
                    console.log('\n💡 请刷新浏览器查看更改');
                    process.exit(0);
                }
            );

        } catch (e) {
            console.error('❌ 处理失败:', e.message);
            console.log('Stack:', e.stack);
            process.exit(1);
        }
    }
);
