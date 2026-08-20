#!/usr/bin/env node

/**
 * 命令行长期 Token 快速生成工具
 * 用法示例：
 *   npm run issue-token
 *   node scripts/issue_token.js --user=java_admin --expires=3650d --jgbh=320100
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'damoxing-default-secret-change-in-production';

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        username: 'java_init_service',
        role: 'admin',
        jgbh: '',
        zjgbh: '',
        nickname: 'Java初始化运维服务',
        xingming: 'Java初始化运维服务',
        expiresIn: '3650d'
    };

    for (const arg of args) {
        if (arg.startsWith('--user=')) {
            options.username = arg.split('=')[1];
        } else if (arg.startsWith('--role=')) {
            options.role = arg.split('=')[1];
        } else if (arg.startsWith('--jgbh=')) {
            options.jgbh = arg.split('=')[1];
        } else if (arg.startsWith('--zjgbh=')) {
            options.zjgbh = arg.split('=')[1];
        } else if (arg.startsWith('--expires=')) {
            options.expiresIn = arg.split('=')[1];
        }
    }

    return options;
}

function main() {
    const opts = parseArgs();

    const payload = {
        id: 0,
        username: opts.username,
        role: opts.role,
        jgbh: opts.jgbh,
        zjgbh: opts.zjgbh,
        nickname: opts.nickname,
        xingming: opts.xingming
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: opts.expiresIn });

    console.log('\n=============================================================');
    console.log('            大模型管理系统 - 长期 Token 生成工具            ');
    console.log('=============================================================');
    console.log(`👤 用户名:    ${payload.username}`);
    console.log(`🛡️  角色:      ${payload.role}`);
    console.log(`🏢 机构编码:  ${payload.jgbh || '(不限机构)'}`);
    console.log(`🏢 子机构码:  ${payload.zjgbh || '(不限机构)'}`);
    console.log(`⏳ 有效期:    ${opts.expiresIn}`);
    console.log('-------------------------------------------------------------');
    console.log('🔑 生成的 Token (请直接配置到 Java 程序或客户端):');
    console.log(`\n${token}\n`);
    console.log('-------------------------------------------------------------');
    console.log('📋 curl 调用初始化接口测试示例:');
    console.log(`curl -X POST http://127.0.0.1:3001/api/init-package/data \\`);
    console.log(`  -H "Authorization: Bearer ${token}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"targetJgbh": "320100"}'`);
    console.log('=============================================================\n');
}

main();
