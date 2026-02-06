/**
 * business_standard 模板专属参数分析脚本
 * 业务标准库管理页面
 * 配置 CRUD 及其相关接口参数
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

// API 参数配置定义
const API_PARAMS = {
    // 列表接口
    standard_list_api: {
        type: 'string',
        title: '标准列表接口 URL',
        description: '业务标准列表查询 API 地址',
        default: '/business-standards',
        group: '🔗 标准管理接口配置',
        groupOrder: 1,
        order: 1
    },
    // 新增接口
    standard_create_api: {
        type: 'string',
        title: '新增标准接口 URL',
        description: '创建新业务标准的 API 地址',
        default: 'post:/business-standards',
        group: '🔗 标准管理接口配置',
        groupOrder: 1,
        order: 2
    },
    // 更新接口
    standard_update_api: {
        type: 'string',
        title: '更新标准接口 URL',
        description: '更新业务标准的 API 地址 (支持变量如 ${id})',
        default: 'put:/business-standards/${id}',
        group: '🔗 标准管理接口配置',
        groupOrder: 1,
        order: 3
    },
    // 删除接口
    standard_delete_api: {
        type: 'string',
        title: '删除标准接口 URL',
        description: '删除业务标准的 API 地址 (支持变量如 ${id})',
        default: 'delete:/business-standards/${id}',
        group: '🔗 标准管理接口配置',
        groupOrder: 1,
        order: 4
    },
    // 导入接口
    standard_import_api: {
        type: 'string',
        title: '全量导入接口 URL',
        description: '全量导入业务标准 (CSV上传)',
        default: '/business-standards/import',
        group: '🔗 导入导出配置',
        groupOrder: 3,
        order: 1
    },
    // 导出接口
    standard_export_api: {
        type: 'string',
        title: '全量导出接口 URL',
        description: '全量导出业务标准 (CSV下载)',
        default: '/business-standards/export',
        group: '🔗 导入导出配置',
        groupOrder: 3,
        order: 2
    },
    // 服务对象接口
    service_objects_api: {
        type: 'string',
        title: '服务对象接口 URL',
        description: '获取服务对象列表的 API 地址',
        default: '/service-objects',
        group: '🔗 辅助数据接口配置',
        groupOrder: 2,
        order: 1
    }
};

// 主函数
async function analyzeBusinessStandard() {
    const templateId = 'business_standard';

    console.log(`\n🔍 分析模板: ${templateId}\n`);

    try {
        // 构建 params_schema
        const paramsSchema = {
            type: 'object',
            properties: {},
            required: []
        };
        const defaultParams = {};

        // 添加 API 参数
        Object.entries(API_PARAMS).forEach(([name, config]) => {
            paramsSchema.properties[name] = {
                type: config.type,
                title: config.title,
                description: config.description,
                'ui:group': config.group,
                'ui:groupOrder': config.groupOrder,
                'ui:order': config.order,
                default: config.default
            };
            defaultParams[name] = config.default;
        });

        // 统计分组
        const groups = {};
        Object.values(API_PARAMS).forEach(config => {
            if (!groups[config.group]) groups[config.group] = 0;
            groups[config.group]++;
        });

        console.log(`   └─ 分组数: ${Object.keys(groups).length}`);
        Object.entries(groups).forEach(([group, count]) => {
            console.log(`      - ${group}: ${count}个参数`);
        });

        await new Promise((resolve) => {
            db.run(
                `UPDATE sys_page_templates_config 
                 SET params_schema = ?, default_params = ? 
                 WHERE template_id = ?`,
                [JSON.stringify(paramsSchema), JSON.stringify(defaultParams), templateId],
                (err) => {
                    if (!err) {
                        console.log(`   ✅ 已更新: ${templateId}`);
                    } else {
                        console.error(`   ❌ 更新失败:`, err.message);
                    }
                    resolve();
                }
            );
        });

        console.log(`\n🎉 ${templateId} 分析完成！\n`);
        return { success: true, message: `${templateId} 分析完成` };
    } catch (error) {
        console.error(`   └─ ❌ 分析失败:`, error);
        return { success: false, message: error.message };
    }
}

// 支持直接运行和模块导出
if (require.main === module) {
    analyzeBusinessStandard().then(() => process.exit(0));
}

module.exports = analyzeBusinessStandard;
