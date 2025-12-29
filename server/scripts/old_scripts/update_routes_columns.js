const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const db = new sqlite3.Database(DB_PATH);

console.log('🔄 优化路由管理表格列...\n');

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

    // 1. 移除图标列
    crud.columns = crud.columns.filter(col => col.name !== 'icon');
    console.log('✓ 移除图标列');

    // 2. 修改状态列
    const statusCol = crud.columns.find(col => col.name === 'is_active');
    if (statusCol) {
        delete statusCol.quickEdit;
        statusCol.type = 'mapping';
        statusCol.map = {
            '1': "<span class='label label-success'>正常</span>",
            '0': "<span class='label label-default'>关闭</span>"
        };
        console.log('✓ 状态列改为文字显示');
    }

    // 3. 修改描述列
    const descCol = crud.columns.find(col => col.name === 'description');
    if (descCol) {
        descCol.label = '备注';
        descCol.type = 'text';
        delete descCol.popOver;
        console.log('✓ 描述列改为备注，直接显示文字');
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
                console.log('\n✅ 路由表格列已优化！更新行数:', this.changes);
            }
            db.close();
        }
    );
});
