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
});
