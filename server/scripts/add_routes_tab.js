/**
 * 为系统配置页面添加路由管理标签页
 * 在现有的 4 个标签页基础上，插入"路由管理"
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const db = new sqlite3.Database(DB_PATH);

console.log('🔄 添加路由管理标签页到系统配置...\n');

// 获取当前配置页面的 schema
db.get('SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1', ['config'], (err, page) => {
    if (err || !page) {
        console.error('❌ 未找到 config 页面:', err || '页面不存在');
        db.close();
        return;
    }

    let schema;
    try {
        schema = JSON.parse(page.schema_json);
    } catch (error) {
        console.error('❌ 解析 schema 失败:', error);
        db.close();
        return;
    }

    // 找到 tabs 组件
    const tabsComponent = schema.body.find(item => item.type === 'tabs');
    if (!tabsComponent) {
        console.error('❌ 未找到 tabs 组件');
        db.close();
        return;
    }

    // 检查是否已存在路由管理标签页
    const hasRoutesTab = tabsComponent.tabs.some(tab => tab.title === '🗺️ 路由管理');
    if (hasRoutesTab) {
        console.log('⚠️  路由管理标签页已存在，跳过添加');
        db.close();
        return;
    }

    // 路由管理标签页配置
    const routesTab = {
        title: '🗺️ 路由管理',
        icon: 'fa fa-sitemap',
        body: [
            {
                type: 'alert',
                level: 'info',
                body: '💡 管理应用的主路由配置。每个主路由对应一个独立的功能模块（如 /dashboard, /system）。',
                className: 'm-b'
            },
            {
                type: 'crud',
                syncLocation: false,
                api: '/api/routes',
                headerToolbar: [
                    {
                        type: 'button',
                        label: '新建路由',
                        icon: 'fa fa-plus',
                        level: 'primary',
                        actionType: 'dialog',
                        dialog: {
                            title: '新建主路由',
                            size: 'lg',
                            body: {
                                type: 'form',
                                api: 'post:/api/routes',
                                body: [
                                    {
                                        type: 'input-text',
                                        name: 'route_key',
                                        label: '路由标识',
                                        required: true,
                                        placeholder: 'analytics',
                                        description: '唯一标识，只能包含字母、数字、下划线',
                                        validations: {
                                            matchRegexp: '/^[a-zA-Z0-9_]+$/'
                                        }
                                    },
                                    {
                                        type: 'input-text',
                                        name: 'route_path',
                                        label: '路由路径',
                                        required: true,
                                        placeholder: '/analytics',
                                        description: '访问路径，必须以 / 开头'
                                    },
                                    {
                                        type: 'input-text',
                                        name: 'route_name',
                                        label: '路由名称',
                                        required: true,
                                        placeholder: '数据分析'
                                    },
                                    {
                                        type: 'icon-picker',
                                        name: 'icon',
                                        label: '图标',
                                        placeholder: 'fa fa-bar-chart'
                                    },
                                    {
                                        type: 'select',
                                        name: 'component_type',
                                        label: '组件类型',
                                        value: 'dynamic',
                                        required: true,
                                        options: [
                                            { label: '动态页面（推荐）', value: 'dynamic' },
                                            { label: '静态组件', value: 'static' }
                                        ],
                                        description: '动态页面支持配置化，静态组件需要手动编码'
                                    },
                                    {
                                        type: 'input-text',
                                        name: 'component_path',
                                        label: '组件路径',
                                        placeholder: '/analytics/dashboard',
                                        visibleOn: '${component_type === "static"}',
                                        description: '静态组件的完整路径'
                                    },
                                    {
                                        type: 'input-number',
                                        name: 'order_num',
                                        label: '排序',
                                        value: 0,
                                        min: 0,
                                        description: '数字越小越靠前'
                                    },
                                    {
                                        type: 'textarea',
                                        name: 'description',
                                        label: '描述',
                                        maxRows: 3
                                    }
                                ]
                            }
                        }
                    },
                    'pagination'
                ],
                footerToolbar: ['statistics', 'pagination'],
                columns: [
                    {
                        name: 'route_key',
                        label: '路由标识',
                        width: 120,
                        searchable: true,
                        copyable: true
                    },
                    {
                        name: 'route_path',
                        label: '路由路径',
                        width: 150,
                        copyable: true
                    },
                    {
                        name: 'route_name',
                        label: '路由名称',
                        width: 150
                    },

                    {
                        name: 'component_type',
                        label: '类型',
                        width: 100,
                        type: 'mapping',
                        map: {
                            'dynamic': "<span class='label label-success'>动态页面</span>",
                            'static': "<span class='label label-info'>静态组件</span>"
                        }
                    },
                    {
                        name: 'order_num',
                        label: '排序',
                        width: 80
                    },
                    {
                        name: 'is_active',
                        label: '状态',
                        width: 80,
                        type: 'mapping',
                        map: {
                            '1': "<span class='label label-success'>正常</span>",
                            '0': "<span class='label label-default'>关闭</span>"
                        }
                    },
                    {
                        name: 'description',
                        label: '备注',
                        type: 'text'
                    },
                    {
                        type: 'operation',
                        label: '操作',
                        width: 120,
                        buttons: [
                            {
                                label: '编辑',
                                icon: 'fa fa-pencil',
                                level: 'link',
                                actionType: 'dialog',
                                dialog: {
                                    title: '编辑路由',
                                    size: 'lg',
                                    body: {
                                        type: 'form',
                                        api: 'post:/api/routes/${route_key}/update',
                                        initApi: 'post:/api/routes/${route_key}',
                                        body: [
                                            {
                                                type: 'static',
                                                name: 'route_key',
                                                label: '路由标识',
                                                description: '路由标识不可修改'
                                            },
                                            {
                                                type: 'input-text',
                                                name: 'route_path',
                                                label: '路由路径',
                                                required: true
                                            },
                                            {
                                                type: 'input-text',
                                                name: 'route_name',
                                                label: '路由名称',
                                                required: true
                                            },
                                            {
                                                type: 'icon-picker',
                                                name: 'icon',
                                                label: '图标'
                                            },
                                            {
                                                type: 'input-number',
                                                name: 'order_num',
                                                label: '排序',
                                                min: 0
                                            },
                                            {
                                                type: 'textarea',
                                                name: 'description',
                                                label: '描述',
                                                maxRows: 3
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                label: '删除',
                                icon: 'fa fa-trash',
                                level: 'link',
                                className: 'text-danger',
                                actionType: 'ajax',
                                confirmText: '确认删除路由【${route_name}】？注意：不能删除 dashboard 和 system 核心路由。',
                                api: 'delete:/api/routes/${route_key}',
                                disabledOn: '${route_key === "dashboard" || route_key === "system"}'
                            }
                        ]
                    }
                ]
            }
        ]
    };

    // 插入到第2个位置（在"页面管理"之后）
    tabsComponent.tabs.splice(1, 0, routesTab);

    // 更新数据库
    const newSchemaJson = JSON.stringify(schema, null, 2);
    const updateSql = `
        UPDATE sys_page_template 
        SET schema_json = ?, 
            version = version + 1, 
            updated_at = datetime('now', '+08:00')
        WHERE page_key = 'config' AND is_active = 1
    `;

    db.run(updateSql, [newSchemaJson], function (err) {
        if (err) {
            console.error('❌ 更新失败:', err.message);
            db.close();
            return;
        }

        if (this.changes === 0) {
            console.error('❌ 未找到配置页面');
            db.close();
            return;
        }

        console.log('✅ 路由管理标签页添加成功！');
        console.log(`   更新行数: ${this.changes}`);
        console.log('\n🎉 系统配置页面现在有 5 个标签页:');
        console.log('   1. 📄 页面管理');
        console.log('   2. 🗺️ 路由管理 ← 新增');
        console.log('   3. 🎨 模板定义管理');
        console.log('   4. 📋 菜单管理');
        console.log('   5. ⚙️ 后端设置');
        console.log('\n💡 请刷新浏览器查看！\n');

        db.close();
    });
});
