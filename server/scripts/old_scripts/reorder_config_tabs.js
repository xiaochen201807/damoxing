const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const db = new sqlite3.Database(DB_PATH);

console.log('🔄 重新排序配置页面标签页...\n');

db.get('SELECT schema_json FROM sys_page_template WHERE page_key = ? AND is_active = 1', ['config'], (err, row) => {
    if (err || !row) {
        console.error('❌ 错误:', err || '未找到配置页面');
        db.close();
        return;
    }

    const schema = JSON.parse(row.schema_json);
    const tabsComponent = schema.body.find(item => item.type === 'tabs');

    if (!tabsComponent) {
        console.error('❌ 未找到 tabs 组件');
        db.close();
        return;
    }

    console.log('当前顺序:');
    tabsComponent.tabs.forEach((tab, i) => {
        console.log(`  ${i + 1}. ${tab.title}`);
    });

    // 目标顺序
    const desiredOrder = [
        '🗺️ 路由管理',
        '📋 菜单管理',
        '📄 页面管理',
        '🎨 模板定义管理',
        '⚙️ 后端设置'
    ];

    // 创建标题到tab对象的映射
    const tabMap = {};
    tabsComponent.tabs.forEach(tab => {
        tabMap[tab.title] = tab;
    });

    // 按照期望顺序重新排列
    const reorderedTabs = desiredOrder.map(title => tabMap[title]).filter(Boolean);

    // 检查是否所有标签都被找到
    if (reorderedTabs.length !== tabsComponent.tabs.length) {
        console.error('❌ 警告: 标签数量不匹配');
        console.log('期望:', desiredOrder);
        console.log('找到:', reorderedTabs.map(t => t.title));
        db.close();
        return;
    }

    // 更新
    tabsComponent.tabs = reorderedTabs;

    console.log('\n新顺序:');
    tabsComponent.tabs.forEach((tab, i) => {
        console.log(`  ${i + 1}. ${tab.title}`);
    });

    const newSchemaJson = JSON.stringify(schema, null, 2);

    db.run(
        'UPDATE sys_page_template SET schema_json = ?, version = version + 1, updated_at = datetime("now", "+08:00") WHERE page_key = ? AND is_active = 1',
        [newSchemaJson, 'config'],
        function (err) {
            if (err) {
                console.error('❌ 更新失败:', err.message);
            } else {
                console.log('\n✅ 标签页顺序已更新！');
                console.log('   更新行数:', this.changes);
            }
            db.close();
        }
    );
});
