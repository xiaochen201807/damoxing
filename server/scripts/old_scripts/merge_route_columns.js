const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const db = new sqlite3.Database(DB_PATH);

console.log('🔄 合并路由标识和路由路径列...\n');

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

    console.log('原列数量:', crud.columns.length);

    // 移除 route_path 列
    crud.columns = crud.columns.filter(col => col.name !== 'route_path');
    console.log('✓ 移除"路由路径"列');

    // 修改 route_key 列，显示为路径格式
    const routeKeyCol = crud.columns.find(col => col.name === 'route_key');
    if (routeKeyCol) {
        routeKeyCol.label = '路由路径';
        routeKeyCol.type = 'tpl';
        routeKeyCol.tpl = '<code>/${route_key}</code>';
        routeKeyCol.width = 150;
        console.log('✓ 路由标识列改为显示路径格式（自动拼接 / ）');
    }

    console.log('新列数量:', crud.columns.length);

    const newSchemaJson = JSON.stringify(schema, null, 2);

    db.run(
        'UPDATE sys_page_template SET schema_json = ?, version = version + 1, updated_at = datetime("now", "+08:00") WHERE page_key = ? AND is_active = 1',
        [newSchemaJson, 'config'],
        function (err) {
            if (err) {
                console.error('❌ 更新失败:', err.message);
            } else {
                console.log('\n✅ 列已合并！更新行数:', this.changes);
                console.log('   现在只显示一列"路由路径"，自动显示为 /route_key 格式');
            }
            db.close();
        }
    );
});
