const path = require('path');
const nunjucks = require('nunjucks');

const env = nunjucks.configure(path.join(__dirname, '../templates'), {
    autoescape: false,
    throwOnUndefined: false,
    noCache: true
});

env.addFilter('tojson', function (value) {
    return JSON.stringify(value);
});

env.addFilter('fromjson', function (str) {
    if (!str) return null;
    try {
        return typeof str === 'string' ? JSON.parse(str) : str;
    } catch (e) {
        return str;
    }
});

function walk(node, visitor) {
    if (!node) {
        return;
    }
    if (Array.isArray(node)) {
        node.forEach(item => walk(item, visitor));
        return;
    }
    if (typeof node !== 'object') {
        return;
    }
    visitor(node);
    Object.values(node).forEach(value => walk(value, visitor));
}

describe('business_rule template', () => {
    test('关键数据算法统一从页面加载的算法选项数组读取', () => {
        const rendered = env.render('pages/business_rule.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}'
        });
        const schema = JSON.parse(rendered);
        const ywsfSources = [];
        const mappingSources = [];
        const outerService = schema.body[0];

        walk(schema, node => {
            if (node?.name === 'ywsf' && node.type === 'select') {
                ywsfSources.push(node.source);
            }

            if (node?.label === '关键数据算法' && node.type === 'mapping') {
                mappingSources.push(node.source);
            }
        });

        expect(schema.data.algorithm_options).toEqual([]);
        expect(outerService.api).toEqual({
            method: 'get',
            url: '${algorithm_options_api}',
            adaptor: expect.stringContaining('algorithm_options')
        });
        expect(ywsfSources.length).toBeGreaterThan(0);
        expect(mappingSources.length).toBeGreaterThan(0);

        ywsfSources.forEach(source => {
            expect(source).toBe('${algorithm_options}');
        });

        mappingSources.forEach(source => {
            expect(source).toBe('${algorithm_options}');
        });
    });

    test('主查询区业务内容分类会随关键数据算法切换即时刷新', () => {
        const rendered = env.render('pages/business_rule.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}'
        });
        const schema = JSON.parse(rendered);
        const mainFilter = (((schema.body || [])[0] || {}).body || [])[0]?.body?.[0]?.filter;
        const filterBody = mainFilter?.body || [];
        const algorithmSelect = filterBody.find(item => item?.name === 'ywsf');
        const classSelect = filterBody.find(item => item?.name === 'ywnrfl');

        expect(mainFilter?.id).toBe('main_filter_form');
        expect(algorithmSelect?.id).toBe('main_rule_algorithm_select');
        expect(algorithmSelect?.onEvent?.change?.actions).toEqual([
            {
                actionType: 'setValue',
                componentId: 'main_filter_form',
                args: {
                    value: {
                        ywnrfl: ''
                    }
                }
            }
        ]);
        expect(classSelect).toMatchObject({
            id: 'main_rule_business_content_class_select',
            clearValueOnOptionsChange: true,
            source: {
                method: 'post',
                url: '${business_content_class_api}',
                data: {
                    '&': '${business_content_class_params}',
                    gjsjsf: '${ywsf}'
                },
                trackExpression: '${ywsf}'
            }
        });
    });

    test('清册选择弹窗和外层主列表都使用 display_ywblbz 展示替换后的业务办理标准文案', () => {
        const rendered = env.render('pages/business_rule.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}'
        });
        const schema = JSON.parse(rendered);
        let mainCrud = null;
        let selectionCrud = null;

        walk(schema, node => {
            if (node?.id === 'main_crud') {
                mainCrud = node;
            }

            if (node?.type === 'crud' && node.api?.url === '/api/ywbz/selection_list') {
                selectionCrud = node;
            }
        });

        expect(mainCrud?.columns).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'display_ywblbz',
                label: '业务办理标准'
            })
        ]));
        expect(selectionCrud?.columns).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'display_ywblbz',
                label: '业务办理标准'
            })
        ]));
    });

    test('调试弹窗内部接口使用固定 URL，避免弹窗作用域丢失 API 变量', () => {
        const rendered = env.render('pages/business_rule.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}'
        });
        const schema = JSON.parse(rendered);
        const urls = [];
        let debugForm = null;
        let caseSelect = null;
        let saveCaseForm = null;
        let detailCrud = null;

        walk(schema, node => {
            if (node?.id === 'debug_form_component') {
                debugForm = node;
            }

            if (node?.id === 'debug_case_select') {
                caseSelect = node;
            }

            if (node?.type === 'form' && node.api?.url === '/api/ywbz/debug_case/save') {
                saveCaseForm = node;
            }

            if (node?.type === 'crud' && node.api?.url === '/api/ywbz/debug_log') {
                detailCrud = node;
            }

            if (typeof node?.url === 'string' && node.url.includes('/ywbz/debug')) {
                urls.push(node.url);
            }
        });

        expect(debugForm?.initApi?.url).toBe('/api/ywbz/debug_template');
        expect(caseSelect?.source?.url).toBe('/api/ywbz/debug_case/list');
        expect(saveCaseForm?.api?.url).toBe('/api/ywbz/debug_case/save');
        expect(detailCrud?.api?.url).toBe('/api/ywbz/debug_log');
        expect(urls).toEqual(expect.arrayContaining([
            '/api/ywbz/debug_template',
            '/api/ywbz/debug_case/list',
            '/api/ywbz/debug_case/get',
            '/api/ywbz/debug_case/save',
            '/api/ywbz/debug',
            '/api/ywbz/debug_log'
        ]));
        expect(rendered.includes('${rule_debug_template_api}')).toBe(false);
        expect(rendered.includes('${rule_debug_case_list_api}')).toBe(false);
        expect(rendered.includes('${rule_debug_case_get_api}')).toBe(false);
        expect(rendered.includes('${rule_debug_case_save_api}')).toBe(false);
        expect(rendered.includes('${rule_debug_api}')).toBe(false);
        expect(rendered.includes('${rule_debug_log_api}')).toBe(false);
    });

    test('操作列提供只读标准查看弹窗，复用标准库详情接口', () => {
        const rendered = env.render('pages/business_rule.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}',
            business_standard_value_params: '{}',
            service_objects_params: '{}',
            business_standard_attribute_params: '{}'
        });
        const schema = JSON.parse(rendered);
        let viewButton = null;

        walk(schema, node => {
            if (node?.type === 'button' && node?.label === '查看' && node?.dialog?.body?.id === 'business_standard_view_form') {
                viewButton = node;
            }
        });

        expect(schema.data.standard_class_options).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: '缴存人账户余额', value: '1' }),
            expect.objectContaining({ label: '在途提取金额', value: '8' })
        ]));
        expect(schema.data.handle_class_options).toEqual([
            { label: '标准', value: '1' },
            { label: '条件', value: '2' }
        ]);
        expect(schema.data.business_standard_value_api).toBe('/api/tools/business-standard-values');
        expect(schema.data.service_objects_api).toBe('/api/tools/service-objects');
        expect(schema.data.business_standard_attribute_api).toBe('/api/tools/business-standard-attributes');

        expect(viewButton).toBeTruthy();
        expect(viewButton.dialog).toMatchObject({
            title: '查看业务标准模板',
            size: 'lg',
            body: {
                type: 'form',
                id: 'business_standard_view_form',
                actions: [],
                initApi: {
                    method: 'post',
                    url: '/api/ywbzk/get',
                    data: {
                        id: '${mbid}'
                    }
                }
            }
        });
        expect(viewButton.dialog.actions).toEqual([
            expect.objectContaining({
                label: '关闭',
                actionType: 'close'
            })
        ]);
        expect(viewButton.dialog.body.body).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'alert',
                body: '当前为查看模式，可切换不同数据库 SQL 页签查看内容，但不提供保存。'
            })
        ]));
        expect(viewButton.dialog.body.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'ywblbz', label: '业务办理标准：' }),
            expect.objectContaining({ name: 'ywbzz', label: '业务标准值：' }),
            expect.objectContaining({ name: 'hcbzIds', label: '互斥业务办理标准：' }),
            expect.objectContaining({
                type: 'combo',
                name: 'ywblbzsxz',
                addable: false,
                removable: false
            })
        ]));
        expect(JSON.stringify(viewButton.dialog)).toContain('"readOnly":true');
    });
});
