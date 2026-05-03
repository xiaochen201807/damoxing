/**
 * 任务项运行配置工具 Mock 接口
 * 提供关键数据算法升级版页面的任务、节点、要素、应用业务和参数配置数据。
 */

const express = require('express');

const router = express.Router();

const TEMPLATES = [
    { label: '统建版', value: 'tpl-1' },
    { label: '省会版', value: 'tpl-2' },
    { label: '地级市版', value: 'tpl-3' },
    { label: '行业版', value: 'tpl-4' },
    { label: '基础贯标版', value: 'tpl-5' }
];

const RELATED_PARTY_OPTIONS = [
    { label: '缴存人', value: 'person' },
    { label: '缴存单位', value: 'unit' },
    { label: '开发商', value: 'developer' }
];

const TASK_TYPE_OPTIONS = [
    { label: '缴存', value: 'jc', parties: ['person', 'unit'] },
    { label: '提取', value: 'tq', parties: ['person'] },
    { label: '贷款', value: 'dk', parties: ['person', 'developer'] },
    { label: '还款', value: 'hk', parties: ['person'] }
];

const TASK_BUSINESS_OPTIONS = {
    tq: [
        { label: '购买住房', value: 'purchase' },
        { label: '建造、翻建、大修住房', value: 'build' },
        { label: '偿还购房贷款本息', value: 'repayLoan' },
        { label: '既有住宅加装电梯', value: 'elevator' },
        { label: '租赁住房', value: 'rent' },
        { label: '物业费', value: 'propertyFee' },
        { label: '离休、退休', value: 'retire' },
        { label: '出境定居', value: 'settleAbroad' }
    ],
    jc: [
        { label: '单位开户', value: 'unitOpen' },
        { label: '个人开户', value: 'personOpen' },
        { label: '汇缴', value: 'remit' },
        { label: '补缴', value: 'supplement' }
    ],
    dk: [
        { label: '新房贷款', value: 'newHouseLoan' },
        { label: '二手房贷款', value: 'secondHouseLoan' },
        { label: '组合贷款', value: 'comboLoan' },
        { label: '开发商准入', value: 'developerAccess' }
    ],
    hk: [
        { label: '正常还款', value: 'normalRepay' },
        { label: '提前部分还款', value: 'partialRepay' },
        { label: '提前结清', value: 'settleLoan' },
        { label: '逾期还款', value: 'overdueRepay' }
    ]
};

const TASK_PATH_TEXT_MAP = {
    tq: '缴存人 / 提取服务 / 提取服务 / 提取',
    jc: '缴存单位 / 缴存服务 / 缴存登记 / 缴存',
    dk: '缴存人 / 贷款服务 / 贷款申请 / 贷款',
    hk: '缴存人 / 贷款服务 / 贷后管理 / 还款'
};

const PARAMETER_OPTIONS = [
    { label: '缴存时间', value: 'depositMonths' },
    { label: '账户余额', value: 'accountBalance' },
    { label: '月缴存额', value: 'monthlyDeposit' },
    { label: '房屋总价', value: 'housePrice' },
    { label: '贷款余额', value: 'loanBalance' },
    { label: '提取频次', value: 'withdrawFrequency' }
];

const TQ_NODE_ELEMENT_DEFINITIONS = [
    ['verify-identity', '核实身份', ['角色', '时效', '内容', '办理条件']],
    ['qualification-check', '资格校验', ['角色', '时效', '办理条件']],
    ['authorization-confirm', '授权确认', ['角色', '时效', '内容', '办理条件', '业务附件', '凭条']],
    ['confirm-amount-reason', '确定提取金额及拟定提取原因', ['角色', '时效', '内容', '办理条件']],
    ['complete-profile', '完善个人信息', ['角色', '时效', '内容', '办理条件']],
    ['complete-material-info', '完善证明材料信息', ['角色', '时效', '内容', '办理条件']],
    ['confirm-material', '确认证明材料', ['角色', '时效', '内容', '办理条件']],
    ['amount-calculate-confirm', '金额计算与确认', ['角色', '时效', '内容', '办理条件', '办理标准']],
    ['select-bank-card', '选择收款银行卡', ['角色', '时效', '内容', '业务附件', '办理条件']],
    ['submit-finish', '提取申请完成', ['角色', '时效', '内容', '办理条件', '凭条']],
    ['review-submit', '提取复核', ['角色', '时效', '内容', '流程节点推送规则', '材料完整性校验', '办理条件', '待办任务描述']],
    ['review-audit', '提取审核', ['角色', '时效', '内容', '流程节点推送规则', '办理条件', '业务风险', '待办任务描述']],
    ['review-approve', '提取审批', ['角色', '时效', '内容', '流程节点推送规则', '办理条件', '待办任务描述']],
    ['task-result-submit', '任务成果提交', ['消息', '任务结果']],
    ['task-accounting', '任务核算', ['事项处理规则', '指标']],
    ['fund-settlement', '资金结算', ['事项处理规则', '资金支付']],
    ['accounting', '会计核算', ['事项处理规则', '三流水一致性校验', '会计核算']],
    ['archive', '档案归档', ['事项处理规则', '档案归档']]
];

function slug(value) {
    return String(value)
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

function createParamGroups(seed) {
    if (seed % 4 === 0) {
        return [
            {
                paramName: 'depositMonths',
                businessStandardValue: '连续足额缴存 6 个月',
                valueSource: '业务标准库'
            }
        ];
    }

    if (seed % 5 === 0) {
        return [
            {
                paramName: 'accountBalance',
                businessStandardValue: '账户余额大于 0',
                valueSource: '账户实时余额'
            },
            {
                paramName: 'withdrawFrequency',
                businessStandardValue: '同一事项一年一次',
                valueSource: '办理记录'
            }
        ];
    }

    return [];
}

function pickAppliedBusinesses(task, seed) {
    const options = TASK_BUSINESS_OPTIONS[task] || TASK_BUSINESS_OPTIONS.tq;
    if (seed % 6 === 0) {
        return [];
    }
    if (seed % 4 === 0) {
        return [options[0].value, options[1]?.value].filter(Boolean);
    }
    if (seed % 3 === 0) {
        return [options[2]?.value || options[0].value];
    }
    return [options[seed % options.length].value];
}

function baseRow(task, node, groupId, elementTitle, index, row) {
    const seed = index + groupId.length;
    return {
        id: `${task}-${groupId}-${index + 1}`,
        task,
        nodeKey: node.key,
        nodeTitle: node.title,
        nodeEnabled: node.enabled,
        groupId,
        elementTitle,
        objectName: row.objectName,
        configItem: row.configItem || row.objectName,
        formula: row.formula || '',
        description: row.description || '',
        appliedBusinesses: row.appliedBusinesses || pickAppliedBusinesses(task, seed),
        algorithmParamGroups: row.algorithmParamGroups || createParamGroups(seed),
        remarks: row.remarks || ''
    };
}

function rowsForElement(nodeKey, nodeTitle, elementTitle) {
    if (elementTitle === '角色') {
        const roleMap = {
            'review-submit': '综合复核岗',
            'review-audit': '综合审核岗',
            'review-approve': '服务部主任'
        };
        return [
            { objectName: roleMap[nodeKey] || '综合柜员', formula: '业务受理与规则校验', description: `${nodeTitle}环节默认办理角色` },
            { objectName: '缴存人', formula: '线上自助办理', description: '服务对象可在网厅、移动端发起办理' },
            { objectName: '灵活就业缴存人', formula: '身份信息核验后办理', description: '适配灵活就业人员提取场景' }
        ];
    }

    if (elementTitle === '时效') {
        return ['实时', '1天', '1月', '1季', '1年'].map(value => ({
            objectName: value,
            formula: `${nodeTitle}环节处理时限`,
            description: `用于控制${nodeTitle}的办理时效和超时提醒`
        }));
    }

    if (elementTitle === '内容') {
        return [
            ['申请信息', '基础展示信息', '采集并展示本环节所需的申请信息'],
            ['校验信息', '关键校验信息', '呈现规则校验、接口核验和模型命中结果'],
            ['结果信息', '处理结果信息', '记录环节处理结论及后续流转状态'],
            ['提示信息', '操作引导信息', '向办理人展示补充材料、风险提示和业务说明'],
            ['关联信息', '关联补充信息', '展示与该任务项相关的账户、贷款、房屋等信息']
        ].map(([objectName, formula, description]) => ({ objectName, formula, description }));
    }

    if (elementTitle === '办理条件') {
        return ['前置受理条件', '身份资格条件', '材料数据条件', '规则命中条件'].map(value => ({
            objectName: value,
            formula: `${value}计算`,
            description: `满足${value}后允许进入${nodeTitle}`
        }));
    }

    if (elementTitle === '办理标准') {
        return ['受理标准', '校验标准', '确认标准', '异常处理标准'].map(value => ({
            objectName: value,
            formula: `${nodeTitle}${value}`,
            description: `定义${nodeTitle}对应的${value}`
        }));
    }

    if (elementTitle === '业务附件') {
        return ['居民身份证', '不动产权证书', '购房合同', '购房发票', '婚姻关系证明'].map(value => ({
            objectName: value,
            formula: '电子材料采集',
            description: `${nodeTitle}需要采集或校验的业务附件`
        }));
    }

    if (elementTitle === '凭条') {
        return [
            { objectName: '公积金提取凭条', formula: '签字方式、CA认证方式', description: '提取业务办理完成后的电子凭证' }
        ];
    }

    if (elementTitle === '流程节点推送规则') {
        return ['正常流转规则', '异常转人工规则', '退回补正规则', '超时催办规则'].map(value => ({
            objectName: value,
            formula: `${value}表达式`,
            description: `${nodeTitle}的节点流转控制规则`
        }));
    }

    if (elementTitle === '材料完整性校验') {
        return ['要件清单校验', 'OCR识别校验', '影像完整性校验', '交叉比对校验'].map(value => ({
            objectName: value,
            formula: `${value}模型`,
            description: `校验提取证明材料是否完整、有效、一致`
        }));
    }

    if (elementTitle === '待办任务描述') {
        return [
            { objectName: `${nodeTitle}待办`, formula: '待办标题与摘要模板', description: `生成${nodeTitle}岗位的待办任务描述` }
        ];
    }

    if (elementTitle === '业务风险') {
        return ['风险识别项', '风险等级', '处置策略', '风险留痕'].map(value => ({
            objectName: value,
            formula: `${value}规则`,
            description: `识别并处理${nodeTitle}阶段的业务风险`
        }));
    }

    if (elementTitle === '消息') {
        return [
            { objectName: '成果消息', formula: '公积金提取任务成果已生成', description: '向发起人和经办人推送任务成果消息' }
        ];
    }

    if (elementTitle === '任务结果') {
        return [
            { objectName: '提取金额', formula: '关键数据算法计算额度', description: '输出本次提取任务最终金额' }
        ];
    }

    if (elementTitle === '事项处理规则') {
        return ['受理规则', '执行规则', '异常规则', '回退规则'].map(value => ({
            objectName: value,
            formula: `${nodeTitle}${value}`,
            description: `定义${nodeTitle}事项处理过程中的${value}`
        }));
    }

    if (elementTitle === '指标') {
        return ['提取金额', '提取人数', '提取购房面积'].map(value => ({
            objectName: value,
            formula: `${value}指标汇总`,
            description: `用于${nodeTitle}统计分析的业务指标`
        }));
    }

    if (elementTitle === '资金支付') {
        return [
            { objectName: '收款账户校验', formula: '银行卡账户一致性校验', description: '校验收款银行卡和缴存人身份一致' },
            { objectName: '支付指令生成', formula: '支付批次与金额生成', description: '根据审批结果生成资金支付指令' }
        ];
    }

    if (elementTitle === '三流水一致性校验') {
        return [
            { objectName: '业务流水', formula: '业务流水与资金流水比对', description: '校验业务办理流水与资金支付流水一致' },
            { objectName: '会计流水', formula: '资金流水与会计流水比对', description: '校验资金支付结果与会计凭证一致' }
        ];
    }

    if (elementTitle === '会计核算') {
        return [
            { objectName: '会计分录', formula: '借贷分录生成', description: '依据提取类型生成会计核算分录' }
        ];
    }

    if (elementTitle === '档案归档') {
        return [
            { objectName: '电子档案', formula: '材料、凭证、流水归档', description: '归集办理过程材料并形成电子档案' }
        ];
    }

    return [
        { objectName: elementTitle, formula: `${nodeTitle}${elementTitle}`, description: `${nodeTitle}的${elementTitle}配置` }
    ];
}

function buildTqGroups() {
    const groups = [];

    TQ_NODE_ELEMENT_DEFINITIONS.forEach(([nodeKey, nodeTitle, elements], nodeIndex) => {
        const node = {
            key: nodeKey,
            title: nodeTitle,
            enabled: nodeIndex < 16
        };

        elements.forEach((elementTitle) => {
            const groupId = `${nodeKey}-${slug(elementTitle)}`;
            const rows = rowsForElement(nodeKey, nodeTitle, elementTitle)
                .map((row, index) => baseRow('tq', node, groupId, elementTitle, index, row));

            groups.push({
                task: 'tq',
                nodeKey,
                nodeTitle,
                nodeEnabled: node.enabled,
                groupId,
                elementTitle,
                rows
            });
        });
    });

    return groups;
}

function buildSimpleGroups(task, definitions) {
    const groups = [];

    definitions.forEach((definition, nodeIndex) => {
        const node = {
            key: definition.nodeKey,
            title: definition.nodeTitle,
            enabled: true
        };

        definition.elements.forEach((element, elementIndex) => {
            const groupId = `${definition.nodeKey}-${slug(element.title)}`;
            const rows = element.rows.map((row, rowIndex) => (
                baseRow(task, node, groupId, element.title, elementIndex * 10 + rowIndex, row)
            ));

            groups.push({
                task,
                nodeKey: definition.nodeKey,
                nodeTitle: definition.nodeTitle,
                nodeEnabled: node.enabled,
                groupId,
                elementTitle: element.title,
                rows: rows.map((row, rowIndex) => ({
                    ...row,
                    appliedBusinesses: row.appliedBusinesses || pickAppliedBusinesses(task, nodeIndex + elementIndex + rowIndex)
                }))
            });
        });
    });

    return groups;
}

function buildRuntimeData() {
    return {
        tq: buildTqGroups(),
        jc: buildSimpleGroups('jc', [
            {
                nodeKey: 'deposit-rule',
                nodeTitle: '缴存规则配置',
                elements: [
                    {
                        title: '缴存比例',
                        rows: [
                            { objectName: '单位缴存比例', formula: '单位比例范围校验', description: '控制单位缴存比例上下限' },
                            { objectName: '个人缴存比例', formula: '个人比例范围校验', description: '控制个人缴存比例上下限' }
                        ]
                    },
                    {
                        title: '缴存基数',
                        rows: [
                            { objectName: '月缴存基数', formula: '上下限基数校验', description: '根据当地工资口径计算缴存基数' },
                            { objectName: '基数调整频次', formula: '年度调整规则', description: '控制基数调整周期和生效时间' }
                        ]
                    }
                ]
            },
            {
                nodeKey: 'deposit-data',
                nodeTitle: '缴存数据配置',
                elements: [
                    {
                        title: '数据采集',
                        rows: [
                            { objectName: '单位账户信息', formula: '单位身份核验', description: '采集单位缴存登记信息' },
                            { objectName: '个人账户信息', formula: '个人身份核验', description: '采集个人账户开户信息' }
                        ]
                    }
                ]
            }
        ]),
        dk: buildSimpleGroups('dk', [
            {
                nodeKey: 'loan-approve',
                nodeTitle: '贷款审批规则',
                elements: [
                    {
                        title: '准入条件',
                        rows: [
                            { objectName: '缴存时长', formula: '连续缴存月数校验', description: '校验借款申请人缴存时长' },
                            { objectName: '贷款额度', formula: '贷款额度测算', description: '结合账户余额、收入和房屋总价测算额度' }
                        ]
                    }
                ]
            },
            {
                nodeKey: 'loan-risk',
                nodeTitle: '贷款风控规则',
                elements: [
                    {
                        title: '风险识别',
                        rows: [
                            { objectName: '信用风险', formula: '征信逾期规则', description: '识别申请人信用风险' },
                            { objectName: '房屋风险', formula: '房屋状态核验', description: '核验抵押房屋状态和权属信息' }
                        ]
                    }
                ]
            }
        ]),
        hk: buildSimpleGroups('hk', [
            {
                nodeKey: 'repay-rule',
                nodeTitle: '还款规则配置',
                elements: [
                    {
                        title: '还款方式',
                        rows: [
                            { objectName: '等额本息', formula: '本息还款计划', description: '计算等额本息还款计划' },
                            { objectName: '等额本金', formula: '本金还款计划', description: '计算等额本金还款计划' }
                        ]
                    }
                ]
            },
            {
                nodeKey: 'repay-data',
                nodeTitle: '还款数据配置',
                elements: [
                    {
                        title: '扣款数据',
                        rows: [
                            { objectName: '还款账户', formula: '还款卡有效性校验', description: '校验约定还款账户状态' },
                            { objectName: '扣款结果', formula: '扣款流水回盘', description: '接收银行扣款回盘并更新结果' }
                        ]
                    }
                ]
            }
        ])
    };
}

const runtimeData = buildRuntimeData();

function normalizeTask(value) {
    return runtimeData[value] ? value : 'tq';
}

function getLabelMap(task) {
    const options = TASK_BUSINESS_OPTIONS[task] || [];
    return options.reduce((acc, item) => {
        acc[item.value] = item.label;
        return acc;
    }, {});
}

function normalizeRow(row) {
    const labelMap = getLabelMap(row.task);
    const appliedLabels = (row.appliedBusinesses || [])
        .map(value => labelMap[value])
        .filter(Boolean);
    const algorithmCount = Array.isArray(row.algorithmParamGroups) ? row.algorithmParamGroups.length : 0;

    return {
        ...row,
        usageText: appliedLabels.length > 0 ? appliedLabels.join('、') : '未配置',
        usageStatus: appliedLabels.length > 0 ? 'configured' : 'empty',
        algorithmSummary: algorithmCount > 0 ? `${algorithmCount} 组参数` : '未配置',
        nodeStatus: row.nodeEnabled ? '启用' : '停用'
    };
}

function flattenRows(task) {
    return (runtimeData[task] || []).flatMap(group => group.rows);
}

function findRow(task, id) {
    return flattenRows(task).find(row => row.id === id);
}

function filterRows(rows, filters) {
    const keyword = String(filters.keyword || '').trim();
    const businessCategory = String(filters.businessCategory || '').trim();
    const groupId = String(filters.groupId || '').trim();

    return rows.filter(row => {
        if (groupId && row.groupId !== groupId) {
            return false;
        }

        if (businessCategory === '__unapplied__' && (row.appliedBusinesses || []).length > 0) {
            return false;
        }

        if (businessCategory && businessCategory !== '__unapplied__' && !(row.appliedBusinesses || []).includes(businessCategory)) {
            return false;
        }

        if (keyword) {
            const haystack = [
                row.nodeTitle,
                row.elementTitle,
                row.objectName,
                row.configItem,
                row.formula,
                row.description,
                normalizeRow(row).usageText
            ].join(' ');

            return haystack.includes(keyword);
        }

        return true;
    });
}

function getSummary(task, rows) {
    const groups = runtimeData[task] || [];
    const nodes = new Set(groups.map(group => group.nodeKey));
    const configuredCount = rows.filter(row => (row.appliedBusinesses || []).length > 0).length;
    const parameterCount = rows.filter(row => Array.isArray(row.algorithmParamGroups) && row.algorithmParamGroups.length > 0).length;

    return {
        taskPathText: TASK_PATH_TEXT_MAP[task],
        totalNodes: nodes.size,
        totalElements: groups.length,
        configuredCount,
        parameterCount
    };
}

function getGroupOptions(task) {
    return (runtimeData[task] || []).map(group => ({
        label: `${group.nodeTitle} / ${group.elementTitle} (${group.rows.length})`,
        value: group.groupId,
        nodeTitle: group.nodeTitle,
        elementTitle: group.elementTitle,
        nodeEnabled: group.nodeEnabled
    }));
}

function toArray(value) {
    if (Array.isArray(value)) {
        return value.filter(item => item !== '');
    }

    if (typeof value === 'string' && value.trim()) {
        return value.split(',').map(item => item.trim()).filter(Boolean);
    }

    return [];
}

function toParamGroups(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(item => item && typeof item === 'object')
        .map(item => ({
            paramName: item.paramName || '',
            businessStandardValue: item.businessStandardValue || '',
            valueSource: item.valueSource || ''
        }))
        .filter(item => item.paramName || item.businessStandardValue || item.valueSource);
}

router.post('/summary', (req, res) => {
    const task = normalizeTask(req.body?.task || 'tq');
    const rows = flattenRows(task);

    res.json({
        status: 0,
        msg: 'ok',
        data: {
            templates: TEMPLATES,
            activeTemplateId: 'tpl-1',
            relatedParties: RELATED_PARTY_OPTIONS,
            taskTypes: TASK_TYPE_OPTIONS,
            parameterOptions: PARAMETER_OPTIONS,
            businessOptions: TASK_BUSINESS_OPTIONS[task],
            ...getSummary(task, rows)
        }
    });
});

router.post('/business-options', (req, res) => {
    const task = normalizeTask(req.body?.task || 'tq');
    const includeAll = req.body?.includeAll !== false;
    const includeUnapplied = req.body?.includeUnapplied !== false;
    const options = [];

    if (includeAll) {
        options.push({ label: '全部应用业务', value: '' });
    }

    options.push(...(TASK_BUSINESS_OPTIONS[task] || []));

    if (includeUnapplied) {
        options.push({ label: '未配置', value: '__unapplied__' });
    }

    res.json({ status: 0, msg: 'ok', data: options });
});

router.post('/group-options', (req, res) => {
    const task = normalizeTask(req.body?.task || 'tq');
    const options = [
        { label: '全部节点要素', value: '' },
        ...getGroupOptions(task)
    ];

    res.json({ status: 0, msg: 'ok', data: options });
});

router.post('/catalog', (req, res) => {
    const task = normalizeTask(req.body?.task || 'tq');
    const nodes = [];

    (runtimeData[task] || []).forEach(group => {
        let node = nodes.find(item => item.value === group.nodeKey);
        if (!node) {
            node = {
                label: group.nodeTitle,
                value: group.nodeKey,
                nodeEnabled: group.nodeEnabled,
                children: []
            };
            nodes.push(node);
        }

        node.children.push({
            label: group.elementTitle,
            value: group.groupId,
            rowCount: group.rows.length
        });
    });

    res.json({
        status: 0,
        msg: 'ok',
        data: {
            items: nodes,
            groups: getGroupOptions(task)
        }
    });
});

router.post('/rows', (req, res) => {
    const task = normalizeTask(req.body?.task || 'tq');
    const page = Math.max(Number(req.body?.page) || 1, 1);
    const perPage = Math.max(Number(req.body?.perPage) || 10, 1);
    const allRows = flattenRows(task);
    const filtered = filterRows(allRows, req.body || {});
    const offset = (page - 1) * perPage;
    const items = filtered.slice(offset, offset + perPage).map(normalizeRow);
    const summary = getSummary(task, allRows);

    res.json({
        status: 0,
        msg: 'ok',
        data: {
            items,
            total: filtered.length,
            pathText: summary.taskPathText,
            totalNodes: summary.totalNodes,
            totalElements: summary.totalElements,
            configuredCount: summary.configuredCount,
            parameterCount: summary.parameterCount,
            templateItems: TEMPLATES,
            activeTemplateName: '统建版',
            parameterOptions: PARAMETER_OPTIONS
        }
    });
});

router.post('/save-business-config', (req, res) => {
    const task = normalizeTask(req.body?.task || 'tq');
    const row = findRow(task, req.body?.id);

    if (!row) {
        res.status(404).json({ status: 1, msg: '配置项不存在' });
        return;
    }

    row.appliedBusinesses = toArray(req.body?.appliedBusinesses);
    row.algorithmParamGroups = toParamGroups(req.body?.algorithmParamGroups);
    row.remarks = req.body?.remarks || '';

    res.json({
        status: 0,
        msg: '保存成功',
        data: normalizeRow(row)
    });
});

module.exports = router;
