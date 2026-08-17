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

    test('全量导出说明包含 OceanBase Oracle 模式脚本', () => {
        const rendered = env.render('pages/business_standard.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}',
            business_standard_value_params: '{}',
            service_objects_params: '{}',
            business_standard_attribute_params: '{}'
        });

        expect(() => JSON.parse(rendered)).not.toThrow();
        expect(rendered).toContain('OceanBase Oracle');
        expect(rendered).toContain('ywbzk_full_oceanbase_oracle.sql');
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

    test('主查询区业务内容分类会随关键数据算法切换即时刷新', () => {
        const rendered = env.render('pages/business_standard.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}',
            business_standard_value_params: '{}',
            service_objects_params: '{}',
            business_standard_attribute_params: '{}'
        });
        const schema = JSON.parse(rendered);
        const mainFilter = (((schema.body || [])[0] || {}).body || [])[0]?.body?.[0]?.filter;
        const filterBody = mainFilter?.body || [];
        const algorithmSelect = filterBody.find(item => item?.name === 'gjsjsf');
        const classSelect = filterBody.find(item => item?.name === 'ywnrfl');

        expect(mainFilter?.id).toBe('business_standard_filter_form');
        expect(algorithmSelect?.id).toBe('main_algorithm_select');
        expect(algorithmSelect?.onEvent?.change?.actions).toEqual([
            {
                actionType: 'setValue',
                componentId: 'business_standard_filter_form',
                args: {
                    value: {
                        ywnrfl: ''
                    }
                }
            }
        ]);
        expect(classSelect).toMatchObject({
            id: 'main_business_content_class_select',
            clearValueOnOptionsChange: true,
            source: {
                method: 'post',
                url: '${business_content_class_api}',
                data: {
                    '&': '${business_content_class_params}',
                    gjsjsf: '${gjsjsf}'
                },
                trackExpression: '${gjsjsf}'
            }
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
            expect(fieldNames).toContain('tsysxmc');
            expect(fieldNames).toContain('tsysxdw');
            expect(fieldNames).toContain('zdybm');
            expect(fieldNames).toContain('ywblfl');
        });
    });

    test('标准属性选择会把中文展示名兜底写回 sxbm', () => {
        const rendered = env.render('pages/business_standard.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}',
            business_standard_value_params: '{}',
            service_objects_params: '{}',
            business_standard_attribute_params: '{}'
        });
        const schema = JSON.parse(rendered);
        const attributeSelects = [];

        walk(schema, node => {
            if (node?.type === 'select' && node?.name === 'ywblbzsx') {
                attributeSelects.push(node);
            }
        });

        expect(attributeSelects.length).toBeGreaterThan(0);
        attributeSelects.forEach(select => {
            expect(select.autoFill).toMatchObject({
                sxbm: '${sxbm || label}'
            });
            expect(select.labelField).toBe('label');
            expect(select.valueField).toBe('value');
            expect(select.source).toMatchObject({
                data: expect.objectContaining({
                    syObjectNumber: '${ywblbzdx || _syObjectNumber || _coding || _id}'
                })
            });
        });
    });

    test('业务办理标准属性组支持对象属性和自定义属性两种录入方式', () => {
        const rendered = env.render('pages/business_standard.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}',
            business_standard_value_params: '{}',
            service_objects_params: '{}',
            business_standard_attribute_params: '{}'
        });
        const schema = JSON.parse(rendered);
        const attributeCombos = [];

        walk(schema, node => {
            if (node?.type === 'combo' && node?.name === 'ywblbzsxz') {
                attributeCombos.push(node);
            }
        });

        expect(attributeCombos.length).toBeGreaterThan(0);

        attributeCombos.forEach(combo => {
            const objectGroup = (combo.items || []).find(item => item?.type === 'group' && !item?.visibleOn);
            const customGroup = (combo.items || []).find(item => item?.type === 'group' && item?.visibleOn === "${sfdxsx === '0'}");
            const sourceRadio = (combo.items || []).find(item => item?.name === 'sxly');

            expect(objectGroup?.body?.map(item => item?.name)).toEqual(['sfdxsx', 'ywblbzdx', 'ywblbzsx']);
            expect(objectGroup.body[0]).toMatchObject({
                type: 'select',
                name: 'sfdxsx',
                value: '1',
                options: [
                    { label: '是', value: '1' },
                    { label: '否', value: '0' }
                ]
            });
            expect(objectGroup.body[1]).toMatchObject({
                name: 'ywblbzdx',
                visibleOn: "${sfdxsx !== '0'}",
                requiredOn: "${sfdxsx !== '0'}"
            });
            expect(objectGroup.body[2]).toMatchObject({
                name: 'ywblbzsx',
                visibleOn: "${sfdxsx !== '0'}",
                requiredOn: "${sfdxsx !== '0'}"
            });
            expect(customGroup?.body?.map(item => item?.name)).toEqual(['zdsxmc', 'zdsxbm']);
            expect(sourceRadio).toMatchObject({
                name: 'sxly',
                visibleOn: "${sfdxsx !== '0'}"
            });
        });
    });

    test('新增编辑表单中互斥标准会随算法和业务内容分类即时联动刷新', () => {
        const rendered = env.render('pages/business_standard.j2', {
            GLOBAL_API_PREFIX: '/api',
            business_content_class_params: '{}',
            business_standard_value_params: '{}',
            service_objects_params: '{}',
            business_standard_attribute_params: '{}'
        });
        const schema = JSON.parse(rendered);
        const formsById = {};

        walk(schema, node => {
            if (node?.type === 'form' && node?.id) {
                formsById[node.id] = node;
            }
        });

        ['business_standard_add_form', 'business_standard_edit_form'].forEach(formId => {
            const form = formsById[formId];
            expect(form).toBeTruthy();

            const algorithmSelect = (form.body || []).find(item => item?.name === 'gjsjsf');
            const classSelect = (form.body || []).find(item => item?.name === 'ywnrfl');
            const mutualSelect = (form.body || []).find(item => item?.name === 'hcbzIds');

            expect(algorithmSelect.id).toMatch(/gjsjsf/);
            expect(algorithmSelect.onEvent.change.actions).toEqual([
                {
                    actionType: 'setValue',
                    componentId: formId,
                    args: {
                        value: {
                            ywnrfl: '',
                            hcbzIds: []
                        }
                    }
                }
            ]);

            expect(classSelect.clearValueOnOptionsChange).toBe(true);
            expect(classSelect.source.trackExpression).toBe('${gjsjsf}');
            expect(classSelect.onEvent.change.actions).toEqual([
                {
                    actionType: 'setValue',
                    componentId: formId,
                    args: {
                        value: {
                            hcbzIds: []
                        }
                    }
                }
            ]);

            expect(mutualSelect.clearValueOnOptionsChange).toBe(true);
            expect(mutualSelect.disabledOn).toBe('${!gjsjsf || !ywnrfl}');
            expect(mutualSelect.source.url).toBe('${mutual_standard_api}');
            expect(mutualSelect.source.trackExpression).toBe(
                formId === 'business_standard_add_form'
                    ? '${gjsjsf}-${ywnrfl}'
                    : '${id}-${gjsjsf}-${ywnrfl}'
            );
        });
    });
});
