/**
 * 交互式图表示例 - 模拟数据API
 */

const express = require('express');
const router = express.Router();

// 饼图的模拟数据库
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

// 柱形图的模拟数据库（独立数据，6个月 x 3个风险级别）
const barChartMockData = {
    high: [
        { id: 101, customer_name: '刘备', risk_score: 91, status: 'pending', amount: 650000, overdue_days: 95 },
        { id: 102, customer_name: '关羽', risk_score: 87, status: 'processing', amount: 420000, overdue_days: 75 },
        { id: 103, customer_name: '张飞', risk_score: 93, status: 'pending', amount: 780000, overdue_days: 110 },
        { id: 104, customer_name: '赵云', risk_score: 89, status: 'processing', amount: 550000, overdue_days: 85 },
        { id: 105, customer_name: '马超', risk_score: 94, status: 'pending', amount: 890000, overdue_days: 130 },
        { id: 106, customer_name: '黄忠', risk_score: 90, status: 'pending', amount: 720000, overdue_days: 100 }
    ],
    medium: [
        { id: 107, customer_name: '诸葛亮', risk_score: 68, status: 'processing', amount: 280000, overdue_days: 35 },
        { id: 108, customer_name: '庞统', risk_score: 61, status: 'completed', amount: 190000, overdue_days: 20 },
        { id: 109, customer_name: '法正', risk_score: 70, status: 'pending', amount: 310000, overdue_days: 50 },
        { id: 110, customer_name: '徐庶', risk_score: 64, status: 'processing', amount: 230000, overdue_days: 28 },
        { id: 111, customer_name: '姜维', risk_score: 66, status: 'completed', amount: 210000, overdue_days: 22 },
        { id: 112, customer_name: '魏延', risk_score: 73, status: 'pending', amount: 340000, overdue_days: 55 }
    ],
    low: [
        { id: 113, customer_name: '孙权', risk_score: 38, status: 'completed', amount: 130000, overdue_days: 8 },
        { id: 114, customer_name: '周瑜', risk_score: 32, status: 'completed', amount: 95000, overdue_days: 4 },
        { id: 115, customer_name: '鲁肃', risk_score: 40, status: 'completed', amount: 145000, overdue_days: 12 },
        { id: 116, customer_name: '陆逊', risk_score: 36, status: 'completed', amount: 110000, overdue_days: 6 },
        { id: 117, customer_name: '吕蒙', risk_score: 29, status: 'completed', amount: 88000, overdue_days: 3 },
        { id: 118, customer_name: '甘宁', risk_score: 44, status: 'pending', amount: 155000, overdue_days: 15 }
    ]
};

// 获取饼图数据
router.get('/chart/risk-pie', (req, res) => {
    res.json({
        status: 0,
        msg: 'success',
        data: {
            color: ['#3aa1ff', '#36cfc9', '#9254de'],
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
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
                        { value: mockData.high.length, name: '高风险', itemId: 'high' },
                        { value: mockData.medium.length, name: '中风险', itemId: 'medium' },
                        { value: mockData.low.length, name: '低风险', itemId: 'low' }
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

// 获取柱形图数据 (按月统计)
router.get('/chart/risk-bar', (req, res) => {
    // 模拟最近6个月的数据
    const months = ['2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12'];
    const highRisk = [2, 3, 2, 4, 3, 3];
    const mediumRisk = [3, 2, 4, 3, 3, 3];
    const lowRisk = [3, 3, 2, 2, 3, 3];

    res.json({
        status: 0,
        msg: 'success',
        data: {
            color: ['#ff4d4f', '#faad14', '#52c41a'],
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            legend: {
                data: ['高风险', '中风险', '低风险'],
                bottom: 0
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '15%',
                top: '10%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: months,
                axisLabel: {
                    rotate: 0
                }
            },
            yAxis: {
                type: 'value',
                name: '客户数量',
                nameTextStyle: {
                    padding: [0, 0, 0, 50]
                }
            },
            series: [
                {
                    name: '高风险',
                    type: 'bar',
                    stack: 'total',
                    data: highRisk.map((val, idx) => ({
                        value: val,
                        itemId: 'high',
                        month: months[idx]
                    })),
                    emphasis: {
                        focus: 'series'
                    }
                },
                {
                    name: '中风险',
                    type: 'bar',
                    stack: 'total',
                    data: mediumRisk.map((val, idx) => ({
                        value: val,
                        itemId: 'medium',
                        month: months[idx]
                    })),
                    emphasis: {
                        focus: 'series'
                    }
                },
                {
                    name: '低风险',
                    type: 'bar',
                    stack: 'total',
                    data: lowRisk.map((val, idx) => ({
                        value: val,
                        itemId: 'low',
                        month: months[idx]
                    })),
                    emphasis: {
                        focus: 'series'
                    }
                }
            ]
        }
    });
});

// 获取风险清册列表
router.get('/risk-list/:category', (req, res) => {
    const { category } = req.params;
    const { month } = req.query; // 支持按月份过滤

    let items = mockData[category] || [];

    // 如果提供了月份参数，根据月份返回不同的数据子集
    // 在真实场景中，应该在数据库中存储 month 字段并查询
    // 这里为了演示，我们基于月份索引返回数据的不同部分
    if (month) {
        // 将月份映射到索引 (2024-07 -> 0, 2024-08 -> 1, etc.)
        const monthIndex = parseInt(month.split('-')[1]) - 7; // 7月是索引0

        // 根据月份和数据长度，返回该月特定的数据子集
        // 使用取模确保每个月都有数据，但数据不同
        const startIdx = monthIndex % items.length;
        const itemsForMonth = items.slice(startIdx, startIdx + Math.min(2, items.length - startIdx));

        // 如果切片后数据不足，从头部补充
        if (itemsForMonth.length < 2 && items.length >= 2) {
            itemsForMonth.push(...items.slice(0, 2 - itemsForMonth.length));
        }

        items = itemsForMonth.map(item => ({
            ...item,
            month: month // 添加月份标识
        }));
    }

    res.json({
        status: 0,
        msg: 'success',
        data: {
            items: items,
            total: items.length
        }
    });
});

// 获取柱形图的风险清册列表（独立数据源）
router.get('/bar-risk-list/:category', (req, res) => {
    const { category } = req.params;
    const { month } = req.query;

    let items = barChartMockData[category] || [];

    // 如果提供了月份参数，根据月份返回不同的数据子集
    if (month) {
        const monthIndex = parseInt(month.split('-')[1]) - 7;
        const startIdx = monthIndex % items.length;
        const count = category === 'high' ? 2 : category === 'medium' ? 3 : 2;

        let itemsForMonth = items.slice(startIdx, startIdx + count);

        if (itemsForMonth.length < count && items.length >= count) {
            itemsForMonth = [...itemsForMonth, ...items.slice(0, count - itemsForMonth.length)];
        }

        items = itemsForMonth.map(item => ({
            ...item,
            month: month
        }));
    }

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
