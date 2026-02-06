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
    // 关键数据算法选项配置
    algorithm_options: {
        type: 'combo',
        title: '关键数据算法选项',
        description: '配置关键数据算法的下拉选项 (Key为中文拼音首字母)',
        multiple: true,
        items: [
            { type: 'input-text', name: 'label', label: '显示名称', required: true },
            { type: 'input-text', name: 'value', label: '值 (Key)', required: true }
        ],
        default: [
            { "label": "可提取金额", "value": "ktqje" },
            { "label": "可贷款金额", "value": "kdkje" },
            { "label": "可贷款年限", "value": "kdknx" },
            { "label": "贷款还款时可对冲金额", "value": "dkhkskdcje" }
        ],
        placeholder: '例如：[{"label":"显示名称", "value":"值"}]',
        group: '⚙️ 选项配置',
        groupOrder: 4,
        order: 1
    },
    // 标准分类选项配置
    standard_class_options: {
        type: 'combo',
        title: '标准分类选项',
        description: '配置业务标准分类的下拉选项',
        multiple: true,
        items: [
            { type: 'input-text', name: 'label', label: '显示名称', required: true },
            { type: 'input-text', name: 'value', label: '值', required: true }
        ],
        default: [
            { "label": "购买住房提取", "value": "购买住房提取" },
            { "label": "建造翻建大修提取", "value": "建造翻建大修提取" },
            { "label": "偿还贷款本息提取", "value": "偿还贷款本息提取" }
        ],
        placeholder: '例如：[{"label":"显示名称", "value":"值"}]',
        group: '⚙️ 选项配置',
        groupOrder: 4,
        order: 2
    },
    // 业务内容分类接口
    business_content_class_api: {
        type: 'string',
        title: '业务内容分类接口 URL',
        description: '获取业务内容分类的 API 地址',
        default: '/business-content-classes',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 5,
        required: true
    },
    // 业务内容分类参数
    business_content_class_params: {
        type: 'json-editor',
        title: '业务内容分类接口参数',
        description: '获取业务内容分类的请求参数 (JSON格式)',
        default: {},
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 6
    },
    // 业务标准值接口
    business_standard_value_api: {
        type: 'string',
        title: '业务标准值接口 URL',
        description: '获取业务标准值的 API 地址',
        default: '/business-standard-values',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 7
    },
    // 业务标准值参数
    business_standard_value_params: {
        type: 'json-editor',
        title: '业务标准值接口参数',
        description: '获取业务标准值的请求参数 (JSON格式)',
        default: {},
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 8
    },
    // 业务办理标准对象接口
    service_objects_api: {
        type: 'string',
        title: '业务办理标准对象接口 URL',
        description: '获取业务办理标准对象列表的 API 地址',
        default: '/service-objects',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 9
    },
    // 业务办理标准对象参数
    service_objects_params: {
        type: 'json-editor',
        title: '业务办理标准对象接口参数',
        description: '获取业务办理标准对象列表的请求参数 (JSON格式)',
        default: {},
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 10
    },
    // 业务办理标准属性接口
    business_standard_attribute_api: {
        type: 'string',
        title: '业务办理标准属性接口 URL',
        description: '获取业务办理标准属性列表的 API 地址',
        default: '/business-standard-attributes',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 11
    },
    // 业务办理标准属性参数
    business_standard_attribute_params: {
        type: 'json-editor',
        title: '业务办理标准属性接口参数',
        description: '获取业务办理标准属性列表的请求参数 (JSON格式)，支持联动 `${ywblbzdx}`',
        default: {},
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 12
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
            // 复制配置到 schema，支持更多属性 (如 items, multiple 等)
            const { group, groupOrder, order, default: defaultValue, required, ...otherProps } = config;

            if (required) {
                paramsSchema.required.push(name);
            }

            paramsSchema.properties[name] = {
                ...otherProps,
                'ui:group': group,
                'ui:groupOrder': groupOrder,
                'ui:order': order,
                default: defaultValue
            };
            defaultParams[name] = defaultValue;
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
