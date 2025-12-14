#!/usr/bin/env node
/**
 * 环境变量检查脚本
 * 确保所有必需的环境变量都已配置
 */

require('dotenv').config();

const chalk = require('colors'); // 使用 colors 库（已是 winston 依赖）

// 必需的环境变量
const REQUIRED_VARS = [];

// 推荐的环境变量（有默认值，但建议配置）
const RECOMMENDED_VARS = [
    { key: 'DIFY_API_URL', default: 'https://api.dify.ai/v1', description: 'Dify API 地址' },
    { key: 'DIFY_API_KEY', default: null, description: 'Dify API 密钥（可选，未配置将使用 Mock 模式）' },
    { key: 'LOG_LEVEL', default: 'info', description: '日志级别' },
    { key: 'LOG_DIR', default: './logs', description: '日志目录' },
];

// 可选的环境变量
const OPTIONAL_VARS = [
    { key: 'NODE_ENV', description: '运行环境 (development/production)' },
];

let hasError = false;
let hasWarning = false;

console.log('\n🔍 检查环境变量配置...\n');

// 检查必需变量
if (REQUIRED_VARS.length > 0) {
    console.log('━━━ 必需变量 ━━━'.bold);
    REQUIRED_VARS.forEach(varName => {
        if (!process.env[varName]) {
            console.log(`❌ ${varName}`.red + ' - 未配置（必需）'.red);
            hasError = true;
        } else {
            console.log(`✅ ${varName}`.green + ` = ${maskValue(varName, process.env[varName])}`.gray);
        }
    });
    console.log('');
}

// 检查推荐变量
if (RECOMMENDED_VARS.length > 0) {
    console.log('━━━ 推荐变量 ━━━'.bold);
    RECOMMENDED_VARS.forEach(({ key, default: defaultValue, description }) => {
        const value = process.env[key];
        if (!value) {
            if (defaultValue) {
                console.log(`⚠️  ${key}`.yellow + ` - 未配置，将使用默认值: ${defaultValue}`.gray);
                console.log(`   ${description}`.gray);
            } else {
                console.log(`⚠️  ${key}`.yellow + ' - 未配置（推荐配置）'.yellow);
                console.log(`   ${description}`.gray);
                hasWarning = true;
            }
        } else {
            console.log(`✅ ${key}`.green + ` = ${maskValue(key, value)}`.gray);
            console.log(`   ${description}`.gray);
        }
    });
    console.log('');
}

// 检查可选变量
if (OPTIONAL_VARS.length > 0) {
    console.log('━━━ 可选变量 ━━━'.bold);
    OPTIONAL_VARS.forEach(({ key, description }) => {
        const value = process.env[key];
        if (value) {
            console.log(`✅ ${key}`.green + ` = ${value}`.gray);
            console.log(`   ${description}`.gray);
        } else {
            console.log(`ℹ️  ${key}`.blue + ' - 未配置（可选）'.gray);
            console.log(`   ${description}`.gray);
        }
    });
    console.log('');
}

// 显示 .env 文件状态
console.log('━━━ 配置文件 ━━━'.bold);
const fs = require('fs');
const path = require('path');
const envFile = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
    console.log(`✅ .env 文件存在`.green);
} else {
    console.log(`⚠️  .env 文件不存在`.yellow);
    console.log(`   提示: 复制 .env.example 并重命名为 .env`.gray);
    hasWarning = true;
}
console.log('');

// 显示检查结果
console.log('━━━ 检查结果 ━━━'.bold);
if (hasError) {
    console.log('❌ 配置检查失败: 缺少必需的环境变量'.red);
    console.log('   请配置缺少的变量后重试\n'.gray);
    process.exit(1);
} else if (hasWarning) {
    console.log('⚠️  配置检查通过，但有警告'.yellow);
    console.log('   建议配置推荐的环境变量以获得最佳体验\n'.gray);
    process.exit(0);
} else {
    console.log('✅ 所有配置检查通过!'.green);
    console.log('   环境变量配置正确\n'.gray);
    process.exit(0);
}

/**
 * 掩码敏感值
 */
function maskValue(key, value) {
    const sensitiveKeys = ['KEY', 'SECRET', 'PASSWORD', 'TOKEN'];
    const isSensitive = sensitiveKeys.some(k => key.toUpperCase().includes(k));

    if (isSensitive && value) {
        // 只显示前3个和最后3个字符
        if (value.length > 10) {
            return value.substring(0, 3) + '***' + value.substring(value.length - 3);
        }
        return '***';
    }

    return value;
}
