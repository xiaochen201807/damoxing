-- 注册 data_table 组件到数据库
-- 使用方法: sqlite3 server/data/database.sqlite < register_data_table.sql

INSERT OR REPLACE INTO
    sys_component_library (
        component_id,
        component_name,
        category,
        description,
        template_path,
        params_schema,
        default_params,
        is_active
    )
VALUES (
        'data_table',
        'CRUD数据表格',
        'table',
        '通用数据表格组件,封装AMIS CRUD完整功能。支持分页(可自定义分页参数名)、序号列、筛选表单、批量操作、行操作等。支持POST固定参数配置。',
        'components/data_table.j2',
        '{"type":"object","properties":{"api_url":{"type":"string","description":"数据API地址"},"api_method":{"type":"string","enum":["get","post"],"default":"post"},"api_data":{"type":"object","description":"POST请求的固定参数"},"page_field":{"type":"string","default":"page","description":"分页页码字段名"},"page_size_field":{"type":"string","default":"perPage","description":"分页大小字段名"},"columns":{"type":"array","description":"表格列定义"},"enable_sequence":{"type":"boolean","default":true,"description":"是否显示序号列"},"sequence_label":{"type":"string","default":"序号","description":"序号列标题"},"filter_form":{"type":"array","description":"筛选表单字段配置"},"per_page":{"type":"integer","default":10},"per_page_options":{"type":"array","default":[10,20,50,100]},"enable_batch":{"type":"boolean","default":false},"batch_actions":{"type":"array"},"header_toolbar":{"type":"array"},"footer_toolbar":{"type":"array"},"primary_field":{"type":"string","default":"id"}},"required":["api_url"]}',
        '{"api_method":"post","enable_sequence":true,"sequence_label":"序号","per_page":10,"per_page_options":[10,20,50,100],"enable_batch":false,"primary_field":"id","page_field":"page","page_size_field":"perPage"}',
        1
    );

-- 验证注册结果
SELECT
    component_id,
    component_name,
    is_active,
    datetime(created_at, 'localtime') as created_at
FROM sys_component_library
WHERE
    component_id = 'data_table';