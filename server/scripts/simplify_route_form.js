const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const db = new sqlite3.Database(DB_PATH);

console.log('🔄 简化路由表单，合并字段...\n');

db.get('SELECT schema_json FROM sys_page_template WHERE page_key = ? AND is_active = 1', ['config'], (err, row) => {
    if (err || !row) {
        console.error('❌ 错误:', err || '未找到配置页面');
        db.close();
        return;
    }

    const schema = JSON.parse(row.schema_json);
    const tabsComponent = schema.body.find(item => item.type === 'tabs');
    const routesTab = tabsComponent.tabs.find(t => t.title === '🗺️ 路由管理');

    if (!routesTab) {
        console.error('❌ 未找到路由管理标签页');
        db.close();
        return;
    }

    const crud = routesTab.body[1];
    const createDialog = crud.headerToolbar.find(item => item.actionType === 'dialog').dialog;
    const editButton = crud.columns.find(col => col.type === 'operation').buttons.find(btn => btn.label === '编辑');
    const editDialog = editButton.dialog;

    // 修改新建表单
    console.log('📝 修改新建表单:');

    // 移除 route_path 字段，修改 route_key 字段
    createDialog.body.body = createDialog.body.body.filter(field => field.name !== 'route_path');
    const createRouteKeyField = createDialog.body.body.find(f => f.name === 'route_key');
    if (createRouteKeyField) {
        createRouteKeyField.label = '路由标识';
        createRouteKeyField.description = '唯一标识，只能包含字母、数字、下划线。系统将自动生成路由路径为 /标识';
        console.log('  ✓ 合并路由标识和路由路径');
    }

    // 移除 icon 字段
    createDialog.body.body = createDialog.body.body.filter(field => field.name !== 'icon');
    console.log('  ✓ 移除图标字段');

    // 修改编辑表单  
    console.log('\n📝 修改编辑表单:');

    // 移除 route_path 字段
    editDialog.body.body = editDialog.body.body.filter(field => field.name !== 'route_path');
    console.log('  ✓ 移除路由路径字段');

    // 移除 icon 字段
    editDialog.body.body = editDialog.body.body.filter(field => field.name !== 'icon');
    console.log('  ✓ 移除图标字段');

    console.log('\n表单字段数量:');
    console.log('  新建表单:', createDialog.body.body.length, '个字段');
    console.log('  编辑表单:', editDialog.body.body.length, '个字段');

    const newSchemaJson = JSON.stringify(schema, null, 2);

    db.run(
        'UPDATE sys_page_template SET schema_json = ?, version = version + 1, updated_at = datetime("now", "+08:00") WHERE page_key = ? AND is_active = 1',
        [newSchemaJson, 'config'],
        function (err) {
            if (err) {
                console.error('❌ 更新失败:', err.message);
            } else {
                console.log('\n✅ 路由表单已简化！更新行数:', this.changes);
            }
            db.close();
        }
    );
});
