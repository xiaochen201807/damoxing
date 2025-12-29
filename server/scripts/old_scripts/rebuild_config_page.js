/**
 * 重建系统配置页面 Schema (v1.0.0)
 * 目标：
 * 1. 删除"可视化配置"和"AI工作流配置"标签页
 * 2. 将它们整合到"页面管理"中
 * 3. 配置向导改为 Drawer 模式
 * 4. AI 工作流改为页面的子对话框
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// 新的系统配置 Schema
const newConfigSchema = {
    type: "page",
    title: "系统配置中心",
    titleClassName: "text-center",
    css: {
        ".cxd-Page-title": {
            "text-align": "center !important",
            "display": "block !important",
            "width": "100%",
            "font-size": "28px",
            "font-weight": "600",
            "margin-bottom": "30px",
            "color": "#1d1d1f"
        }
    },
    body: [
        {
            type: "tabs",
            tabsMode: "line",
            tabs: [
                // ========== Tab 1: 页面管理 (整合：实例CRUD + 配置向导 + AI工作流) ==========
                {
                    title: "📄 页面管理",
                    icon: "fa fa-file-text-o",
                    body: [
                        // 顶部工具栏
                        {
                            type: "flex",
                            justify: "space-between",
                            className: "m-b",
                            style: {
                                padding: "12px 0",
                                borderBottom: "1px solid #e8e8e8"
                            },
                            items: [
                                {
                                    type: "tpl",
                                    tpl: "<h3 style='margin:0; font-size:18px; font-weight:600; color:#262626;'>📋 页面实例列表</h3>"
                                },
                                {
                                    type: "button",
                                    label: "新建页面",
                                    icon: "fa fa-plus",
                                    level: "primary",
                                    actionType: "drawer",
                                    drawer: {
                                        title: "🎨 配置向导",
                                        size: "lg",
                                        resizable: true,
                                        closeOnEsc: false,
                                        closeOnOutside: false,
                                        body: {
                                            type: "service",
                                            schemaApi: "/api/schema/wizard"
                                        }
                                    }
                                }
                            ]
                        },

                        // CRUD 表格
                        {
                            type: "crud",
                            syncLocation: false,
                            api: "/api/system/template",
                            headerToolbar: ["bulkActions", "pagination"],
                            footerToolbar: ["statistics", "pagination"],
                            perPageAvailable: [10, 20, 50, 100],
                            perPage: 20,
                            columns: [
                                {
                                    name: "page_key",
                                    label: "页面标识",
                                    searchable: true,
                                    width: 180,
                                    copyable: true
                                },
                                {
                                    name: "title",
                                    label: "页面标题",
                                    searchable: true
                                },
                                {
                                    name: "version",
                                    label: "版本",
                                    width: 80,
                                    type: "tag",
                                    displayMode: "normal"
                                },
                                {
                                    name: "updated_at",
                                    label: "更新时间",
                                    type: "datetime",
                                    format: "YYYY-MM-DD HH:mm",
                                    width: 150
                                },
                                {
                                    type: "operation",
                                    label: "操作",
                                    width: 280,
                                    buttons: [
                                        {
                                            label: "编辑配置",
                                            icon: "fa fa-edit",
                                            level: "link",
                                            actionType: "drawer",
                                            drawer: {
                                                title: "✏️ 编辑配置 - ${title}",
                                                size: "lg",
                                                resizable: true,
                                                body: {
                                                    type: "service",
                                                    schemaApi: "/api/schema/wizard?mode=edit&page_key=${page_key}"
                                                }
                                            }
                                        },
                                        {
                                            label: "AI工作流",
                                            icon: "fa fa-magic",
                                            level: "link",
                                            actionType: "dialog",
                                            dialog: {
                                                title: "🤖 ${title} - AI 工作流配置",
                                                size: "lg",
                                                actions: [
                                                    { type: "button", label: "关闭", actionType: "close" }
                                                ],
                                                body: {
                                                    type: "crud",
                                                    syncLocation: false,
                                                    api: "/api/dify/config?page_key=${page_key}",
                                                    headerToolbar: [
                                                        {
                                                            type: "button",
                                                            label: "添加工作流",
                                                            icon: "fa fa-plus",
                                                            level: "primary",
                                                            actionType: "dialog",
                                                            dialog: {
                                                                title: "➕ 添加 AI 工作流",
                                                                size: "md",
                                                                body: {
                                                                    type: "form",
                                                                    api: "post:/api/dify/config",
                                                                    body: [
                                                                        {
                                                                            type: "hidden",
                                                                            name: "page_key",
                                                                            value: "${page_key}"
                                                                        },
                                                                        {
                                                                            type: "input-text",
                                                                            name: "workflow_name",
                                                                            label: "工作流名称",
                                                                            required: true,
                                                                            placeholder: "如: 贷款风险分析"
                                                                        },
                                                                        {
                                                                            type: "select",
                                                                            name: "workflow_type",
                                                                            label: "工作流类型",
                                                                            required: true,
                                                                            value: "ai_analysis",
                                                                            options: [
                                                                                { label: "🤖 AI 分析", value: "ai_analysis" },
                                                                                { label: "📝 报告生成", value: "report_generation" },
                                                                                { label: "☁️ 数据导入", value: "data_import" }
                                                                            ]
                                                                        },
                                                                        {
                                                                            type: "input-text",
                                                                            name: "api_url",
                                                                            label: "API 地址",
                                                                            required: true,
                                                                            value: "https://api.dify.ai/v1"
                                                                        },
                                                                        {
                                                                            type: "input-password",
                                                                            name: "api_key",
                                                                            label: "API Key",
                                                                            required: true
                                                                        },
                                                                        {
                                                                            type: "textarea",
                                                                            name: "description",
                                                                            label: "描述",
                                                                            maxRows: 3
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    ],
                                                    columns: [
                                                        { name: "workflow_name", label: "工作流名称", width: 150 },
                                                        {
                                                            name: "workflow_type",
                                                            label: "类型",
                                                            width: 120,
                                                            type: "mapping",
                                                            map: {
                                                                "ai_analysis": "<span class='label label-info'>🤖 AI分析</span>",
                                                                "report_generation": "<span class='label label-success'>📝 报告生成</span>",
                                                                "data_import": "<span class='label label-primary'>☁️ 数据导入</span>"
                                                            }
                                                        },
                                                        { name: "description", label: "描述" },
                                                        {
                                                            name: "enabled",
                                                            label: "状态",
                                                            width: 80,
                                                            type: "switch",
                                                            quickEdit: {
                                                                mode: "inline",
                                                                saveImmediately: true,
                                                                api: "put:/api/dify/config/${id}"
                                                            }
                                                        },
                                                        {
                                                            type: "operation",
                                                            label: "操作",
                                                            width: 100,
                                                            buttons: [
                                                                {
                                                                    label: "编辑",
                                                                    icon: "fa fa-pencil",
                                                                    level: "link",
                                                                    actionType: "dialog",
                                                                    dialog: {
                                                                        title: "编辑工作流",
                                                                        body: {
                                                                            type: "form",
                                                                            api: "put:/api/dify/config/${id}",
                                                                            initApi: "/api/dify/config/${id}",
                                                                            body: [
                                                                                { type: "input-text", name: "workflow_name", label: "工作流名称", required: true },
                                                                                {
                                                                                    type: "select",
                                                                                    name: "workflow_type",
                                                                                    label: "类型",
                                                                                    options: [
                                                                                        { label: "🤖 AI 分析", value: "ai_analysis" },
                                                                                        { label: "📝 报告生成", value: "report_generation" },
                                                                                        { label: "☁️ 数据导入", value: "data_import" }
                                                                                    ]
                                                                                },
                                                                                { type: "input-text", name: "api_url", label: "API 地址", required: true },
                                                                                { type: "input-password", name: "api_key", label: "API Key", required: true },
                                                                                { type: "textarea", name: "description", label: "描述", maxRows: 3 }
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
                                                                    confirmText: "确认删除工作流【${workflow_name}】？",
                                                                    api: "delete:/api/dify/config/${id}"
                                                                }
                                                            ]
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            label: "预览",
                                            icon: "fa fa-eye",
                                            level: "link",
                                            actionType: "link",
                                            link: "/dashboard/${page_key}",
                                            blank: true
                                        },
                                        {
                                            label: "删除",
                                            icon: "fa fa-trash",
                                            level: "link",
                                            className: "text-danger",
                                            actionType: "ajax",
                                            confirmText: "确认删除页面【${title}】？此操作不可恢复。",
                                            api: {
                                                method: "post",
                                                url: "/api/system/template/delete",
                                                data: { page_key: "${page_key}" }
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },

                // ========== Tab 2: 模板定义管理 ==========
                {
                    title: "🎨 模板定义管理",
                    icon: "fa fa-file-code-o",
                    body: [
                        {
                            type: "alert",
                            level: "info",
                            body: "💡 此页面管理 Jinja2 模板文件的元数据。新增模板需要在 `server/templates/pages/` 目录创建 .j2 文件后点击重新分析同步到数据库。",
                            className: "m-b"
                        },
                        {
                            type: "crud",
                            syncLocation: false,
                            api: "/api/system/template-definitions",
                            headerToolbar: [
                                {
                                    type: "button",
                                    label: "重新分析模板",
                                    icon: "fa fa-refresh",
                                    level: "success",
                                    actionType: "ajax",
                                    api: {
                                        method: "post",
                                        url: "/api/system/analyze-templates"
                                    },
                                    confirmText: "确认重新扫描 server/templates/pages/ 目录并更新数据库？",
                                    reload: "window"
                                },
                                "pagination"
                            ],
                            columns: [
                                { name: "template_id", label: "模板ID", searchable: true, width: 150 },
                                { name: "template_name", label: "模板名称", width: 180 },
                                { name: "template_file", label: "文件路径", copyable: true },
                                {
                                    name: "is_active",
                                    label: "状态",
                                    width: 80,
                                    type: "switch",
                                    quickEdit: {
                                        mode: "inline",
                                        saveImmediately: true,
                                        api: "put:/api/system/template-definitions/${template_id}"
                                    }
                                }
                            ]
                        }
                    ]
                },

                // ========== Tab 3: 菜单管理 ==========
                {
                    title: "📋 菜单管理",
                    icon: "fa fa-bars",
                    body: [
                        {
                            type: "crud",
                            syncLocation: false,
                            api: "/api/system/menu",
                            headerToolbar: ["bulkActions", {
                                type: "button",
                                label: "新建菜单",
                                icon: "fa fa-plus",
                                level: "primary",
                                actionType: "dialog",
                                dialog: {
                                    title: "新建菜单",
                                    size: "md",
                                    body: {
                                        type: "form",
                                        api: "post:/api/system/menu",
                                        body: [
                                            { type: "input-text", name: "label", label: "菜单名称", required: true },
                                            { type: "input-text", name: "page_key", label: "Page Key", required: true },
                                            { type: "input-text", name: "icon", label: "图标", placeholder: "fa fa-home" },
                                            { type: "input-number", name: "order", label: "排序", value: 0 }
                                        ]
                                    }
                                }
                            }],
                            columns: [
                                { name: "label", label: "菜单名称" },
                                { name: "page_key", label: "Page Key", copyable: true },
                                { name: "icon", label: "图标" },
                                { name: "order", label: "排序", width: 80 }
                            ]
                        }
                    ]
                },

                // ========== Tab 4: 后端设置 ==========
                {
                    title: "⚙️ 后端设置",
                    icon: "fa fa-server",
                    body: [
                        {
                            type: "alert",
                            level: "warning",
                            body: "⚠️ 后端设置功能开发中..."
                        }
                    ]
                }
            ]
        }
    ]
};

console.log('🔄 开始重建系统配置页面 Schema...');

const UPDATE_SQL = `
UPDATE sys_page_template 
SET schema_json = ?, version = version + 1, updated_at = datetime('now', '+08:00')
WHERE page_key = 'config' AND is_active = 1
`;

db.run(UPDATE_SQL, [JSON.stringify(newConfigSchema, null, 2)], function (err) {
    if (err) {
        console.error('❌ 更新失败:', err.message);
        process.exit(1);
    }

    if (this.changes === 0) {
        console.error('❌ 未找到 config 页面或页面未激活');
        process.exit(1);
    }

    console.log('✅ Schema 更新成功！');
    console.log(`   影响行数: ${this.changes}`);
    console.log('');
    console.log('🎉 v1.0.0 重构完成！新标签页结构:');
    console.log('   ├─ 📄 页面管理 (整合: CRUD + 向导 + AI工作流)');
    console.log('   ├─ 🎨 模板定义管理');
    console.log('   ├─ 📋 菜单管理');
    console.log('   └─ ⚙️ 后端设置');
    console.log('');
    console.log('💡 请刷新浏览器查看新界面！');

    db.close();
});
