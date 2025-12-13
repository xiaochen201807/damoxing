/**
 * 交互式图表示例 - 模拟数据API
 */

const express = require('express');
const router = express.Router();

// 模拟数据库
const mockData = {
    high: [
        { id: 1, customer_name: '张三', risk_score: 95, status: 'pending', amount: 500000, overdue_days: 90 },
        { id: 2, customer_name: '李四', risk_score: 88, status: 'processing', amount: 300000, overdue_days: 60 },
        { id: 3, customer_name: '王五', risk_score: 92, status: 'pending', amount: 800000, overdue_days: 120 }
    ],
    medium: [
        { id: 4, customer_name: '赵六', risk_score: 65, status: 'pending', amount: 200000, overdue_days: 30 },
        { id: 5, customer_name: '钱七', risk_score: 58, status: 'completed', amount: 150000, overdue_days: 15 },
        { id: 6, customer_name: '孙八', risk_score: 72, status: 'processing', amount: 250000, overdue_days: 45 }
    ],
    low: [
        { id: 7, customer_name: '周九', risk_score: 35, status: 'completed', amount: 100000, overdue_days: 5 },
        { id: 8, customer_name: '吴十', risk_score: 28, status: 'completed', amount: 80000, overdue_days: 3 },
        { id: 9, customer_name: '郑十一', risk_score: 42, status: 'pending', amount: 120000, overdue_days: 10 }
    ]
};

// 获取饼图数据
router.get('/chart/risk-pie', (req, res) => {
    res.json({
        status: 0,
        msg: 'success',
        data: {
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}条 ({d}%)'
            },
            legend: {
                orient: 'vertical',
                left: 'left'
            },
            series: [
                {
                    name: '风险分类',
                    type: 'pie',
                    radius: '60%',
                    center: ['50%', '50%'],
                    data: [
                        { value: mockData.high.length, name: '高风险', itemId: 'high', itemStyle: { color: '#f5222d' } },
                        { value: mockData.medium.length, name: '中风险', itemId: 'medium', itemStyle: { color: '#fa8c16' } },
                        { value: mockData.low.length, name: '低风险', itemId: 'low', itemStyle: { color: '#52c41a' } }
                    ],
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                }
            ]
        }
    });
});

// 获取风险清册列表
router.get('/risk-list/:category', (req, res) => {
    const { category } = req.params;
    const items = mockData[category] || [];

    res.json({
        status: 0,
        msg: 'success',
        data: {
            items: items,
            total: items.length
        }
    });
});

// 获取客户详情
router.get('/customer/:id', (req, res) => {
    const id = parseInt(req.params.id);

    // 从所有分类中查找
    let customer = null;
    for (const category in mockData) {
        customer = mockData[category].find(c => c.id === id);
        if (customer) break;
    }

    if (customer) {
        res.json({
            status: 0,
            msg: 'success',
            data: customer
        });
    } else {
        res.status(404).json({
            status: 404,
            msg: '客户不存在'
        });
    }
});

// 更新客户信息
router.post('/customer/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const updates = req.body;

    // 从所有分类中查找并更新
    let updated = false;
    for (const category in mockData) {
        const customer = mockData[category].find(c => c.id === id);
        if (customer) {
            Object.assign(customer, updates);
            updated = true;
            break;
        }
    }

    if (updated) {
        res.json({
            status: 0,
            msg: '更新成功',
            data: { id, updated: true }
        });
    } else {
        res.status(404).json({
            status: 404,
            msg: '客户不存在'
        });
    }
});

// 标记为已处理
router.post('/customer/:id/mark-processed', (req, res) => {
    const id = parseInt(req.params.id);

    for (const category in mockData) {
        const customer = mockData[category].find(c => c.id === id);
        if (customer) {
            customer.status = 'completed';
            res.json({
                status: 0,
                msg: '已标记为处理完成',
                data: { id, status: 'completed' }
            });
            return;
        }
    }

    res.status(404).json({
        status: 404,
        msg: '客户不存在'
    });
});

module.exports = router;
