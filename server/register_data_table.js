#!/usr/bin/env node

/**
 * 注册 data_table 组件到数据库
 * 使用方法: node register_data_table.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data/database.sqlite');

const componentData = {
    component_id: 'data_table',
    component_name: 'CRUD数据表格',
    category: 'table',
    description: '通用数据表格组件,封装AMIS CRUD完整功能。支持分页(可自定义分页参数名)、序号列、筛选表单、批量操作、行操作等。支持POST固定参数配置。',
    template_path: 'components/data_table.j2',
    params_schema: JSON.stringify({
        type: 'object',
        properties: {
            api_url: { type: 'string', description: '数据API地址' },
            api_method: { type: 'string', enum: ['get', 'post'], default: 'post' },
            api_data: { type: 'object', description: 'POST请求的固定参数' },
            page_field: { type: 'string', default: 'page', description: '分页页码字段名' },
            page_size_field: { type: 'string', default: 'perPage', description: '分页大小字段名' },
            columns: { type: 'array', description: '表格列定义' },
            enable_sequence: { type: 'boolean', default: true, description: '是否显示序号列' },
            sequence_label: { type: 'string', default: '序号', description: '序号列标题' },
            filter_form: { type: 'array', description: '筛选表单字段配置' },
            per_page: { type: 'integer', default: 10 },
            per_page_options: { type: 'array', default: [10, 20, 50, 100] },
            enable_batch: { type: 'boolean', default: false },
            batch_actions: { type: 'array' },
            header_toolbar: { type: 'array' },
            footer_toolbar: { type: 'array' },
            primary_field: { type: 'string', default: 'id' }
        },
        required: ['api_url']
    }),
    default_params: JSON.stringify({
        api_method: 'post',
        enable_sequence: true,
        sequence_label: '序号',
        per_page: 10,
        per_page_options: [10, 20, 50, 100],
        enable_batch: false,
        primary_field: 'id',
        page_field: 'page',
        page_size_field: 'perPage'
    }),
    is_active: 1
};

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ 数据库连接失败:', err.message);
        process.exit(1);
    }
    console.log('✅ 数据库连接成功');
});

console.log('🚀 开始注册 data_table 组件...\n');

db.run(
    `INSERT OR REPLACE INTO sys_component_library 
   (component_id, component_name, category, description, template_path, params_schema, default_params, is_active)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        componentData.component_id,
        componentData.component_name,
        componentData.category,
        componentData.description,
        componentData.template_path,
        componentData.params_schema,
        componentData.default_params,
        componentData.is_active
    ],
    function (err) {
        if (err) {
            console.error('❌ 注册失败:', err.message);
            db.close();
            process.exit(1);
        }

        console.log(`✅ 组件注册成功! (rows affected: ${this.changes})\n`);

        // 验证注册结果
        db.get(
            'SELECT component_id, component_name, is_active, created_at FROM sys_component_library WHERE component_id = ?',
            ['data_table'],
            (err, row) => {
                if (err) {
                    console.error('❌ 验证失败:', err.message);
                } else if (row) {
                    console.log('📋 组件信息:');
                    console.log('   - ID:', row.component_id);
                    console.log('   - 名称:', row.component_name);
                    console.log('   - 状态:', row.is_active ? '激活 ✅' : '未激活 ❌');
                    console.log('   - 创建时间:', row.created_at);
                    console.log('\n🎉 注册完成!');
                } else {
                    console.log('⚠️  未找到注册结果');
                }

                db.close((err) => {
                    if (err) {
                        console.error('❌ 关闭数据库失败:', err.message);
                    }
                });
            }
        );
    }
);
