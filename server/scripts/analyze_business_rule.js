/**
 * 业务标准 (规则) 页面模板解析脚本
 * 用于提取 business_rule.j2 中的可配置项
 */

const fs = require('fs');
const path = require('path');

const metadata = {
    name: "关键数据计算模型",
    description: "用于配置具体的业务规则，支持从标准库批量同步模板，并配置关键数据算法与业务内容分类。",
    author: "System",
    version: "1.1.0",
    category: "业务管理",
    variables: [
        {
            name: "business_content_class_api",
            label: "业务内容分类 API",
            type: "string",
            default: "/api/tools/business-content-classes",
            description: "获取动态业务内容分类列表的接口"
        }
    ]
};

/**
 * 解析模板内容并返回元数据
 */
function analyze(templateContent) {
    // 这里可以根据模板内容动态调整元数据，目前返回预定义配置
    return metadata;
}

module.exports = {
    metadata,
    analyze
};
