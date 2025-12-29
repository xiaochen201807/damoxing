const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const db = new sqlite3.Database(DB_PATH);

console.log('🔄 为菜单管理添加主路由选择器...\n');

db.get('SELECT schema_json FROM sys_page_template WHERE page_key = ? AND is_active = 1', ['config'], (err, row) => {
    if (err || !row) {
        console.error('❌ 错误:', err || '未找到配置页面');
        db.close();
        return;
    }

    const schema = JSON.parse(row.schema_json);
    const tabsComponent = schema.body.find(item => item.type === 'tabs');
    const menuTab = tabsComponent.tabs.find(t => t.title === '📋 菜单管理');

    if (!menuTab) {
        console.error('❌ 未找到菜单管理标签页');
        db.close();
        return;
    }

    const crud = menuTab.body[1];

    // 1. 在表格列中添加"所属路由"列（在label之后）
    const labelColIndex = crud.columns.findIndex(col => col.name === 'label');

    const routeColumn = {
        name: 'route_key',
        label: '所属路由',
        width: 120,
        type: 'mapping',
        source: '/api/routes',
        map: {
            'dashboard': "<span class='label label-primary'>风险业务</span>",
            'system': "<span class='label label-info'>系统管理</span>",
            'analytics': "<span class='label label-success'>数据分析</span>",
            'xinyong': "<span class='label label-warning'>信用分析</span>"
        }
    };

    crud.columns.splice(labelColIndex + 1, 0, routeColumn);
    console.log('✓ 添加"所属路由"列到表格');

    // 2. 修改新建菜单表单，添加路由下拉选择
    const createDialog = crud.headerToolbar.find(item => item.actionType === 'dialog').dialog;

    // 在 label 后面添加 route_key 选择器
    const routeKeyField = {
        type: 'select',
        name: 'route_key',
        label: '所属主路由',
        required: true,
        value: 'dashboard',
        source: {
            method: 'get',
            url: '/api/routes',
            adaptor: 'return { options: payload.data.map(r => ({ label: r.route_name, value: r.route_key })) }'
        },
        description: '选择此菜单属于哪个主路由模块'
    };

    createDialog.body.body.splice(1, 0, routeKeyField);
    console.log('✓ 在新建表单添加主路由下拉选择');

    // 3. 修改编辑菜单表单
    const editButton = crud.columns.find(col => col.type === 'operation').buttons.find(btn => btn.label === '编辑');
    const editDialog = editButton.dialog;

    // 添加路由选择器（只读或可编辑）
    const editRouteKeyField = {
        type: 'select',
        name: 'route_key',
        label: '所属主路由',
        required: true,
        source: {
            method: 'get',
            url: '/api/routes',
            adaptor: 'return { options: payload.data.map(r => ({ label: r.route_name, value: r.route_key })) }'
        },
        description: '此菜单所属的主路由'
    };

    editDialog.body.body.splice(1, 0, editRouteKeyField);
    console.log('✓ 在编辑表单添加主路由下拉选择');

    console.log('\n表格列数量:', crud.columns.length);

    const newSchemaJson = JSON.stringify(schema, null, 2);

    db.run(
        'UPDATE sys_page_template SET schema_json = ?, version = version + 1, updated_at = datetime("now", "+08:00") WHERE page_key = ? AND is_active = 1',
        [newSchemaJson, 'config'],
        function (err) {
            if (err) {
                console.error('❌ 更新失败:', err.message);
            } else {
                console.log('\n✅ 菜单管理已添加主路由选择器！更新行数:', this.changes);
            }
            db.close();
        }
    );
});
