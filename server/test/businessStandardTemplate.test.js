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

describe('business_standard template', () => {
    test('关键数据算法配置从页面加载的算法选项数组读取', () => {
        const rendered = env.render('pages/business_standard.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}',
            business_standard_value_params: '{}',
            service_objects_params: '{}',
            business_standard_attribute_params: '{}'
        });
        const schema = JSON.parse(rendered);
        const gjsjsfSources = [];
        const mappingSources = [];
        const outerService = schema.body[0];

        walk(schema, node => {
            if (node && node.name === 'gjsjsf' && node.type === 'select') {
                gjsjsfSources.push(node.source);
            }
            if (node && node.label === '关键数据算法' && node.type === 'mapping') {
                mappingSources.push(node.source);
            }
        });

        expect(gjsjsfSources.length).toBeGreaterThan(0);
        expect(mappingSources.length).toBeGreaterThan(0);
        expect(schema.data.algorithm_options).toEqual([]);
        expect(outerService.api).toEqual({
            method: 'get',
            url: '${algorithm_options_api}',
            adaptor: expect.stringContaining('algorithm_options')
        });

        gjsjsfSources.forEach(source => {
            expect(source).toBe('${algorithm_options}');
        });

        mappingSources.forEach(source => {
            expect(source).toBe('${algorithm_options}');
        });
    });

    test('只使用合法的 AMIS 表达式写法', () => {
        const rendered = env.render('pages/business_standard.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}',
            business_standard_value_params: '{}',
            service_objects_params: '{}',
            business_standard_attribute_params: '{}'
        });

        expect(rendered.includes('!${business_standard_editable}')).toBe(false);
        expect(rendered.includes('${!business_standard_editable}')).toBe(true);
    });

    test('业务内容分类维护成功后会刷新弹窗清单和外层分类下拉', () => {
        const rendered = env.render('pages/business_standard.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}',
            business_standard_value_params: '{}',
            service_objects_params: '{}',
            business_standard_attribute_params: '{}'
        });
        const schema = JSON.parse(rendered);
        const saveForms = [];
        let mainBusinessContentClassSelect = null;

        walk(schema, node => {
            if (node?.id === 'main_business_content_class_select') {
                mainBusinessContentClassSelect = node;
            }

            if (node?.type === 'form' && node.api === 'post:${business_content_class_manage_save_api}') {
                saveForms.push(node);
            }
        });

        expect(mainBusinessContentClassSelect).toMatchObject({
            type: 'select',
            name: 'ywnrfl',
            source: {
                method: 'post',
                url: '${business_content_class_api}',
                data: {
                    '&': '${business_content_class_params}',
                    gjsjsf: '${gjsjsf}'
                }
            }
        });

        expect(saveForms).toHaveLength(2);

        saveForms.forEach(form => {
            expect(form.onEvent).toEqual({
                submitSucc: {
                    actions: [
                        {
                            actionType: 'reload',
                            componentId: 'business_content_class_crud'
                        },
                        {
                            actionType: 'reload',
                            componentId: 'main_business_content_class_select'
                        }
                    ]
                }
            });
        });
    });

    test('主页面查询条件不再包含自定义编码和业务办理分类，但新增编辑表单仍保留', () => {
        const rendered = env.render('pages/business_standard.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}',
            business_standard_value_params: '{}',
            service_objects_params: '{}',
            business_standard_attribute_params: '{}'
        });
        const schema = JSON.parse(rendered);
        const mainFilterBody = (((schema.body || [])[0] || {}).body || [])[0]?.body?.[0]?.filter?.body || [];
        const saveForms = [];

        walk(schema, node => {
            if (node?.type === 'form' && typeof node.api === 'string' && node.api.endsWith('/ywbzk/save')) {
                saveForms.push(node);
            }
        });

        expect(mainFilterBody.some(item => item?.name === 'zdybm')).toBe(false);
        expect(mainFilterBody.some(item => item?.name === 'ywblfl')).toBe(false);
        expect(saveForms.length).toBeGreaterThan(0);

        saveForms.forEach(form => {
            const fieldNames = (form.body || []).map(item => item?.name).filter(Boolean);
            expect(fieldNames).toContain('zdybm');
            expect(fieldNames).toContain('ywblfl');
        });
    });
});
