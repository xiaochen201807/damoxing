/**
 * 项目详情页面 Mock 接口
 * 统一提供项目基本信息、阶段概览、任务分组、任务清单和资源清单模拟数据
 */

const express = require('express');
const router = express.Router();

const INFO_FIELDS = [
    { label: '交付项目名称', value: '咸阳中心2026年贝贝2.0升级项目（农行）(SY-WA)' },
    { label: '项目经理', value: '关晔' },
    { label: '客户名称', value: '咸阳公积金中心' },
    { label: '运营项目名称', value: '安泰伟奥运营项目-2026' },
    { label: '运营经理', value: '史磊' },
    { label: '项目阶段', value: '公共资源初始化' }
];

const STAGES = [
    { name: '接收交付任务书', status: '已完成', statusKey: 'done', start: '2026-01-01', end: '2026-02-28' },
    { name: '业务分析评审', status: '已完成', statusKey: 'done', start: '2026-03-01', end: '2026-04-30' },
    { name: '公共资源初始化', status: '处理中', statusKey: 'active', start: '2026-05-01', end: '2026-06-30' },
    { name: '任务制定及分配', status: '已完成', statusKey: 'done', start: '2026-07-01', end: '2026-08-31' },
    { name: '软件生产配置', status: '未开始', statusKey: 'todo', start: '2026-09-01', end: '2026-10-31' },
    { name: '软件生产质检', status: '未开始', statusKey: 'todo', start: '2026-11-01', end: '2026-12-31' },
    { name: '交付成果物', status: '未开始', statusKey: 'todo', start: '2027-01-01', end: '2027-02-28' }
];

const GROUPS = [
    { name: '任务发布', count: 20 },
    { name: '需求填报', count: 7 },
    { name: '故障填报', count: 12 }
];

const SPONSORS = ['赵耀辉', '戴洋', '夏硕云', '杨源', '赵中思', '叶杰', '程岚', '董若', '钱荷', '棠锦彬', '周也', '陈青'];
const TASK_NAMES = ['提取模型', '贷款模型', '数据资源管理', '后勤保障', '财务资金管理', '组织人员资源管理', '业务执行', '行政办公', '业务管理', '服务对象管理', '资源池同步', '标准字典发布'];
const SOURCES = ['任务来源', '系统分发', '运营下发'];

const RESOURCE_TREE = [
    {
        id: 'data-resource',
        name: '数据资源',
        count: 291,
        children: [
            { id: 'data-object', name: '对象', count: 979 },
            { id: 'data-deposit', name: '缴存单位', count: 926 },
            { id: 'data-developer', name: '开发商', count: 813 }
        ]
    },
    {
        id: 'biz-resource',
        name: '业务资源',
        count: 764,
        children: [
            { id: 'biz-interface', name: '接口目录', count: 248 },
            { id: 'biz-template', name: '模板映射', count: 159 }
        ]
    },
    {
        id: 'biz-category',
        name: '业务分类',
        count: 845,
        children: [
            { id: 'biz-rule', name: '规则分类', count: 332 },
            { id: 'biz-scene', name: '场景标签', count: 204 }
        ]
    }
];

function pad(value) {
    return String(value).padStart(2, '0');
}

function calcDueDate(stage, index) {
    const baseMonth = Number(stage.start.slice(5, 7));
    const month = baseMonth + Math.floor((index - 1) / 6);
    const day = ((index * 3) % 27) + 1;
    return `2026-${pad(Math.min(month, 12))}-${pad(day)}`;
}

function getTaskStatus(stageStatusKey, index, groupIndex) {
    if (stageStatusKey === 'done') {
        return { label: '已完成', key: 'done' };
    }

    if (stageStatusKey === 'todo') {
        return { label: '未开始', key: 'todo' };
    }

    if (groupIndex === 0) {
        return index % 5 === 0 ? { label: '处理中', key: 'progress' } : { label: '已完成', key: 'done' };
    }

    return index % 3 === 0 ? { label: '处理中', key: 'progress' } : { label: '未开始', key: 'todo' };
}

function buildTasks() {
    const rows = [];

    STAGES.forEach((stage, stageIndex) => {
        GROUPS.forEach((group, groupIndex) => {
            for (let i = 1; i <= group.count; i += 1) {
                const statusInfo = getTaskStatus(stage.statusKey, i, groupIndex);
                rows.push({
                    stage: stage.name,
                    group: group.name,
                    itemName: `${group.name}-${pad(i)}`,
                    serialNo: i,
                    sponsor: SPONSORS[(stageIndex * 3 + i) % SPONSORS.length],
                    taskId: `HB${123400000 + stageIndex * 1000 + groupIndex * 100 + i}`,
                    taskName: TASK_NAMES[(i + groupIndex + stageIndex) % TASK_NAMES.length],
                    source: SOURCES[(i + groupIndex) % SOURCES.length],
                    dueDate: calcDueDate(stage, i),
                    status: statusInfo.label,
                    statusKey: statusInfo.key
                });
            }
        });
    });

    return rows;
}

function flattenResources(nodes, level, rows) {
    nodes.forEach((node) => {
        rows.push({
            id: node.id,
            name: node.name,
            count: node.count,
            level
        });

        if (Array.isArray(node.children) && node.children.length > 0) {
            flattenResources(node.children, level + 1, rows);
        }
    });
}

const ALL_TASKS = buildTasks();

/**
 * 1. 项目基本信息
 * POST /summary
 */
router.post('/summary', async (_req, res) => {
    res.json({
        status: 0,
        msg: 'ok',
        data: {
            summaryItems: INFO_FIELDS
        }
    });
});

/**
 * 2. 项目阶段概览
 * POST /stages
 */
router.post('/stages', async (_req, res) => {
    const items = STAGES.map((stage) => ({
        ...stage,
        taskCount: ALL_TASKS.filter((task) => task.stage === stage.name).length
    }));

    res.json({
        status: 0,
        msg: 'ok',
        data: {
            items
        }
    });
});

/**
 * 3. 任务分组
 * POST /task-groups
 */
router.post('/task-groups', async (req, res) => {
    const { stage = '' } = req.body || {};
    const items = GROUPS.map((group) => ({
        name: group.name,
        count: ALL_TASKS.filter((task) => (!stage || task.stage === stage) && task.group === group.name).length
    }));

    res.json({
        status: 0,
        msg: 'ok',
        data: {
            items
        }
    });
});

/**
 * 4. 任务清单
 * POST /tasks
 */
router.post('/tasks', async (req, res) => {
    const {
        stage = '',
        group = '',
        page = 1,
        perPage = 10
    } = req.body || {};

    const filtered = ALL_TASKS.filter((task) => {
        if (stage && task.stage !== stage) {
            return false;
        }
        if (group && task.group !== group) {
            return false;
        }
        return true;
    });

    const currentPage = Math.max(Number(page) || 1, 1);
    const currentPerPage = Math.max(Number(perPage) || 10, 1);
    const offset = (currentPage - 1) * currentPerPage;

    res.json({
        status: 0,
        msg: 'ok',
        data: {
            items: filtered.slice(offset, offset + currentPerPage),
            total: filtered.length
        }
    });
});

/**
 * 5. 资源清单
 * POST /resources
 */
router.post('/resources', async (_req, res) => {
    const items = [];
    flattenResources(RESOURCE_TREE, 0, items);

    res.json({
        status: 0,
        msg: 'ok',
        data: {
            items
        }
    });
});

module.exports = router;
