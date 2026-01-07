/**
 * 交互式图表示例 - 模拟数据API
 */

const express = require('express');
const router = express.Router();
const { paginate } = require('../../utils/pagination');

// 饼图的模拟数据库 - 8 个风险等级
const mockData = {
    critical: [ // 极高风险
        { id: 1, customer_name: '张三', risk_score: 98, status: 'pending', amount: 800000, overdue_days: 150 },
        { id: 2, customer_name: '李四', risk_score: 96, status: 'processing', amount: 750000, overdue_days: 135 },
        { id: 3, customer_name: '王五', risk_score: 97, status: 'pending', amount: 900000, overdue_days: 160 }
    ],
    high: [ // 高风险 - 35条数据用于测试分页
        { id: 4, customer_name: '赵六', risk_score: 88, status: 'pending', amount: 500000, overdue_days: 90 },
        { id: 5, customer_name: '钱七', risk_score: 85, status: 'processing', amount: 450000, overdue_days: 75 },
        { id: 6, customer_name: '孙八', risk_score: 92, status: 'pending', amount: 600000, overdue_days: 110 },
        { id: 7, customer_name: '周九', risk_score: 87, status: 'processing', amount: 480000, overdue_days: 85 },
        { id: 31, customer_name: '郑强', risk_score: 89, status: 'pending', amount: 520000, overdue_days: 92 },
        { id: 32, customer_name: '王磊', risk_score: 86, status: 'processing', amount: 470000, overdue_days: 78 },
        { id: 33, customer_name: '李娜', risk_score: 91, status: 'pending', amount: 580000, overdue_days: 105 },
        { id: 34, customer_name: '张伟', risk_score: 84, status: 'completed', amount: 430000, overdue_days: 70 },
        { id: 35, customer_name: '刘洋', risk_score: 90, status: 'pending', amount: 560000, overdue_days: 98 },
        { id: 36, customer_name: '陈明', risk_score: 88, status: 'processing', amount: 510000, overdue_days: 88 },
        { id: 37, customer_name: '杨静', risk_score: 87, status: 'pending', amount: 490000, overdue_days: 82 },
        { id: 38, customer_name: '赵丽', risk_score: 93, status: 'processing', amount: 620000, overdue_days: 115 },
        { id: 39, customer_name: '黄涛', risk_score: 85, status: 'pending', amount: 460000, overdue_days: 76 },
        { id: 40, customer_name: '周芳', risk_score: 89, status: 'completed', amount: 530000, overdue_days: 94 },
        { id: 41, customer_name: '吴刚', risk_score: 86, status: 'pending', amount: 480000, overdue_days: 80 },
        { id: 42, customer_name: '徐敏', risk_score: 91, status: 'processing', amount: 570000, overdue_days: 102 },
        { id: 43, customer_name: '孙勇', risk_score: 88, status: 'pending', amount: 505000, overdue_days: 90 },
        { id: 44, customer_name: '马超', risk_score: 87, status: 'completed', amount: 495000, overdue_days: 84 },
        { id: 45, customer_name: '朱军', risk_score: 92, status: 'pending', amount: 590000, overdue_days: 108 },
        { id: 46, customer_name: '胡斌', risk_score: 84, status: 'processing', amount: 440000, overdue_days: 72 },
        { id: 47, customer_name: '郭华', risk_score: 90, status: 'pending', amount: 550000, overdue_days: 96 },
        { id: 48, customer_name: '林峰', risk_score: 86, status: 'completed', amount: 475000, overdue_days: 79 },
        { id: 49, customer_name: '何建', risk_score: 89, status: 'pending', amount: 525000, overdue_days: 93 },
        { id: 50, customer_name: '高鹏', risk_score: 85, status: 'processing', amount: 455000, overdue_days: 74 },
        { id: 51, customer_name: '梁杰', risk_score: 91, status: 'pending', amount: 575000, overdue_days: 104 },
        { id: 52, customer_name: '宋涛', risk_score: 88, status: 'completed', amount: 515000, overdue_days: 91 },
        { id: 53, customer_name: '唐丽', risk_score: 87, status: 'pending', amount: 485000, overdue_days: 81 },
        { id: 54, customer_name: '韩梅', risk_score: 93, status: 'processing', amount: 610000, overdue_days: 112 },
        { id: 55, customer_name: '冯强', risk_score: 84, status: 'pending', amount: 445000, overdue_days: 73 },
        { id: 56, customer_name: '于洋', risk_score: 90, status: 'completed', amount: 545000, overdue_days: 97 },
        { id: 57, customer_name: '董敏', risk_score: 86, status: 'pending', amount: 465000, overdue_days: 77 },
        { id: 58, customer_name: '萧勇', risk_score: 89, status: 'processing', amount: 535000, overdue_days: 95 }
    ],
    'medium-high': [ // 中高风险
        { id: 8, customer_name: '吴十', risk_score: 72, status: 'processing', amount: 350000, overdue_days: 55 },
        { id: 9, customer_name: '郑十一', risk_score: 75, status: 'pending', amount: 380000, overdue_days: 60 },
        { id: 10, customer_name: '冯十二', risk_score: 70, status: 'processing', amount: 320000, overdue_days: 50 },
        { id: 11, customer_name: '陈十三', risk_score: 78, status: 'completed', amount: 400000, overdue_days: 45 }
    ],
    medium: [ // 中风险 - 25条数据
        { id: 12, customer_name: '褚十四', risk_score: 62, status: 'pending', amount: 280000, overdue_days: 35 },
        { id: 13, customer_name: '卫十五', risk_score: 58, status: 'completed', amount: 250000, overdue_days: 28 },
        { id: 14, customer_name: '蒋十六', risk_score: 65, status: 'processing', amount: 300000, overdue_days: 40 },
        { id: 15, customer_name: '沈十七', risk_score: 60, status: 'processing', amount: 270000, overdue_days: 32 },
        { id: 59, customer_name: '程浩', risk_score: 63, status: 'pending', amount: 285000, overdue_days: 36 },
        { id: 60, customer_name: '曾丽', risk_score: 59, status: 'completed', amount: 255000, overdue_days: 29 },
        { id: 61, customer_name: '彭军', risk_score: 66, status: 'processing', amount: 305000, overdue_days: 41 },
        { id: 62, customer_name: '吕静', risk_score: 61, status: 'pending', amount: 275000, overdue_days: 33 },
        { id: 63, customer_name: '苏伟', risk_score: 64, status: 'completed', amount: 290000, overdue_days: 37 },
        { id: 64, customer_name: '卢涛', risk_score: 58, status: 'processing', amount: 260000, overdue_days: 30 },
        { id: 65, customer_name: '蒋芳', risk_score: 67, status: 'pending', amount: 310000, overdue_days: 42 },
        { id: 66, customer_name: '蔡明', risk_score: 62, status: 'completed', amount: 282000, overdue_days: 35 },
        { id: 67, customer_name: '丁强', risk_score: 60, status: 'processing', amount: 272000, overdue_days: 33 },
        { id: 68, customer_name: '余娜', risk_score: 65, status: 'pending', amount: 295000, overdue_days: 38 },
        { id: 69, customer_name: '潘勇', risk_score: 59, status: 'completed', amount: 265000, overdue_days: 31 },
        { id: 70, customer_name: '杜敏', risk_score: 63, status: 'processing', amount: 288000, overdue_days: 36 },
        { id: 71, customer_name: '戴华', risk_score: 61, status: 'pending', amount: 278000, overdue_days: 34 },
        { id: 72, customer_name: '夏峰', risk_score: 66, status: 'completed', amount: 302000, overdue_days: 40 },
        { id: 73, customer_name: '钟建', risk_score: 58, status: 'processing', amount: 258000, overdue_days: 29 },
        { id: 74, customer_name: '汪鹏', risk_score: 64, status: 'pending', amount: 292000, overdue_days: 37 },
        { id: 75, customer_name: '田杰', risk_score: 60, status: 'completed', amount: 268000, overdue_days: 32 }
    ],
    'medium-low': [ // 中低风险
        { id: 16, customer_name: '韩十八', risk_score: 48, status: 'completed', amount: 200000, overdue_days: 22 },
        { id: 17, customer_name: '杨十九', risk_score: 52, status: 'processing', amount: 220000, overdue_days: 25 },
        { id: 18, customer_name: '朱二十', risk_score: 45, status: 'completed', amount: 180000, overdue_days: 18 },
        { id: 19, customer_name: '秦廿一', risk_score: 50, status: 'completed', amount: 210000, overdue_days: 20 }
    ],
    low: [ // 低风险
        { id: 20, customer_name: '尤廿二', risk_score: 35, status: 'completed', amount: 150000, overdue_days: 12 },
        { id: 21, customer_name: '许廿三', risk_score: 38, status: 'completed', amount: 160000, overdue_days: 14 },
        { id: 22, customer_name: '何廿四', risk_score: 32, status: 'completed', amount: 140000, overdue_days: 10 },
        { id: 23, customer_name: '吕廿五', risk_score: 40, status: 'pending', amount: 170000, overdue_days: 15 }
    ],
    minimal: [ // 极低风险
        { id: 24, customer_name: '施廿六', risk_score: 22, status: 'completed', amount: 100000, overdue_days: 5 },
        { id: 25, customer_name: '张廿七', risk_score: 25, status: 'completed', amount: 110000, overdue_days: 6 },
        { id: 26, customer_name: '孔廿八', risk_score: 20, status: 'completed', amount: 95000, overdue_days: 4 }
    ],
    safe: [ // 安全
        { id: 27, customer_name: '曹廿九', risk_score: 10, status: 'completed', amount: 80000, overdue_days: 2 },
        { id: 28, customer_name: '严三十', risk_score: 12, status: 'completed', amount: 85000, overdue_days: 3 },
        { id: 29, customer_name: '华卅一', risk_score: 8, status: 'completed', amount: 75000, overdue_days: 1 },
        { id: 30, customer_name: '金卅二', risk_score: 15, status: 'completed', amount: 90000, overdue_days: 3 }
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
            color: ['#d32029', '#ff4d4f', '#ff7a45', '#ffa940', '#ffc53d', '#fadb14', '#a0d911', '#52c41a'],
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
                        { value: mockData.critical.length, name: '极高风险', itemId: 'critical' },
                        { value: mockData.high.length, name: '高风险', itemId: 'high' },
                        { value: mockData['medium-high'].length, name: '中高风险', itemId: 'medium-high' },
                        { value: mockData.medium.length, name: '中风险', itemId: 'medium' },
                        { value: mockData['medium-low'].length, name: '中低风险', itemId: 'medium-low' },
                        { value: mockData.low.length, name: '低风险', itemId: 'low' },
                        { value: mockData.minimal.length, name: '极低风险', itemId: 'minimal' },
                        { value: mockData.safe.length, name: '安全', itemId: 'safe' }
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

// 获取柱形图数据 (使用真实的 Java 适配器返回格式)
router.get('/chart/risk-bar', (req, res) => {
    res.json({
        status: 0,
        msg: 'success',
        data: {
            tooltip: {
                trigger: 'axis',
                formatter: null
            },
            legend: {
                bottom: '0',
                orient: 'vertical',
                left: null,
                top: null
            },
            color: ['#c23531', '#d9534f', '#e74c3c', '#ff5252', '#ff6b6b', '#ff7043', '#ff8a65', '#ffa726', '#ffb74d', '#ffc947', '#ffd54f', '#ffe082', '#ffeb3b', '#fff176', '#fff59d', '#cddc39', '#d4e157', '#dce775', '#aed581', '#9ccc65', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32', '#1b5e20', '#1b5e20', '#1b5e20', '#1b5e20', '#1b5e20'],
            grid: {
                left: '3%',
                bottom: '10%',
                right: '4%',
                containLabel: true
            },
            series: [{
                type: 'bar',
                data: [
                    {
                        itemId: 'dwkhyc',
                        name: '开户异常',
                        itemStyle: { color: '#ff4d4f' },
                        value: 3399.0
                    },
                    {
                        itemId: 'dwrsxbyc',
                        name: '人数虚报',
                        itemStyle: { color: '#ff4d4f' },
                        value: 86.0
                    },
                    {
                        itemId: 'dwyjceyc',
                        name: '月缴存额异常',
                        value: 0.0
                    },
                    {
                        itemId: 'dwgfxbjyc',
                        name: '高风险补缴',
                        value: 0.0
                    },
                    {
                        itemId: 'dwdhjsyc',
                        name: '贷后基数下降',
                        value: 0.0
                    },
                    {
                        itemId: 'dwdhdjyc',
                        name: '贷后断缴',
                        value: 0.0
                    }
                ],
                itemStyle: {
                    borderRadius: [4, 4, 0, 0]
                }
            }],
            // 注意：修正字段名大小写，ECharts 需要 xAxis/yAxis（驼峰式）
            xAxis: {
                type: 'category',
                data: ['开户异常', '人数虚报', '月缴存额异常', '高风险补缴', '贷后基数下降', '贷后断缴']
            },
            yAxis: {
                type: 'value',
                data: null
            }
        }
    });
});

// 获取风险清册列表
router.get('/risk-list/:category', (req, res) => {
    const { category } = req.params;
    const { month, keyword, status, page, perPage } = req.query; // 支持搜索和分页

    let items = mockData[category] || [];

    // 如果提供了月份参数，根据月份返回不同的数据子集
    if (month) {
        const monthIndex = parseInt(month.split('-')[1]) - 7;
        const startIdx = monthIndex % items.length;
        const itemsForMonth = items.slice(startIdx, startIdx + Math.min(2, items.length - startIdx));

        if (itemsForMonth.length < 2 && items.length >= 2) {
            itemsForMonth.push(...items.slice(0, 2 - itemsForMonth.length));
        }

        items = itemsForMonth.map(item => ({
            ...item,
            month: month
        }));
    }

    // 关键词搜索（客户名称）
    if (keyword) {
        items = items.filter(item =>
            item.customer_name && item.customer_name.includes(keyword)
        );
    }

    // 状态过滤
    if (status) {
        items = items.filter(item => item.status === status);
    }

    // 应用分页
    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
    });
});

// 获取柱形图的风险清册列表（独立数据源）
router.get('/bar-risk-list/:category', (req, res) => {
    const { category } = req.params;
    const { month, page, perPage } = req.query;

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

    // 应用分页
    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
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

// 获取页面头部统计信息
router.get('/header-info', (req, res) => {
    // 计算总客户数（所有风险级别）
    const totalCustomers = Object.values(mockData).reduce(
        (sum, category) => sum + category.length,
        0
    );

    // 计算总房产数（模拟：假设每个客户平均0.7套房产）
    const totalHouses = Math.floor(totalCustomers * 0.7);

    // 获取当前时间
    const now = new Date();
    const updateTime = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // 格式化数字（添加千位分隔符）
    const formatNumber = (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const customerCountFormatted = formatNumber(totalCustomers);
    const houseCountFormatted = formatNumber(totalHouses);

    // 生成完整的显示文本（后端控制）
    const displayText = `数据更新时间: ${updateTime} | 覆盖范围: 全市在贷客户 ${customerCountFormatted} 人，抵押房产 ${houseCountFormatted} 套`;

    res.json({
        status: 0,
        msg: 'success',
        data: {
            // 完整的显示文本（推荐使用）
            displayText: displayText,

            // 原始数据（兼容旧版本，可选使用）
            updateTime: updateTime,
            customerCount: customerCountFormatted,
            houseCount: houseCountFormatted,

            // 额外的统计信息
            highRiskCount: mockData.high.length,
            mediumRiskCount: mockData.medium.length,
            lowRiskCount: mockData.low.length
        }
    });
});

// ==================== POST 格式的测试 API ====================

/**
 * POST 版本 - 获取饼图数据
 * 接收参数：chart_id, time_range 等
 */
router.post('/chart/risk-pie-post', (req, res) => {
    const { chart_id, time_range } = req.body;

    // 记录请求参数（用于调试）
    console.log('[POST] 饼图数据请求:', { chart_id, time_range });

    // 返回相同的数据结构
    res.json({
        status: 0,
        msg: 'success',
        data: {
            color: ['#d32029', '#ff4d4f', '#ff7a45', '#ffa940', '#ffc53d', '#fadb14', '#a0d911', '#52c41a'],
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
                        { value: mockData.critical.length, name: '极高风险', itemId: 'critical' },
                        { value: mockData.high.length, name: '高风险', itemId: 'high' },
                        { value: mockData['medium-high'].length, name: '中高风险', itemId: 'medium-high' },
                        { value: mockData.medium.length, name: '中风险', itemId: 'medium' },
                        { value: mockData['medium-low'].length, name: '中低风险', itemId: 'medium-low' },
                        { value: mockData.low.length, name: '低风险', itemId: 'low' },
                        { value: mockData.minimal.length, name: '极低风险', itemId: 'minimal' },
                        { value: mockData.safe.length, name: '安全', itemId: 'safe' }
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

/**
 * POST 版本 - 获取柱形图数据
 */
router.post('/chart/risk-bar-post', (req, res) => {
    const { chart_id, time_range } = req.body;

    console.log('[POST] 柱状图数据请求:', { chart_id, time_range });

    const months = ['2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12'];
    const customerCounts = [8, 8, 8, 9, 9, 9];

    res.json({
        status: 0,
        msg: 'success',
        data: {
            color: ['#1890ff'],
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                },
                formatter: '{b}<br/>客户数量: {c}'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '10%',
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
                    name: '客户数量',
                    type: 'bar',
                    data: customerCounts.map((val, idx) => ({
                        value: val,
                        itemId: months[idx],
                        month: months[idx]
                    })),
                    barWidth: '50%',
                    itemStyle: {
                        borderRadius: [4, 4, 0, 0]
                    },
                    emphasis: {
                        itemStyle: {
                            color: '#40a9ff'
                        }
                    }
                }
            ]
        }
    });
});

/**
 * POST 版本 - 获取横向柱状图数据（地区分布）
 */
router.post('/chart/region-bar-post', (req, res) => {
    const { chart_id, time_range } = req.body;

    console.log('[POST] 横向柱状图数据请求:', { chart_id, time_range });

    const regions = ['华东地区', '华南地区', '华北地区', '西南地区', '华中地区'];
    const customerCounts = [15, 12, 10, 8, 6];

    res.json({
        status: 0,
        msg: 'success',
        data: {
            color: ['#5470c6'],
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                },
                formatter: '{b}: {c}个客户'
            },
            grid: {
                left: '15%',
                right: '10%',
                bottom: '3%',
                top: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                name: '客户数量'
            },
            yAxis: {
                type: 'category',
                data: regions,
                axisLabel: {
                    interval: 0
                }
            },
            series: [
                {
                    name: '客户数量',
                    type: 'bar',
                    data: customerCounts.map((val, idx) => ({
                        value: val,
                        itemId: regions[idx],
                        region: regions[idx]
                    })),
                    barWidth: '60%',
                    itemStyle: {
                        borderRadius: [0, 4, 4, 0]
                    },
                    emphasis: {
                        itemStyle: {
                            color: '#748ffc'
                        }
                    },
                    label: {
                        show: true,
                        position: 'right',
                        formatter: '{c}'
                    }
                }
            ]
        }
    });
});

/**
 * POST 版本 - 获取风险清册列表
 * 接收参数：selectedId (必需), chart_id, month, page, perPage 等
 */
router.post('/risk-list-post', (req, res) => {
    const { selectedId, chart_id, month, page, perPage } = req.body;

    console.log('[POST] 风险清册请求:', { selectedId, chart_id, month, page, perPage });

    // selectedId 是必需的
    if (!selectedId) {
        return res.status(400).json({
            status: 400,
            msg: 'selectedId is required'
        });
    }

    const category = selectedId;
    let items = mockData[category] || [];

    // 如果提供了月份参数，根据月份返回不同的数据子集
    if (month) {
        const monthIndex = parseInt(month.split('-')[1]) - 7;
        const startIdx = monthIndex % items.length;
        const itemsForMonth = items.slice(startIdx, startIdx + Math.min(2, items.length - startIdx));

        if (itemsForMonth.length < 2 && items.length >= 2) {
            itemsForMonth.push(...items.slice(0, 2 - itemsForMonth.length));
        }

        items = itemsForMonth.map(item => ({
            ...item,
            month: month
        }));
    }

    // 应用分页
    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
    });
});

/**
 * POST 版本 - 获取柱形图的风险清册列表
 */
router.post('/bar-risk-list-post', (req, res) => {
    const { selectedId, chart_id, month, keyword, status, minAmount, page, perPage } = req.body;

    // selectedId 现在是月份，如 "2024-07"
    const targetMonth = selectedId || month;

    console.log('[POST] 柱状图钻取请求:', { selectedId, targetMonth, chart_id, keyword, status, minAmount, page, perPage });

    // 模拟不同月份的客户数据
    const monthlyCustomers = {
        '2024-07': [
            { id: 'C001', customer_name: '张三公司', risk_score: 85, risk_level: 'high', month: '2024-07', status: 'pending', amount: 50000 },
            { id: 'C002', customer_name: '李四企业', risk_score: 65, risk_level: 'medium', month: '2024-07', status: 'processing', amount: 30000 },
            { id: 'C003', customer_name: '王五集团', risk_score: 45, risk_level: 'low', month: '2024-07', status: 'completed', amount: 20000 }
        ],
        '2024-08': [
            { id: 'C004', customer_name: '赵六实业', risk_score: 78, risk_level: 'high', month: '2024-08', status: 'pending', amount: 45000 },
            { id: 'C005', customer_name: '钱七商贸', risk_score: 58, risk_level: 'medium', month: '2024-08', status: 'processing', amount: 25000 },
            { id: 'C003', customer_name: '王五集团', risk_score: 42, risk_level: 'low', month: '2024-08', status: 'completed', amount: 18000 }
        ],
        '2024-09': [
            { id: 'C001', customer_name: '张三公司', risk_score: 88, risk_level: 'high', month: '2024-09', status: 'pending', amount: 55000 },
            { id: 'C006', customer_name: '孙八科技', risk_score: 52, risk_level: 'medium', month: '2024-09', status: 'processing', amount: 22000 }
        ],
        '2024-10': [
            { id: 'C007', customer_name: '周九贸易', risk_score: 92, risk_level: 'high', month: '2024-10', status: 'pending', amount: 60000 },
            { id: 'C002', customer_name: '李四企业', risk_score: 68, risk_level: 'medium', month: '2024-10', status: 'processing', amount: 35000 },
            { id: 'C008', customer_name: '吴十建筑', risk_score: 48, risk_level: 'low', month: '2024-10', status: 'completed', amount: 15000 }
        ],
        '2024-11': [
            { id: 'C001', customer_name: '张三公司', risk_score: 90, risk_level: 'high', month: '2024-11', status: 'pending', amount: 58000 },
            { id: 'C009', customer_name: '郑十一物流', risk_score: 72, risk_level: 'medium', month: '2024-11', status: 'processing', amount: 28000 }
        ],
        '2024-12': [
            { id: 'C010', customer_name: '王十二投资', risk_score: 95, risk_level: 'high', month: '2024-12', status: 'pending', amount: 65000 },
            { id: 'C001', customer_name: '张三公司', risk_score: 82, risk_level: 'high', month: '2024-12', status: 'processing', amount: 52000 },
            { id: 'C002', customer_name: '李四企业', risk_score: 62, risk_level: 'medium', month: '2024-12', status: 'completed', amount: 32000 }
        ]
    };

    let items = monthlyCustomers[targetMonth] || [
        { id: 'C999', customer_name: '暂无数据', risk_score: 0, risk_level: 'low', month: targetMonth, status: 'pending', amount: 0 }
    ];

    // 关键词搜索（客户名称）
    if (keyword) {
        items = items.filter(item =>
            item.customer_name && item.customer_name.includes(keyword)
        );
    }

    // 状态过滤
    if (status) {
        items = items.filter(item => item.status === status);
    }

    // 最小金额过滤
    if (minAmount !== undefined && minAmount !== null && minAmount !== '') {
        items = items.filter(item =>
            item.amount && item.amount >= parseFloat(minAmount)
        );
    }

    // 应用分页
    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
    });
});

/**
 * POST 版本 - 获取横向柱状图钻取清册（按地区）
 */
router.post('/region-list-post', (req, res) => {
    const { selectedId, chart_id, keyword, region, status, page, perPage } = req.body;

    const selectedRegion = selectedId;

    console.log('[POST] 横向柱状图钻取请求:', { selectedId, selectedRegion, chart_id, keyword, region, status, page, perPage });

    let items = [];

    if (selectedRegion) {
        const allData = [
            ...barChartMockData.high,
            ...barChartMockData.medium,
            ...barChartMockData.low
        ];

        items = allData.map((item, idx) => ({
            ...item,
            region: selectedRegion,
            city: ['上海', '杭州', '南京', '苏州', '宁波'][idx % 5]
        })).slice(0, 12);
    } else {
        items = [
            ...barChartMockData.high,
            ...barChartMockData.medium,
            ...barChartMockData.low
        ].slice(0, 12);
    }

    // 关键词搜索（客户名称）
    if (keyword) {
        items = items.filter(item =>
            item.customer_name && item.customer_name.includes(keyword)
        );
    }

    // 地区过滤（如果提供了额外的 region 参数）
    if (region && region !== selectedRegion) {
        items = items.filter(item => item.region === region);
    }

    // 状态过滤
    if (status) {
        items = items.filter(item => item.status === status);
    }

    // 应用分页
    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
    });
});

/**
 * POST 版本 - 获取折线图数据
 */
router.post('/chart/risk-line-post', (req, res) => {
    const { chart_id, time_range } = req.body;

    console.log('[POST] 折线图数据请求:', { chart_id, time_range });

    const months = ['2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12'];

    res.json({
        status: 0,
        msg: 'success',
        data: {
            color: ['#ff4d4f', '#faad14', '#52c41a'],
            tooltip: {
                trigger: 'axis'
            },
            legend: {
                data: ['高风险', '中风险', '低风险']
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: months
            },
            yAxis: {
                type: 'value'
            },
            series: [
                {
                    name: '高风险',
                    type: 'line',
                    data: [4, 5, 3, 6, 4, 5],
                    smooth: true
                },
                {
                    name: '中风险',
                    type: 'line',
                    data: [8, 7, 9, 8, 10, 9],
                    smooth: true
                },
                {
                    name: '低风险',
                    type: 'line',
                    data: [12, 13, 11, 14, 13, 15],
                    smooth: true
                }
            ]
        }
    });
});

/**
 * POST 版本 - 获取漏斗图数据
 */
router.post('/chart/risk-funnel-post', (req, res) => {
    const { chart_id, time_range } = req.body;

    console.log('[POST] 漏斗图数据请求:', { chart_id, time_range });

    res.json({
        status: 0,
        msg: 'success',
        data: {
            color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'],
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}'
            },
            legend: {
                data: ['申请', '初审', '复审', '审批', '放款']
            },
            series: [
                {
                    name: '贷款流程',
                    type: 'funnel',
                    left: '10%',
                    width: '80%',
                    label: {
                        formatter: '{b}: {c}'
                    },
                    data: [
                        { value: 100, name: '申请', itemId: 'apply' },
                        { value: 80, name: '初审', itemId: 'review1' },
                        { value: 60, name: '复审', itemId: 'review2' },
                        { value: 40, name: '审批', itemId: 'approve' },
                        { value: 30, name: '放款', itemId: 'loan' }
                    ]
                }
            ]
        }
    });
});

/**
 * POST 版本 - 获取雷达图数据
 */
router.post('/chart/risk-radar-post', (req, res) => {
    const { chart_id, time_range } = req.body;

    console.log('[POST] 雷达图数据请求:', { chart_id, time_range });

    res.json({
        status: 0,
        msg: 'success',
        data: {
            color: ['#ff4d4f', '#1890ff'],
            tooltip: {},
            legend: {
                data: ['实际风险', '预期风险']
            },
            radar: {
                indicator: [
                    { name: '信用评分', max: 100 },
                    { name: '资产状况', max: 100 },
                    { name: '还款能力', max: 100 },
                    { name: '负债比率', max: 100 },
                    { name: '历史记录', max: 100 }
                ]
            },
            series: [
                {
                    name: '风险评估',
                    type: 'radar',
                    data: [
                        {
                            value: [85, 70, 90, 60, 95],
                            name: '实际风险'
                        },
                        {
                            value: [75, 80, 85, 70, 90],
                            name: '预期风险'
                        }
                    ]
                }
            ]
        }
    });
});

/**
 * POST 版本 - 获取仪表盘数据
 */
router.post('/chart/risk-gauge-post', (req, res) => {
    const { chart_id, time_range } = req.body;

    console.log('[POST] 仪表盘数据请求:', { chart_id, time_range });

    res.json({
        status: 0,
        msg: 'success',
        data: {
            tooltip: {
                formatter: '{a} <br/>{b} : {c}%'
            },
            series: [
                {
                    name: '风险指数',
                    type: 'gauge',
                    detail: {
                        formatter: '{value}%',
                        fontSize: 20
                    },
                    data: [
                        { value: 68, name: '综合风险评分' }
                    ],
                    axisLine: {
                        lineStyle: {
                            width: 20,
                            color: [
                                [0.3, '#52c41a'],
                                [0.7, '#faad14'],
                                [1, '#ff4d4f']
                            ]
                        }
                    }
                }
            ]
        }
    });
});

// 条形图（横向柱状图）数据
router.post('/chart/horizontal-bar-post', (req, res) => {
    res.json({
        status: 0,
        msg: 'success',
        data: {
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            grid: {
                left: '15%',
                right: '10%',
                bottom: '3%',
                top: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                name: '评分'
            },
            yAxis: {
                type: 'category',
                data: ['服务态度', '办事效率', '业务熟练', '热线响应', '一次办成']
            },
            series: [{
                type: 'bar',
                data: [
                    { value: 78, itemId: 'service1', name: '服务态度' },
                    { value: 65, itemId: 'service2', name: '办事效率' },
                    { value: 43, itemId: 'service3', name: '业务熟练' },
                    { value: 35, itemId: 'service4', name: '热线响应' },
                    { value: 29, itemId: 'service5', name: '一次办成' }
                ],
                itemStyle: {
                    borderRadius: [0, 4, 4, 0],
                    color: '#1890ff'
                }
            }]
        }
    });
});

// 分组柱状图（多系列）数据
router.post('/chart/grouped-bar-post', (req, res) => {
    res.json({
        status: 0,
        msg: 'success',
        data: {
            legend: {
                data: ['浏览次数（万次/月）', '咨询次数（万次/月）', '办理次数（万次/月）'],
                bottom: '0',
                left: 'center'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '12%',
                top: '10%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: ['贷款业务', '缴存业务', '提取业务', '查询业务', '其他业务']
            },
            yAxis: {
                type: 'value',
                name: '次数（万次/月）'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            series: [
                {
                    name: '浏览次数（万次/月）',
                    type: 'bar',
                    data: [
                        { value: 28, itemId: 'loan_view', name: '贷款业务' },
                        { value: 25, itemId: 'deposit_view', name: '缴存业务' },
                        { value: 18, itemId: 'withdraw_view', name: '提取业务' },
                        { value: 12, itemId: 'query_view', name: '查询业务' },
                        { value: 8, itemId: 'other_view', name: '其他业务' }
                    ],
                    itemStyle: {
                        color: '#1890ff'
                    }
                },
                {
                    name: '咨询次数（万次/月）',
                    type: 'bar',
                    data: [
                        { value: 32, itemId: 'loan_consult', name: '贷款业务' },
                        { value: 28, itemId: 'deposit_consult', name: '缴存业务' },
                        { value: 14, itemId: 'withdraw_consult', name: '提取业务' },
                        { value: 10, itemId: 'query_consult', name: '查询业务' },
                        { value: 6, itemId: 'other_consult', name: '其他业务' }
                    ],
                    itemStyle: {
                        color: '#52c41a'
                    }
                },
                {
                    name: '办理次数（万次/月）',
                    type: 'bar',
                    data: [
                        { value: 30, itemId: 'loan_process', name: '贷款业务' },
                        { value: 30, itemId: 'deposit_process', name: '缴存业务' },
                        { value: 8, itemId: 'withdraw_process', name: '提取业务' },
                        { value: 5, itemId: 'query_process', name: '查询业务' },
                        { value: 3, itemId: 'other_process', name: '其他业务' }
                    ],
                    itemStyle: {
                        color: '#faad14'
                    }
                }
            ]
        }
    });
});

// ==========================================
// 二级钻取 API（第二层清册）
// ==========================================

// 客户风险明细（第二层清册）
router.post('/customer-risk-detail-post', (req, res) => {
    const { customerId, customerName, page, perPage } = req.body;

    console.log(`[二级钻取] 查询客户风险明细: customerId=${customerId}, customerName=${customerName}, page=${page}, perPage=${perPage}`);

    // 模拟不同客户的风险明细数据
    const riskDetailsData = {
        'C001': [
            {
                id: 'R001',
                risk_type: '逾期未缴存',
                risk_description: '连续3个月未按时缴存公积金，可能存在经营困难',
                occur_date: '2024-01-15',
                severity: 3,
                status: 'pending'
            },
            {
                id: 'R002',
                risk_type: '缴存基数异常',
                risk_description: '缴存基数突然下降50%，需核实企业经营状况',
                occur_date: '2024-02-10',
                severity: 2,
                status: 'processing'
            },
            {
                id: 'R003',
                risk_type: '贷后断缴',
                risk_description: '贷款发放后次月立即停缴，存在骗贷风险',
                occur_date: '2024-03-05',
                severity: 3,
                status: 'resolved'
            },
            {
                id: 'R004',
                risk_type: '人员异动',
                risk_description: '核心员工大量流失，缴存人数从50降至15人',
                occur_date: '2024-03-20',
                severity: 2,
                status: 'pending'
            }
        ],
        'C002': [
            {
                id: 'R005',
                risk_type: '补缴异常',
                risk_description: '大额补缴后立即申请贷款，疑似虚构缴存记录',
                occur_date: '2024-01-20',
                severity: 2,
                status: 'processing'
            },
            {
                id: 'R006',
                risk_type: '贷款逾期',
                risk_description: '公积金贷款已逾期3个月未还',
                occur_date: '2024-04-01',
                severity: 3,
                status: 'pending'
            }
        ],
        'C003': [
            {
                id: 'R007',
                risk_type: '缴存波动',
                risk_description: '缴存金额波动较大，建议关注经营稳定性',
                occur_date: '2024-02-15',
                severity: 1,
                status: 'resolved'
            }
        ]
    };

    const riskDetails = riskDetailsData[customerId] || [
        {
            id: 'R999',
            risk_type: '暂无风险',
            risk_description: '该客户暂无风险记录',
            occur_date: new Date().toISOString().split('T')[0],
            severity: 1,
            status: 'resolved'
        }
    ];

    // 应用分页
    const result = paginate(riskDetails, page, perPage);

    res.json({
        status: 0,
        data: result
    });
});

// 客户风险报告（第二层 - 展示型）
router.post('/customer-risk-report-post', (req, res) => {
    const { customerId } = req.body;

    console.log(`[二级钻取] 生成客户风险报告: customerId=${customerId}`);

    const reports = {
        'C001': {
            report_content: `
<div style="padding: 20px;">
    <h4>风险综合评估</h4>
    <p><strong>客户编号：</strong>C001</p>
    <p><strong>风险等级：</strong><span style="color: #d9534f; font-weight: bold;">高风险</span></p>
    <p><strong>风险评分：</strong>85分</p>
    
    <h5 style="margin-top: 20px;">主要风险点：</h5>
    <ul>
        <li>连续3个月逾期缴存，缴存合规性差</li>
        <li>贷后立即断缴，存在骗贷嫌疑</li>
        <li>缴存基数大幅下降，经营状况堪忧</li>
        <li>核心员工流失严重，企业稳定性不足</li>
    </ul>
    
    <h5 style="margin-top: 20px;">处理建议：</h5>
    <ol>
        <li>立即联系客户核实经营情况</li>
        <li>暂停新增贷款审批</li>
        <li>启动风险应急处置流程</li>
        <li>加强贷后跟踪监控</li>
    </ol>
    
    <p style="margin-top: 20px; color: #666;">
        <small>报告生成时间：${new Date().toLocaleString('zh-CN')}</small>
    </p>
</div>
            `
        },
        'C002': {
            report_content: `
<div style="padding: 20px;">
    <h4>风险综合评估</h4>
    <p><strong>客户编号：</strong>C002</p>
    <p><strong>风险等级：</strong><span style="color: #f0ad4e; font-weight: bold;">中风险</span></p>
    <p><strong>风险评分：</strong>65分</p>
    
    <h5 style="margin-top: 20px;">主要风险点：</h5>
    <ul>
        <li>存在贷款逾期记录</li>
        <li>补缴行为异常，需进一步核实</li>
    </ul>
    
    <h5 style="margin-top: 20px;">处理建议：</h5>
    <ol>
        <li>加强催收力度</li>
        <li>核实补缴记录真实性</li>
        <li>限制新增贷款额度</li>
    </ol>
</div>
            `
        },
        'C003': {
            report_content: `
<div style="padding: 20px;">
    <h4>风险综合评估</h4>
    <p><strong>客户编号：</strong>C003</p>
    <p><strong>风险等级：</strong><span style="color: #5cb85c; font-weight: bold;">低风险</span></p>
    <p><strong>风险评分：</strong>45分</p>
    
    <h5 style="margin-top: 20px;">主要风险点：</h5>
    <ul>
        <li>缴存金额轻微波动</li>
    </ul>
    
    <h5 style="margin-top: 20px;">处理建议：</h5>
    <ol>
        <li>保持常规监控</li>
        <li>可正常开展业务合作</li>
    </ol>
</div>
            `
        }
    };

    const report = reports[customerId] || {
        report_content: '<div style="padding: 20px;"><p>暂无报告数据</p></div>'
    };

    res.json({
        status: 0,
        data: report
    });
});

/**
 * 动态副标题接口
 * 供页面配置使用，返回动态生成的副标题
 */
router.post('/subtitle', (req, res) => {
    const params = req.body;

    // 获取当前时间
    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

    // 根据请求参数生成不同的副标题
    let subtitle = `基于大模型的政策模拟与预测平台 | 数据已更新至 ${dateStr}`;

    if (params.page_title) {
        subtitle = `${params.page_title} - ${subtitle}`;
    }

    res.json({
        status: 0,
        msg: 'success',
        data: {
            displayText: subtitle // 适配 AMIS 默认取值
        }
    });
});

/**
 * 动态统计指标接口
 */
router.post('/stats', (req, res) => {
    res.json({
        status: 0,
        msg: 'success',
        data: {
            groups: [
                {
                    title: "风险预警指标",
                    border_color: "red",
                    // columns 由前端配置控制，不在 API 中返回
                    items: [
                        { label: "公积金贷款逾期人数", value: "152", trend: "up", trend_value: "12%" },
                        { label: "异常提取频次", value: "89", trend: "up", trend_value: "5%" },
                        { label: "黑名单增加人数", value: "24", trend: "up", trend_value: "8%" },
                        { label: "封存账号占比", value: "15.2", unit: "%" },
                        { label: "风控预警总数", value: "265", trend_color: "red" }
                    ]
                },
                {
                    title: "标准预警指标",
                    border_color: "blue",
                    items: [
                        { label: "在职缴存人数", value: "125.4", unit: "万" },
                        { label: "本月新增缴存", value: "8.5", unit: "万" },
                        { label: "月平均缴存额", value: "1,250", unit: "元" },
                        { label: "年度缴存目标进度", value: "85", unit: "%" },
                        { label: "系统健康度", value: "99.9", unit: "%" }
                    ]
                },
                {
                    title: "租赁住房提取",
                    border_color: "blue",
                    items: [
                        { label: "本月租赁提取人次", value: "12,500" },
                        { label: "提取总额", value: "4,500", unit: "万" }
                    ]
                }
            ]
        }
    });
});

/**
 * POST 格式 - 获取下拉选项数据
 * 用于动态表单的 select 组件
 * 接收参数：type (选项类型), category (可选的分类参数)
 */
router.post('/select-options', (req, res) => {
    const { type, category, keyword } = req.body;

    console.log('[POST] 下拉选项请求:', { type, category, keyword });

    let options = [];

    switch (type) {
        case 'policy_type':
            // 政策类型选项
            options = [
                { label: '租房提取', value: 'rent' },
                { label: '购房提取', value: 'buy' },
                { label: '建房提取', value: 'build' },
                { label: '大修提取', value: 'repair' },
                { label: '还贷提取', value: 'repay' }
            ];
            break;

        case 'region':
            // 区域选项
            options = [
                { label: '全省', value: 'all' },
                { label: '市区', value: 'city' },
                { label: '郊区', value: 'suburb' },
                { label: '县域', value: 'county' }
            ];
            break;

        case 'house_type':
            // 房屋类型
            options = [
                { label: '新建商品房', value: 'new_commercial' },
                { label: '二手房', value: 'second_hand' },
                { label: '自建房', value: 'self_built' },
                { label: '拆迁安置房', value: 'relocation' }
            ];
            break;

        case 'risk_level':
            // 风险等级
            options = [
                { label: '极高风险', value: 'critical' },
                { label: '高风险', value: 'high' },
                { label: '中高风险', value: 'medium-high' },
                { label: '中风险', value: 'medium' },
                { label: '中低风险', value: 'medium-low' },
                { label: '低风险', value: 'low' },
                { label: '极低风险', value: 'minimal' },
                { label: '安全', value: 'safe' }
            ];
            break;

        case 'status':
            // 状态选项
            options = [
                { label: '待处理', value: 'pending' },
                { label: '处理中', value: 'processing' },
                { label: '已完成', value: 'completed' }
            ];
            break;

        case 'department':
            // 部门选项（模拟）
            options = [
                { label: '风险管理部', value: 'dept_risk' },
                { label: '贷款审批部', value: 'dept_loan' },
                { label: '稽查监督部', value: 'dept_audit' },
                { label: '归集管理部', value: 'dept_collection' }
            ];
            break;

        case 'city':
            // 城市选项
            options = [
                { label: '杭州市', value: 'hangzhou' },
                { label: '宁波市', value: 'ningbo' },
                { label: '温州市', value: 'wenzhou' },
                { label: '嘉兴市', value: 'jiaxing' },
                { label: '湖州市', value: 'huzhou' },
                { label: '绍兴市', value: 'shaoxing' }
            ];
            break;
        case 'heating_period':
            options = [
                { label: '按月', value: 'month', value2: '7.2' },
                { label: '按年', value: 'year', value2: '6.8' }
            ];
            break;

        default:
            return res.status(400).json({
                status: 400,
                msg: `未知的选项类型: ${type}`
            });
    }

    // 如果提供了关键词，进行过滤
    if (keyword) {
        options = options.filter(opt =>
            opt.label.includes(keyword) || opt.value.includes(keyword)
        );
    }

    res.json({
        status: 0,
        msg: 'success',
        data: {
            options: options
        }
    });
});

// ==================== 卡片组件测试数据 ====================

/**
 * 获取服务卡片数据
 * 仅返回纯数据，供前端 AMIS Card 组件渲染
 */
router.post('/cards', (req, res) => {
    // 定义4种渐变色
    const gradientColors = [
        'linear-gradient(135deg, #1890FF 0%, #096DD9 100%)', // 蓝色
        'linear-gradient(135deg, #52C41A 0%, #389E0D 100%)', // 绿色
        'linear-gradient(135deg, #FA8C16 0%, #D46B08 100%)', // 橙色
        'linear-gradient(135deg, #F5222D 0%, #CF1322 100%)'  // 红色
    ];

    // 基础卡片数据
    const baseCards = [
        {
            title: "商贷转组合贷提醒",
            desc: "根据最新贷款政策和客户信息，主动识别符合商业贷款转组合贷款条件的客户，并推送优化建议",
            icon: "fa fa-exchange",
            target_label: "目标群体：",
            target_value: "符合转贷人群（8,421人）",
            headerGradient: gradientColors[0],
            actions: [
                {
                    label: "查看明细",
                    level: "primary",
                    actionType: "dialog",
                    dialog_title: "商贷转组合贷客户清册",
                    api_url: "/api/demo/risk-list/high",
                    columns: [
                        { name: "customer_name", label: "客户姓名" },
                        { name: "risk_score", label: "评分" },
                        { name: "amount", label: "贷款金额" },
                        { name: "status", label: "状态" }
                    ]
                }
            ]
        },
        {
            title: "租房提取精准推送",
            desc: "基于客户租房备案信息和缴存记录，自动匹配符合租房提取条件的客户，提供便捷提取服务",
            icon: "fa fa-home",
            target_label: "目标群体：",
            target_value: "符合租房提取条件（5,623人）",
            headerGradient: gradientColors[1],
            actions: [
                {
                    label: "查看明细",
                    level: "primary",
                    actionType: "dialog"
                }
            ]
        },
        {
            title: "单位缴存扩面服务",
            desc: "监测企业用工数据，识别未缴存或部分缴存的单位，推动住房公积金制度扩面覆盖",
            icon: "fa fa-building",
            target_label: "目标群体：",
            target_value: "待扩面企业（1,234家）",
            headerGradient: gradientColors[2],
            actions: [
                {
                    label: "下载清册",
                    level: "info",
                    actionType: "download",
                    api: "/api/demo/export/companies"
                },
                {
                    label: "批量导入",
                    level: "primary",
                    actionType: "dialog",
                    dialog_title: "批量导入企业数据"
                }
            ]
        }
    ];

    // 扩展数据：复制一份以展示多行效果，并修改标题模拟不同服务
    const moreCards = baseCards.map((item, index) => ({
        ...item,
        title: item.title + " (二期)",
        icon: item.icon,
        target_value: item.target_value.replace(/(\d+)/, (m) => parseInt(m) + 100),
        headerGradient: gradientColors[(index + 3) % 4] // 使用不同的颜色
    }));

    // 合并数据
    const allCards = [...baseCards, ...moreCards];

    res.json({
        status: 0,
        msg: 'success',
        data: {
            items: allCards
        }
    });
});

// ==================== 主动服务卡片 API ====================

/**
 * POST 版本 - 获取目标群体数据
 * 根据 service_type 和 period 返回不同的目标群体统计
 */
router.post('/target', (req, res) => {
    const { service_type, period } = req.body;

    console.log('[POST] 目标群体数据请求:', { service_type, period });

    // 根据 service_type 和 period 返回不同的数据
    const targetData = {
        'loan_convert': {
            1: { base_count: 8421, label: '符合转贷人群' },
            2: { base_count: 108421, label: '符合转贷人群' }
        },
        'rent_extract': {
            1: { base_count: 5623, label: '符合租房提取条件' },
            2: { base_count: 105623, label: '符合租房提取条件' }
        },
        'unit_expand': {
            1: { base_count: 1234, label: '待扩面企业', unit: '家' },
            2: { base_count: 101234, label: '待扩面企业', unit: '家' }
        }
    };

    const periodNum = period || 1;
    const config = targetData[service_type]?.[periodNum];

    let data;
    if (config) {
        // Add random variation (-50 to +50)
        const randomOffset = Math.floor(Math.random() * 101) - 50;
        const count = Math.max(0, config.base_count + randomOffset);
        const unit = config.unit || '人';
        data = {
            target_value: `${config.label}（${count.toLocaleString()}${unit}）`,
            count: count
        };
    } else {
        data = {
            target_value: '暂无数据',
            count: 0
        };
    }

    res.json({
        status: 0,
        msg: 'success',
        data: data
    });
});

/**
 * POST 版本 - 获取用户列表（用于 CRUD 弹窗）
 * 根据 service_type 和 period 返回不同的用户数据
 */
router.post('/users', (req, res) => {
    // 1. 获取所有参数 (包括查询表单的 name, phone 和 api.data 里的 filter_status)
    const { service_type, period, page = 1, perPage = 10, name, phone, filter_status } = req.body;

    console.log('[POST] 用户列表请求 params:', { service_type, filter_status, page, perPage, name, phone });

    // 2. 生成更多模拟数据 (55条) 以便于测试分页
    const mockUsers = [];
    for (let i = 1; i <= 55; i++) {
        // 模拟两种状态分布
        const isProcessed = i % 3 === 0; // 1/3 是已办
        mockUsers.push({
            id: i,
            name: ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '卫十二'][i % 10] + (i > 10 ? i : ''),
            phone: `13${8 + (i % 9)}****${1000 + i}`,
            // 状态映射：pending (待办/待推送) / processed (已办/已推送)
            status: isProcessed ? 'processed' : 'pending',
            // 显示给用户的中文状态 (如果不使用 type: map)
            status_text: isProcessed ? '已办理' : '待处理',
            id_card: `310***${1000 + i}`,
            // 账户余额 (用于已办记录)
            account_balance: Math.floor(Math.random() * 100000) + 10000,
            amount: 50000 + i * 1000
        });
    }

    // 3. 过滤逻辑
    let items = mockUsers.map(user => ({
        ...user,
        service_type: service_type,
        period: period || 1,
        tag: service_type === 'loan_convert' ? '转贷' : '租房提取'
    }));

    // 按状态筛选 (pending/processed)
    if (filter_status) {
        items = items.filter(u => u.status === filter_status);
    }

    // 按姓名模糊查询
    if (name) {
        items = items.filter(u => u.name.includes(name));
    }

    // 按电话模糊查询
    if (phone) {
        items = items.filter(u => u.phone.includes(phone));
    }

    // 4. 获取总数
    const total = items.length;

    // 5. 手动分页
    const pageNum = parseInt(page, 10) || 1;
    const pageSize = parseInt(perPage, 10) || 10;
    const start = (pageNum - 1) * pageSize;
    const pagedItems = items.slice(start, start + pageSize);

    // 6. 返回 AMIS 标准结构
    res.json({
        status: 0,
        msg: 'success',
        data: {
            items: pagedItems,
            total: total
        }
    });
});

/**
 * POST 版本 - 获取企业列表（用于 CRUD 弹窗）
 */
router.post('/companies', (req, res) => {
    const { service_type, period, page, perPage } = req.body;

    console.log('[POST] 企业列表请求:', { service_type, period, page, perPage });

    // 模拟企业数据
    const mockCompanies = [
        { id: 1, company: '上海科技有限公司', employees: 156, status: '待跟进', contact: '张经理', phone: '021-1234****' },
        { id: 2, company: '杭州电商股份公司', employees: 89, status: '已联系', contact: '李总监', phone: '0571-5678****' },
        { id: 3, company: '南京制造集团', employees: 312, status: '待跟进', contact: '王主任', phone: '025-9012****' },
        { id: 4, company: '苏州贸易公司', employees: 67, status: '已开户', contact: '赵经理', phone: '0512-3456****' },
        { id: 5, company: '无锡科技园区', employees: 245, status: '待跟进', contact: '钱总', phone: '0510-7890****' },
        { id: 6, company: '常州新材料公司', employees: 178, status: '已联系', contact: '孙主管', phone: '0519-2345****' }
    ];

    // 根据 period 调整数据
    const items = mockCompanies.map(company => ({
        ...company,
        service_type: service_type,
        period: period || 1
    }));

    // 应用分页
    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
    });
});

// ==================== 信用评价指标管理 API ====================

// 信用评价指标模拟数据
let creditIndicators = [
    // 缴存单位评价指标
    {
        id: 1,
        subject: "缴存单位",
        name: "缴存单位未按时缴存，有连续欠缴记录",
        description: "指缴存单位未能按时缴存公积金，存在连续欠缴的情况",
        weight: 15,
        elementName: "欠缴月数",
        elementDesc: "连续欠缴公积金的月数",
        elementValue: 3,
        status: "开启"
    },
    {
        id: 2,
        subject: "缴存单位",
        name: "缴存单位缴存人数骤减",
        description: "单位在短期内缴存人数大幅减少，可能反映经营异常或裁员情况",
        weight: 12,
        elementName: "减少比例",
        elementDesc: "缴存人数减少的百分比",
        elementValue: 30,
        status: "开启"
    },
    {
        id: 3,
        subject: "缴存单位",
        name: "缴存单位提供信息缺失或与工商注册信息不符",
        description: "单位提供的信息不完整或与工商注册信息存在不一致",
        weight: 10,
        elementName: "信息不一致项",
        elementDesc: "信息不一致的项目数量",
        elementValue: 2,
        status: "开启"
    },
    {
        id: 4,
        subject: "缴存单位",
        name: "缴存单位电子稽查检查不通过",
        description: "单位在电子稽查检查中存在不通过的项目",
        weight: 8,
        elementName: "检查不通过项",
        elementDesc: "电子稽查检查不通过的项目数",
        elementValue: 2,
        status: "开启"
    },
    {
        id: 5,
        subject: "缴存单位",
        name: "缴存单位贷款逾期职工占比异常",
        description: "单位中贷款逾期的职工比例异常不合规",
        weight: 15,
        elementName: "逾期职工占比",
        elementDesc: "贷款逾期职工占总职工的百分比",
        elementValue: 33,
        status: "开启"
    },
    {
        id: 6,
        subject: "缴存单位",
        name: "缴存单位未遵守信用承诺制度，被纳入系统一般失信联合惩戒名单",
        description: "单位因未遵守信用承诺制度被纳入一般失信名单",
        weight: 20,
        elementName: "一般失信",
        elementDesc: "是否被纳入一般失信名单",
        elementValue: 1,
        status: "开启"
    },
    {
        id: 7,
        subject: "缴存单位",
        name: "缴存单位未遵守信用承诺制度，被纳入系统严重失信联合惩戒名单",
        description: "单位因未遵守信用承诺制度被纳入严重失信名单",
        weight: 25,
        elementName: "严重失信",
        elementDesc: "是否被纳入严重失信名单",
        elementValue: 1,
        status: "开启"
    },
    {
        id: 8,
        subject: "缴存单位",
        name: "缴存单位存在缴存职工缴存基数违规",
        description: "单位存在缴存职工缴存基数违规的情况",
        weight: 5,
        elementName: "违规职工占比",
        elementDesc: "缴存基数违规职工占总职工的百分比",
        elementValue: 2,
        status: "开启"
    },
    // 缴存人评价指标
    {
        id: 9,
        subject: "缴存人",
        name: "缴存人提供信息缺失或与民政公安等信息不符",
        description: "缴存人提供的信息不完整或与民政公安等信息不一致",
        weight: 10,
        elementName: "信息缺失项",
        elementDesc: "信息缺失或不一致的项目数",
        elementValue: 3,
        status: "开启"
    },
    {
        id: 10,
        subject: "缴存人",
        name: "缴存人公积金贷后断缴",
        description: "缴存人在使用公积金贷款后停止缴存公积金",
        weight: 20,
        elementName: "连续断缴月数",
        elementDesc: "贷后连续断缴公积金的月数",
        elementValue: 3,
        status: "开启"
    },
    {
        id: 11,
        subject: "缴存人",
        name: "缴存人公积金贷款已逾期",
        description: "缴存人的公积金贷款存在逾期情况",
        weight: 25,
        elementName: "逾期月数",
        elementDesc: "公积金贷款逾期的月数",
        elementValue: 1,
        status: "开启"
    },
    {
        id: 12,
        subject: "缴存人",
        name: "缴存人未遵守信用承诺制度，被纳入系统一般失信联合惩戒名单",
        description: "缴存人因未遵守信用承诺制度被纳入一般失信名单",
        weight: 15,
        elementName: "一般失信",
        elementDesc: "是否被纳入一般失信名单",
        elementValue: 1,
        status: "开启"
    },
    {
        id: 13,
        subject: "缴存人",
        name: "缴存人未遵守信用承诺制度，被纳入系统严重失信联合惩戒名单",
        description: "缴存人因未遵守信用承诺制度被纳入严重失信名单",
        weight: 20,
        elementName: "严重失信",
        elementDesc: "是否被纳入严重失信名单",
        elementValue: 1,
        status: "开启"
    },
    {
        id: 14,
        subject: "缴存人",
        name: "缴存人账户状态已冻结",
        description: "缴存人的公积金账户处于冻结状态",
        weight: 10,
        elementName: "缴存人当前状态",
        elementDesc: "账户是否处于冻结状态",
        elementValue: 1,
        status: "开启"
    },
    // 开发商评价指标
    {
        id: 15,
        subject: "开发商",
        name: "开发商未遵守信用承诺制度，被纳入系统一般失信联合惩戒名单",
        description: "开发商因未遵守信用承诺制度被纳入一般失信名单",
        weight: 30,
        elementName: "一般失信",
        elementDesc: "是否被纳入一般失信名单",
        elementValue: 1,
        status: "开启"
    },
    {
        id: 16,
        subject: "开发商",
        name: "开发商未遵守信用承诺制度，被纳入系统严重失信联合惩戒名单",
        description: "开发商因未遵守信用承诺制度被纳入严重失信名单",
        weight: 40,
        elementName: "严重失信",
        elementDesc: "是否被纳入严重失信名单",
        elementValue: 1,
        status: "开启"
    },
    {
        id: 17,
        subject: "开发商",
        name: "开发商提供信息缺失或与工商注册信息不符",
        description: "开发商提供的信息不完整或与工商注册信息不一致",
        weight: 30,
        elementName: "信息缺失项",
        elementDesc: "信息缺失或不一致的项目数",
        elementValue: 3,
        status: "开启"
    }
];

// 自增ID计数器
let creditIndicatorIdCounter = 18;

/**
 * POST - 查询信用评价指标列表
 * 支持筛选和分页
 */
router.post('/credit/indicators/list', (req, res) => {
    const { subject, status, page = 1, perPage = 10 } = req.body;

    console.log('[POST] 信用评价指标列表请求:', { subject, status, page, perPage });

    let items = [...creditIndicators];

    // 主体类型筛选
    if (subject && subject !== '' && subject !== '全部') {
        items = items.filter(item => item.subject === subject);
    }

    // 启用状态筛选
    if (status && status !== '' && status !== '全部') {
        items = items.filter(item => item.status === status);
    }

    // 应用分页
    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
    });
});

/**
 * POST - 新增信用评价指标
 */
router.post('/credit/indicators/create', (req, res) => {
    const { subject, name, description, weight, elementName, elementDesc, elementValue, status } = req.body;

    console.log('[POST] 新增信用评价指标:', req.body);

    // 参数校验
    if (!subject || !name || !weight || !elementName || !elementDesc || elementValue === undefined) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必要参数：subject, name, weight, elementName, elementDesc, elementValue'
        });
    }

    // 创建新指标
    const newIndicator = {
        id: creditIndicatorIdCounter++,
        subject,
        name,
        description: description || '',
        weight: parseInt(weight),
        elementName,
        elementDesc,
        elementValue: parseFloat(elementValue),
        status: status === true || status === '开启' ? '开启' : '关闭'
    };

    creditIndicators.push(newIndicator);

    res.json({
        status: 0,
        msg: '新增成功',
        data: {
            id: newIndicator.id
        }
    });
});

/**
 * POST - 更新信用评价指标
 */
router.post('/credit/indicators/update', (req, res) => {
    const { id, subject, name, description, weight, elementName, elementDesc, elementValue, status } = req.body;

    console.log('[POST] 更新信用评价指标:', req.body);

    // 参数校验
    if (!id) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必要参数：id'
        });
    }

    // 查找指标
    const index = creditIndicators.findIndex(item => item.id === parseInt(id));

    if (index === -1) {
        return res.status(404).json({
            status: 404,
            msg: '指标不存在'
        });
    }

    // 更新指标
    creditIndicators[index] = {
        ...creditIndicators[index],
        subject: subject !== undefined ? subject : creditIndicators[index].subject,
        name: name !== undefined ? name : creditIndicators[index].name,
        description: description !== undefined ? description : creditIndicators[index].description,
        weight: weight !== undefined ? parseInt(weight) : creditIndicators[index].weight,
        elementName: elementName !== undefined ? elementName : creditIndicators[index].elementName,
        elementDesc: elementDesc !== undefined ? elementDesc : creditIndicators[index].elementDesc,
        elementValue: elementValue !== undefined ? parseFloat(elementValue) : creditIndicators[index].elementValue,
        status: status !== undefined ? (status === true || status === '开启' ? '开启' : '关闭') : creditIndicators[index].status
    };

    res.json({
        status: 0,
        msg: '更新成功'
    });
});

/**
 * POST - 删除信用评价指标
 */
router.post('/credit/indicators/delete', (req, res) => {
    const { id } = req.body;

    console.log('[POST] 删除信用评价指标:', { id });

    // 参数校验
    if (!id) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必要参数：id'
        });
    }

    // 查找指标
    const index = creditIndicators.findIndex(item => item.id === parseInt(id));

    if (index === -1) {
        return res.status(404).json({
            status: 404,
            msg: '指标不存在'
        });
    }

    // 删除指标
    creditIndicators.splice(index, 1);

    res.json({
        status: 0,
        msg: '删除成功'
    });
});

// ==================== 信用清册管理 API ====================

// 信用清册模拟数据
let creditRegistry = [
    // 缴存人
    {
        id: 1,
        subject: "缴存人",
        name: "罗伯特",
        idNumber: "42112619910530369X",
        score: 100,
        level: "A"
    },
    {
        id: 2,
        subject: "缴存人",
        name: "张三",
        idNumber: "320102199001011234",
        score: 85,
        level: "B"
    },
    {
        id: 3,
        subject: "缴存人",
        name: "李四",
        idNumber: "320102199202025678",
        score: 65,
        level: "C"
    },
    {
        id: 4,
        subject: "缴存人",
        name: "王五",
        idNumber: "320102199303039012",
        score: 45,
        level: "D"
    },
    // 缴存单位
    {
        id: 5,
        subject: "缴存单位",
        name: "神玥科技",
        idNumber: "TYSH9234202032",
        score: 100,
        level: "A"
    },
    {
        id: 6,
        subject: "缴存单位",
        name: "华为技术有限公司",
        idNumber: "TYSH1234567890",
        score: 95,
        level: "A"
    },
    {
        id: 7,
        subject: "缴存单位",
        name: "某餐饮连锁",
        idNumber: "TYSH2023001234",
        score: 60,
        level: "C"
    },
    {
        id: 8,
        subject: "缴存单位",
        name: "YY制造厂",
        idNumber: "DW2022112345",
        score: 40,
        level: "D"
    },
    // 开发商
    {
        id: 9,
        subject: "开发商",
        name: "天山工程",
        idNumber: "TYSH8398209090",
        score: 55,
        level: "D"
    },
    {
        id: 10,
        subject: "开发商",
        name: "万科地产",
        idNumber: "KF202001001",
        score: 92,
        level: "A"
    },
    {
        id: 11,
        subject: "开发商",
        name: "某置业公司",
        idNumber: "KF202001002",
        score: 48,
        level: "D"
    },
    {
        id: 12,
        subject: "开发商",
        name: "某地产集团",
        idNumber: "KF202015003",
        score: 68,
        level: "C"
    }
];

// 信用评价明细模拟数据（根据主体生成）
const creditDetailTemplates = {
    "缴存人": [
        { detailName: "信息完整性", weight: 10 },
        { detailName: "贷后缴存情况", weight: 20 },
        { detailName: "贷款还款情况", weight: 25 },
        { detailName: "信用承诺履行", weight: 15 },
        { detailName: "账户状态", weight: 10 },
        { detailName: "历史信用记录", weight: 20 }
    ],
    "缴存单位": [
        { detailName: "按时缴存情况", weight: 15 },
        { detailName: "缴存人数稳定性", weight: 12 },
        { detailName: "信息一致性", weight: 10 },
        { detailName: "稽查检查结果", weight: 8 },
        { detailName: "职工贷款逾期率", weight: 15 },
        { detailName: "信用承诺履行", weight: 20 },
        { detailName: "缴存基数合规性", weight: 5 },
        { detailName: "历史信用记录", weight: 15 }
    ],
    "开发商": [
        { detailName: "信用承诺履行（一般）", weight: 30 },
        { detailName: "信用承诺履行（严重）", weight: 40 },
        { detailName: "信息完整性", weight: 30 }
    ]
};

// 自增ID计数器
let creditRegistryIdCounter = 13;

/**
 * POST - 查询信用清册列表
 * 支持筛选和分页
 */
router.post('/credit/registry/list', (req, res) => {
    const { subject, level, page = 1, perPage = 10 } = req.body;

    console.log('[POST] 信用清册列表请求:', { subject, level, page, perPage });

    let items = [...creditRegistry];

    // 主体类型筛选
    if (subject && subject !== '' && subject !== '全部') {
        items = items.filter(item => item.subject === subject);
    }

    // 信用等级筛选
    if (level && level !== '' && level !== '全部') {
        items = items.filter(item => item.level === level);
    }

    // 应用分页
    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
    });
});

/**
 * POST - 新增信用主体
 */
router.post('/credit/registry/create', (req, res) => {
    const { subject, name, idNumber, score, level } = req.body;

    console.log('[POST] 新增信用主体:', req.body);

    // 参数校验
    if (!subject || !name || !idNumber) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必要参数：subject, name, idNumber'
        });
    }

    // 根据分数自动计算等级
    let calculatedLevel = level;
    if (!level && score !== undefined) {
        if (score >= 90) calculatedLevel = 'A';
        else if (score >= 70) calculatedLevel = 'B';
        else if (score >= 50) calculatedLevel = 'C';
        else calculatedLevel = 'D';
    }

    // 创建新主体
    const newRegistry = {
        id: creditRegistryIdCounter++,
        subject,
        name,
        idNumber,
        score: parseInt(score) || 100,
        level: calculatedLevel || 'A'
    };

    creditRegistry.push(newRegistry);

    res.json({
        status: 0,
        msg: '新增成功',
        data: {
            id: newRegistry.id
        }
    });
});

/**
 * POST - 更新信用主体
 */
router.post('/credit/registry/update', (req, res) => {
    const { id, subject, name, idNumber, score, level } = req.body;

    console.log('[POST] 更新信用主体:', req.body);

    // 参数校验
    if (!id) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必要参数：id'
        });
    }

    // 查找主体
    const index = creditRegistry.findIndex(item => item.id === parseInt(id));

    if (index === -1) {
        return res.status(404).json({
            status: 404,
            msg: '信用主体不存在'
        });
    }

    // 根据分数自动计算等级
    let calculatedLevel = level;
    if (score !== undefined && !level) {
        const scoreNum = parseInt(score);
        if (scoreNum >= 90) calculatedLevel = 'A';
        else if (scoreNum >= 70) calculatedLevel = 'B';
        else if (scoreNum >= 50) calculatedLevel = 'C';
        else calculatedLevel = 'D';
    }

    // 更新主体
    creditRegistry[index] = {
        ...creditRegistry[index],
        subject: subject !== undefined ? subject : creditRegistry[index].subject,
        name: name !== undefined ? name : creditRegistry[index].name,
        idNumber: idNumber !== undefined ? idNumber : creditRegistry[index].idNumber,
        score: score !== undefined ? parseInt(score) : creditRegistry[index].score,
        level: calculatedLevel !== undefined ? calculatedLevel : creditRegistry[index].level
    };

    res.json({
        status: 0,
        msg: '更新成功'
    });
});

/**
 * POST - 删除信用主体
 */
router.post('/credit/registry/delete', (req, res) => {
    const { id } = req.body;

    console.log('[POST] 删除信用主体:', { id });

    // 参数校验
    if (!id) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必要参数：id'
        });
    }

    // 查找主体
    const index = creditRegistry.findIndex(item => item.id === parseInt(id));

    if (index === -1) {
        return res.status(404).json({
            status: 404,
            msg: '信用主体不存在'
        });
    }

    // 删除主体
    creditRegistry.splice(index, 1);

    res.json({
        status: 0,
        msg: '删除成功'
    });
});

/**
 * POST - 获取信用评价明细
 */
router.post('/credit/registry/details', (req, res) => {
    const { id, detailName } = req.body;

    console.log('[POST] 查询信用评价明细:', { id, detailName });

    // 参数校验
    if (!id) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必要参数：id'
        });
    }

    // 查找主体
    const registry = creditRegistry.find(item => item.id === parseInt(id));

    if (!registry) {
        return res.status(404).json({
            status: 404,
            msg: '信用主体不存在'
        });
    }

    // 获取该主体类型的评价明细模板
    const templates = creditDetailTemplates[registry.subject] || [];

    // 根据主体分数生成各项明细得分
    const baseScore = registry.score;
    let details = templates.map((template, index) => {
        // 模拟各项得分（基于总分浮动）
        const variance = (Math.random() - 0.5) * 20;
        let detailScore = Math.min(100, Math.max(0, baseScore + variance));
        detailScore = Math.round(detailScore);

        return {
            id: index + 1,
            detailName: template.detailName,
            weight: template.weight,
            score: detailScore
        };
    });

    // 按明细名称筛选
    if (detailName && detailName !== '' && detailName !== '全部') {
        details = details.filter(item => item.detailName === detailName);
    }

    res.json({
        status: 0,
        msg: 'success',
        data: {
            registryInfo: {
                id: registry.id,
                subject: registry.subject,
                name: registry.name,
                idNumber: registry.idNumber,
                score: registry.score,
                level: registry.level
            },
            details: details,
            // 明细名称选项（用于筛选下拉框）
            detailOptions: templates.map(t => ({ label: t.detailName, value: t.detailName }))
        }
    });
});

// ==================== 风险监控 API ====================

// 风险监控数据
const riskDashboardData = {
    "缴存单位": {
        charts: {
            level: [
                { value: 1200, name: 'A (优秀)', itemStyle: { color: '#52c41a' } },
                { value: 800, name: 'B (良好)', itemStyle: { color: '#1890ff' } },
                { value: 300, name: 'C (一般)', itemStyle: { color: '#faad14' } },
                { value: 100, name: 'D (差)', itemStyle: { color: '#ff4d4f' } }
            ],
            behavior: {
                labels: ['连续欠缴', '缴存人数骤降', '信息不一致', '贷款逾期', '一般失信'],
                data: [120, 85, 45, 30, 20]
            },
            region: {
                labels: ['城关管理部', '七里河管理部', '西固管理部', '安宁管理部', '红古管理部'],
                data: [450, 320, 280, 210, 80]
            },
            trend: {
                dates: ['6/1', '6/3', '6/5', '6/7', '6/9', '6/11', '6/13'],
                high: [5, 4, 6, 8, 7, 9, 8],
                medium: [12, 15, 13, 16, 18, 15, 14]
            }
        },
        summary: {
            total: 2400,
            highRisk: 100,
            mediumRisk: 300,
            lowRisk: 2000
        }
    },
    "缴存人": {
        charts: {
            level: [
                { value: 6500, name: 'A (优秀)', itemStyle: { color: '#52c41a' } },
                { value: 2500, name: 'B (良好)', itemStyle: { color: '#1890ff' } },
                { value: 1000, name: 'C (一般)', itemStyle: { color: '#faad14' } },
                { value: 200, name: 'D (差)', itemStyle: { color: '#ff4d4f' } }
            ],
            behavior: {
                labels: ['信息不完善', '违规提取', '贷后停缴', '账户冻结', '贷款逾期'],
                data: [150, 80, 60, 45, 20]
            },
            region: {
                labels: ['城关管理部', '七里河管理部', '西固管理部', '安宁管理部', '新华管理部'],
                data: [60, 50, 40, 30, 20]
            },
            trend: {
                dates: ['6/1', '6/3', '6/5', '6/7', '6/9', '6/11', '6/13'],
                high: [10, 12, 11, 15, 14, 18, 16],
                medium: [25, 28, 26, 30, 32, 35, 33]
            }
        },
        summary: {
            total: 10200,
            highRisk: 200,
            mediumRisk: 1000,
            lowRisk: 9000
        }
    },
    "开发商": {
        charts: {
            level: [
                { value: 150, name: 'A (优秀)', itemStyle: { color: '#52c41a' } },
                { value: 60, name: 'B (良好)', itemStyle: { color: '#1890ff' } },
                { value: 20, name: 'C (一般)', itemStyle: { color: '#faad14' } },
                { value: 12, name: 'D (差)', itemStyle: { color: '#ff4d4f' } }
            ],
            behavior: {
                labels: ['楼盘停工', '协助违规', '捂盘惜售', '资金异常', '延期交房'],
                data: [8, 5, 4, 3, 2]
            },
            region: {
                labels: ['城关区', '七里河区', '安宁区', '西固区', '红古区'],
                data: [5, 3, 2, 1, 1]
            },
            trend: {
                dates: ['6/1', '6/3', '6/5', '6/7', '6/9', '6/11', '6/13'],
                high: [1, 1, 1, 2, 2, 2, 2],
                medium: [3, 3, 4, 4, 5, 4, 4]
            }
        },
        summary: {
            total: 242,
            highRisk: 12,
            mediumRisk: 20,
            lowRisk: 210
        }
    }
};

/**
 * POST - 获取风险监控看板数据
 * 返回 ECharts 图表配置，饼图和柱状图支持钻取
 */
router.post('/credit/risk/dashboard', (req, res) => {
    const { subject = '缴存单位' } = req.body;

    console.log('[POST] 风险监控看板请求:', { subject });

    const data = riskDashboardData[subject] || riskDashboardData['缴存单位'];

    // 为饼图数据添加 itemId
    const levelChartData = data.charts.level.map(item => ({
        ...item,
        itemId: item.name.charAt(0) // A, B, C, D
    }));

    // 为风险行为柱状图添加 itemId
    const behaviorChartData = data.charts.behavior.data.map((val, idx) => ({
        value: val,
        name: data.charts.behavior.labels[idx],
        itemId: data.charts.behavior.labels[idx]
    }));

    // 为区域柱状图添加 itemId
    const regionChartData = data.charts.region.data.map((val, idx) => ({
        value: val,
        name: data.charts.region.labels[idx],
        itemId: data.charts.region.labels[idx]
    }));

    res.json({
        status: 0,
        msg: 'success',
        data: {
            subject,
            summary: data.summary,
            // 信用级别分布饼图（支持钻取）
            levelChart: {
                tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                legend: { orient: 'vertical', left: 'left' },
                series: [{
                    name: '信用级别',
                    type: 'pie',
                    radius: '60%',
                    data: levelChartData
                }]
            },
            // 风险行为分布柱状图（支持钻取）
            behaviorChart: {
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: data.charts.behavior.labels },
                yAxis: { type: 'value' },
                series: [{
                    name: '风险数量',
                    type: 'bar',
                    data: behaviorChartData,
                    itemStyle: { color: '#ff4d4f', borderRadius: [4, 4, 0, 0] }
                }]
            },
            // 区域风险分布柱状图（支持钻取）
            regionChart: {
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: data.charts.region.labels },
                yAxis: { type: 'value' },
                series: [{
                    name: '风险主体数',
                    type: 'bar',
                    data: regionChartData,
                    itemStyle: { color: '#1890ff', borderRadius: [4, 4, 0, 0] }
                }]
            },
            // 风险趋势折线图（不支持钻取）
            trendChart: {
                tooltip: { trigger: 'axis' },
                legend: { data: ['高风险', '中风险'] },
                xAxis: { type: 'category', data: data.charts.trend.dates },
                yAxis: { type: 'value' },
                series: [
                    { name: '高风险', type: 'line', data: data.charts.trend.high, itemStyle: { color: '#ff4d4f' } },
                    { name: '中风险', type: 'line', data: data.charts.trend.medium, itemStyle: { color: '#faad14' } }
                ]
            }
        }
    });
});

/**
 * POST - 获取信用级别分布饼图配置
 */
router.post('/credit/risk/chart/level', (req, res) => {
    const { subject = '缴存单位' } = req.body;

    console.log('[POST] 信用级别分布图表请求:', { subject });

    const data = riskDashboardData[subject] || riskDashboardData['缴存单位'];

    // 为饼图数据添加 itemId
    const levelChartData = data.charts.level.map(item => ({
        ...item,
        itemId: item.name.charAt(0)
    }));

    res.json({
        status: 0,
        msg: 'success',
        data: {
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: { orient: 'vertical', left: 'left' },
            series: [{
                name: '信用级别',
                type: 'pie',
                radius: '60%',
                data: levelChartData
            }]
        }
    });
});

/**
 * POST - 获取风险行为分布柱状图配置
 */
router.post('/credit/risk/chart/behavior', (req, res) => {
    const { subject = '缴存单位' } = req.body;

    console.log('[POST] 风险行为分布图表请求:', { subject });

    const data = riskDashboardData[subject] || riskDashboardData['缴存单位'];

    // 为柱状图添加 itemId
    const behaviorChartData = data.charts.behavior.data.map((val, idx) => ({
        value: val,
        name: data.charts.behavior.labels[idx],
        itemId: data.charts.behavior.labels[idx]
    }));

    res.json({
        status: 0,
        msg: 'success',
        data: {
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: data.charts.behavior.labels },
            yAxis: { type: 'value' },
            series: [{
                name: '风险数量',
                type: 'bar',
                data: behaviorChartData,
                itemStyle: { color: '#ff4d4f', borderRadius: [4, 4, 0, 0] }
            }]
        }
    });
});

/**
 * POST - 获取区域风险分布柱状图配置
 */
router.post('/credit/risk/chart/region', (req, res) => {
    const { subject = '缴存单位' } = req.body;

    console.log('[POST] 区域风险分布图表请求:', { subject });

    const data = riskDashboardData[subject] || riskDashboardData['缴存单位'];

    // 为柱状图添加 itemId
    const regionChartData = data.charts.region.data.map((val, idx) => ({
        value: val,
        name: data.charts.region.labels[idx],
        itemId: data.charts.region.labels[idx]
    }));

    res.json({
        status: 0,
        msg: 'success',
        data: {
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: data.charts.region.labels },
            yAxis: { type: 'value' },
            series: [{
                name: '风险主体数',
                type: 'bar',
                data: regionChartData,
                itemStyle: { color: '#1890ff', borderRadius: [4, 4, 0, 0] }
            }]
        }
    });
});

/**
 * POST - 获取风险趋势折线图配置
 */
router.post('/credit/risk/chart/trend', (req, res) => {
    const { subject = '缴存单位' } = req.body;

    console.log('[POST] 风险趋势图表请求:', { subject });

    const data = riskDashboardData[subject] || riskDashboardData['缴存单位'];

    res.json({
        status: 0,
        msg: 'success',
        data: {
            tooltip: { trigger: 'axis' },
            legend: { data: ['高风险', '中风险'] },
            xAxis: { type: 'category', data: data.charts.trend.dates },
            yAxis: { type: 'value' },
            series: [
                { name: '高风险', type: 'line', data: data.charts.trend.high, itemStyle: { color: '#ff4d4f' } },
                { name: '中风险', type: 'line', data: data.charts.trend.medium, itemStyle: { color: '#faad14' } }
            ]
        }
    });
});

// 钻取数据：按信用等级的主体列表（扩充数据用于分页测试）
const drilldownByLevel = {
    "缴存单位": {
        "A": [
            { id: 1, name: "华为技术有限公司", idNumber: "TYSH1234567890", score: 95, riskBehavior: "无" },
            { id: 2, name: "神玥科技", idNumber: "TYSH9234202032", score: 100, riskBehavior: "无" },
            { id: 3, name: "阿里巴巴集团", idNumber: "TYSH5678901234", score: 92, riskBehavior: "无" },
            { id: 101, name: "腾讯科技", idNumber: "TYSH1001001001", score: 98, riskBehavior: "无" },
            { id: 102, name: "百度网络", idNumber: "TYSH1001001002", score: 94, riskBehavior: "无" },
            { id: 103, name: "京东集团", idNumber: "TYSH1001001003", score: 93, riskBehavior: "无" },
            { id: 104, name: "美团科技", idNumber: "TYSH1001001004", score: 91, riskBehavior: "无" },
            { id: 105, name: "字节跳动", idNumber: "TYSH1001001005", score: 97, riskBehavior: "无" },
            { id: 106, name: "小米科技", idNumber: "TYSH1001001006", score: 90, riskBehavior: "无" },
            { id: 107, name: "网易公司", idNumber: "TYSH1001001007", score: 92, riskBehavior: "无" },
            { id: 108, name: "滴滴出行", idNumber: "TYSH1001001008", score: 91, riskBehavior: "无" },
            { id: 109, name: "拼多多", idNumber: "TYSH1001001009", score: 93, riskBehavior: "无" },
            { id: 110, name: "携程旅行", idNumber: "TYSH1001001010", score: 90, riskBehavior: "无" },
            { id: 111, name: "顺丰速运", idNumber: "TYSH1001001011", score: 94, riskBehavior: "无" },
            { id: 112, name: "中兴通讯", idNumber: "TYSH1001001012", score: 92, riskBehavior: "无" }
        ],
        "B": [
            { id: 4, name: "某科技公司", idNumber: "TYSH2345678901", score: 78, riskBehavior: "信息不一致" },
            { id: 5, name: "某贸易公司", idNumber: "TYSH3456789012", score: 72, riskBehavior: "无" },
            { id: 201, name: "恒大集团", idNumber: "TYSH2001001001", score: 75, riskBehavior: "无" },
            { id: 202, name: "万达商业", idNumber: "TYSH2001001002", score: 79, riskBehavior: "无" },
            { id: 203, name: "融创中国", idNumber: "TYSH2001001003", score: 73, riskBehavior: "无" },
            { id: 204, name: "绿地控股", idNumber: "TYSH2001001004", score: 76, riskBehavior: "无" },
            { id: 205, name: "中海地产", idNumber: "TYSH2001001005", score: 77, riskBehavior: "无" },
            { id: 206, name: "龙湖集团", idNumber: "TYSH2001001006", score: 74, riskBehavior: "无" },
            { id: 207, name: "新城控股", idNumber: "TYSH2001001007", score: 71, riskBehavior: "无" },
            { id: 208, name: "世茂集团", idNumber: "TYSH2001001008", score: 78, riskBehavior: "无" },
            { id: 209, name: "金地集团", idNumber: "TYSH2001001009", score: 75, riskBehavior: "无" },
            { id: 210, name: "招商蛇口", idNumber: "TYSH2001001010", score: 79, riskBehavior: "无" },
            { id: 211, name: "华润置地", idNumber: "TYSH2001001011", score: 76, riskBehavior: "无" },
            { id: 212, name: "旭辉控股", idNumber: "TYSH2001001012", score: 72, riskBehavior: "无" }
        ],
        "C": [
            { id: 6, name: "某餐饮连锁", idNumber: "TYSH2023001234", score: 60, riskBehavior: "连续欠缴" },
            { id: 7, name: "某物流公司", idNumber: "TYSH4567890123", score: 55, riskBehavior: "缴存人数骤降" },
            { id: 301, name: "鑫源建材", idNumber: "TYSH3001001001", score: 58, riskBehavior: "连续欠缴" },
            { id: 302, name: "宏达机械", idNumber: "TYSH3001001002", score: 62, riskBehavior: "信息不一致" },
            { id: 303, name: "永盛纺织", idNumber: "TYSH3001001003", score: 56, riskBehavior: "缴存人数骤降" },
            { id: 304, name: "利华化工", idNumber: "TYSH3001001004", score: 59, riskBehavior: "连续欠缴" },
            { id: 305, name: "金鹏物流", idNumber: "TYSH3001001005", score: 61, riskBehavior: "信息不一致" },
            { id: 306, name: "瑞丰食品", idNumber: "TYSH3001001006", score: 57, riskBehavior: "缴存人数骤降" },
            { id: 307, name: "恒通电子", idNumber: "TYSH3001001007", score: 63, riskBehavior: "连续欠缴" },
            { id: 308, name: "盛达贸易", idNumber: "TYSH3001001008", score: 54, riskBehavior: "一般失信" },
            { id: 309, name: "华美装饰", idNumber: "TYSH3001001009", score: 60, riskBehavior: "信息不一致" },
            { id: 310, name: "天成印刷", idNumber: "TYSH3001001010", score: 58, riskBehavior: "连续欠缴" },
            { id: 311, name: "博远科技", idNumber: "TYSH3001001011", score: 55, riskBehavior: "缴存人数骤降" },
            { id: 312, name: "嘉禾农业", idNumber: "TYSH3001001012", score: 62, riskBehavior: "信息不一致" }
        ],
        "D": [
            { id: 8, name: "YY制造厂", idNumber: "DW2022112345", score: 40, riskBehavior: "连续欠缴+缴存人数骤降" },
            { id: 9, name: "某建材公司", idNumber: "TYSH6789012345", score: 35, riskBehavior: "一般失信" },
            { id: 401, name: "鸿运建筑", idNumber: "TYSH4001001001", score: 38, riskBehavior: "连续欠缴+一般失信" },
            { id: 402, name: "金龙机电", idNumber: "TYSH4001001002", score: 42, riskBehavior: "缴存人数骤降" },
            { id: 403, name: "华信贸易", idNumber: "TYSH4001001003", score: 36, riskBehavior: "严重失信" },
            { id: 404, name: "盛世地产", idNumber: "TYSH4001001004", score: 44, riskBehavior: "连续欠缴" },
            { id: 405, name: "远东物流", idNumber: "TYSH4001001005", score: 39, riskBehavior: "一般失信" },
            { id: 406, name: "天宇科技", idNumber: "TYSH4001001006", score: 41, riskBehavior: "缴存人数骤降" },
            { id: 407, name: "鼎盛实业", idNumber: "TYSH4001001007", score: 37, riskBehavior: "严重失信" },
            { id: 408, name: "汇通商贸", idNumber: "TYSH4001001008", score: 43, riskBehavior: "连续欠缴" },
            { id: 409, name: "瑞祥建材", idNumber: "TYSH4001001009", score: 34, riskBehavior: "连续欠缴+一般失信" },
            { id: 410, name: "恒基工程", idNumber: "TYSH4001001010", score: 40, riskBehavior: "缴存人数骤降" },
            { id: 411, name: "金泰纺织", idNumber: "TYSH4001001011", score: 38, riskBehavior: "一般失信" },
            { id: 412, name: "宏图电子", idNumber: "TYSH4001001012", score: 45, riskBehavior: "信息不一致" }
        ]
    },
    "缴存人": {
        "A": [
            { id: 10, name: "罗伯特", idNumber: "42112619910530369X", score: 100, riskBehavior: "无" },
            { id: 11, name: "李明", idNumber: "320102199001011234", score: 95, riskBehavior: "无" },
            { id: 501, name: "张伟", idNumber: "320102199101011001", score: 98, riskBehavior: "无" },
            { id: 502, name: "王芳", idNumber: "320102199201011002", score: 96, riskBehavior: "无" },
            { id: 503, name: "刘洋", idNumber: "320102199301011003", score: 94, riskBehavior: "无" },
            { id: 504, name: "陈静", idNumber: "320102199401011004", score: 97, riskBehavior: "无" },
            { id: 505, name: "杨磊", idNumber: "320102199501011005", score: 93, riskBehavior: "无" },
            { id: 506, name: "赵敏", idNumber: "320102199601011006", score: 95, riskBehavior: "无" },
            { id: 507, name: "黄强", idNumber: "320102199701011007", score: 92, riskBehavior: "无" },
            { id: 508, name: "周婷", idNumber: "320102199801011008", score: 96, riskBehavior: "无" },
            { id: 509, name: "吴刚", idNumber: "320102199901011009", score: 91, riskBehavior: "无" },
            { id: 510, name: "郑丽", idNumber: "320102200001011010", score: 94, riskBehavior: "无" }
        ],
        "B": [
            { id: 12, name: "张三", idNumber: "320102199202025678", score: 85, riskBehavior: "无" },
            { id: 13, name: "王芳", idNumber: "320102199303039012", score: 75, riskBehavior: "信息不完善" },
            { id: 601, name: "李华", idNumber: "320102199102021001", score: 82, riskBehavior: "无" },
            { id: 602, name: "孙涛", idNumber: "320102199202021002", score: 78, riskBehavior: "无" },
            { id: 603, name: "钱芳", idNumber: "320102199302021003", score: 76, riskBehavior: "信息不完善" },
            { id: 604, name: "周明", idNumber: "320102199402021004", score: 84, riskBehavior: "无" },
            { id: 605, name: "吴静", idNumber: "320102199502021005", score: 79, riskBehavior: "无" },
            { id: 606, name: "郑强", idNumber: "320102199602021006", score: 77, riskBehavior: "信息不完善" },
            { id: 607, name: "王磊", idNumber: "320102199702021007", score: 81, riskBehavior: "无" },
            { id: 608, name: "陈婷", idNumber: "320102199802021008", score: 73, riskBehavior: "无" },
            { id: 609, name: "杨洋", idNumber: "320102199902021009", score: 80, riskBehavior: "无" },
            { id: 610, name: "赵丽", idNumber: "320102200002021010", score: 74, riskBehavior: "信息不完善" }
        ],
        "C": [
            { id: 14, name: "李四", idNumber: "320102199404045678", score: 65, riskBehavior: "贷后停缴" },
            { id: 15, name: "赵六", idNumber: "320102199505051234", score: 55, riskBehavior: "违规提取" },
            { id: 701, name: "刘伟", idNumber: "320102199103031001", score: 62, riskBehavior: "贷后停缴" },
            { id: 702, name: "张芳", idNumber: "320102199203031002", score: 58, riskBehavior: "违规提取" },
            { id: 703, name: "王涛", idNumber: "320102199303031003", score: 64, riskBehavior: "贷后停缴" },
            { id: 704, name: "李静", idNumber: "320102199403031004", score: 56, riskBehavior: "信息不完善" },
            { id: 705, name: "陈明", idNumber: "320102199503031005", score: 61, riskBehavior: "贷后停缴" },
            { id: 706, name: "杨强", idNumber: "320102199603031006", score: 59, riskBehavior: "违规提取" },
            { id: 707, name: "赵磊", idNumber: "320102199703031007", score: 63, riskBehavior: "贷后停缴" },
            { id: 708, name: "黄婷", idNumber: "320102199803031008", score: 57, riskBehavior: "信息不完善" },
            { id: 709, name: "周洋", idNumber: "320102199903031009", score: 60, riskBehavior: "贷后停缴" },
            { id: 710, name: "吴丽", idNumber: "320102200003031010", score: 54, riskBehavior: "违规提取" }
        ],
        "D": [
            { id: 16, name: "王五", idNumber: "320102199606067890", score: 45, riskBehavior: "贷款逾期(三期以上)" },
            { id: 17, name: "钱七", idNumber: "320102199707073456", score: 30, riskBehavior: "严重失信" },
            { id: 801, name: "孙伟", idNumber: "320102199104041001", score: 42, riskBehavior: "贷款逾期(三期以上)" },
            { id: 802, name: "李芳", idNumber: "320102199204041002", score: 38, riskBehavior: "严重失信" },
            { id: 803, name: "张涛", idNumber: "320102199304041003", score: 44, riskBehavior: "账户冻结" },
            { id: 804, name: "王静", idNumber: "320102199404041004", score: 36, riskBehavior: "贷款逾期(三期以上)" },
            { id: 805, name: "陈明", idNumber: "320102199504041005", score: 41, riskBehavior: "严重失信" },
            { id: 806, name: "杨强", idNumber: "320102199604041006", score: 39, riskBehavior: "账户冻结" },
            { id: 807, name: "赵磊", idNumber: "320102199704041007", score: 43, riskBehavior: "贷款逾期(三期以上)" },
            { id: 808, name: "黄婷", idNumber: "320102199804041008", score: 37, riskBehavior: "严重失信" },
            { id: 809, name: "周洋", idNumber: "320102199904041009", score: 40, riskBehavior: "账户冻结" },
            { id: 810, name: "吴丽", idNumber: "320102200004041010", score: 34, riskBehavior: "贷款逾期(三期以上)" }
        ]
    },
    "开发商": {
        "A": [
            { id: 18, name: "万科地产", idNumber: "KF202001001", score: 92, riskBehavior: "无" },
            { id: 19, name: "碧桂园", idNumber: "KF202001002", score: 90, riskBehavior: "无" },
            { id: 901, name: "中海地产", idNumber: "KF202001101", score: 94, riskBehavior: "无" },
            { id: 902, name: "华润置地", idNumber: "KF202001102", score: 91, riskBehavior: "无" },
            { id: 903, name: "龙湖集团", idNumber: "KF202001103", score: 93, riskBehavior: "无" },
            { id: 904, name: "招商蛇口", idNumber: "KF202001104", score: 95, riskBehavior: "无" },
            { id: 905, name: "金地集团", idNumber: "KF202001105", score: 90, riskBehavior: "无" },
            { id: 906, name: "绿城中国", idNumber: "KF202001106", score: 92, riskBehavior: "无" },
            { id: 907, name: "新城控股", idNumber: "KF202001107", score: 91, riskBehavior: "无" },
            { id: 908, name: "世茂集团", idNumber: "KF202001108", score: 93, riskBehavior: "无" }
        ],
        "B": [
            { id: 20, name: "保利地产", idNumber: "KF202001003", score: 78, riskBehavior: "无" },
            { id: 1001, name: "旭辉控股", idNumber: "KF202001201", score: 76, riskBehavior: "无" },
            { id: 1002, name: "中南建设", idNumber: "KF202001202", score: 79, riskBehavior: "无" },
            { id: 1003, name: "阳光城", idNumber: "KF202001203", score: 74, riskBehavior: "无" },
            { id: 1004, name: "正荣地产", idNumber: "KF202001204", score: 77, riskBehavior: "无" },
            { id: 1005, name: "中梁控股", idNumber: "KF202001205", score: 75, riskBehavior: "无" },
            { id: 1006, name: "美的置业", idNumber: "KF202001206", score: 78, riskBehavior: "无" },
            { id: 1007, name: "时代中国", idNumber: "KF202001207", score: 73, riskBehavior: "无" },
            { id: 1008, name: "雅居乐", idNumber: "KF202001208", score: 76, riskBehavior: "无" }
        ],
        "C": [
            { id: 21, name: "某地产集团", idNumber: "KF202015003", score: 68, riskBehavior: "延期交房" },
            { id: 1101, name: "富力地产", idNumber: "KF202001301", score: 62, riskBehavior: "延期交房" },
            { id: 1102, name: "佳兆业", idNumber: "KF202001302", score: 58, riskBehavior: "捂盘惜售" },
            { id: 1103, name: "泰禾集团", idNumber: "KF202001303", score: 64, riskBehavior: "延期交房" },
            { id: 1104, name: "蓝光发展", idNumber: "KF202001304", score: 56, riskBehavior: "资金异常" },
            { id: 1105, name: "中骏集团", idNumber: "KF202001305", score: 61, riskBehavior: "延期交房" },
            { id: 1106, name: "禹洲集团", idNumber: "KF202001306", score: 59, riskBehavior: "捂盘惜售" },
            { id: 1107, name: "建业地产", idNumber: "KF202001307", score: 63, riskBehavior: "延期交房" },
            { id: 1108, name: "花样年", idNumber: "KF202001308", score: 57, riskBehavior: "资金异常" }
        ],
        "D": [
            { id: 22, name: "天山工程", idNumber: "TYSH8398209090", score: 55, riskBehavior: "楼盘停工" },
            { id: 23, name: "某置业公司", idNumber: "KF202001004", score: 48, riskBehavior: "协助违规" },
            { id: 1201, name: "恒大地产", idNumber: "KF202001401", score: 42, riskBehavior: "楼盘停工" },
            { id: 1202, name: "融创中国", idNumber: "KF202001402", score: 38, riskBehavior: "资金异常" },
            { id: 1203, name: "奥园集团", idNumber: "KF202001403", score: 44, riskBehavior: "楼盘停工" },
            { id: 1204, name: "新力控股", idNumber: "KF202001404", score: 36, riskBehavior: "协助违规" },
            { id: 1205, name: "当代置业", idNumber: "KF202001405", score: 41, riskBehavior: "楼盘停工" },
            { id: 1206, name: "祥生控股", idNumber: "KF202001406", score: 39, riskBehavior: "资金异常" },
            { id: 1207, name: "阳光100", idNumber: "KF202001407", score: 43, riskBehavior: "延期交房" },
            { id: 1208, name: "华夏幸福", idNumber: "KF202001408", score: 37, riskBehavior: "楼盘停工" }
        ]
    }
};

/**
 * POST - 按信用等级钻取（饼图点击）
 */
router.post('/credit/risk/drilldown/level', (req, res) => {
    const { subject = '缴存单位', selectedId, page = 1, perPage = 10 } = req.body;

    console.log('[POST] 信用等级钻取:', { subject, selectedId, page, perPage });

    if (!selectedId) {
        return res.status(400).json({ status: 400, msg: 'selectedId is required' });
    }

    // 从 itemId 提取等级 (A, B, C, D)
    const level = selectedId.charAt(0);
    const items = drilldownByLevel[subject]?.[level] || [];

    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
    });
});

// 钻取数据：按风险行为的主体列表
const drilldownByBehavior = {
    "缴存单位": {
        "连续欠缴": [
            { id: 1, name: "YY制造厂", idNumber: "DW2022112345", score: 40, level: "D", overdueMonths: 5 },
            { id: 2, name: "某餐饮连锁", idNumber: "TYSH2023001234", score: 60, level: "C", overdueMonths: 3 },
            { id: 3, name: "某建材公司", idNumber: "TYSH6789012345", score: 55, level: "C", overdueMonths: 4 }
        ],
        "缴存人数骤降": [
            { id: 4, name: "YY制造厂", idNumber: "DW2022112345", score: 40, level: "D", decreaseRate: "45%" },
            { id: 5, name: "某物流公司", idNumber: "TYSH4567890123", score: 55, level: "C", decreaseRate: "32%" }
        ],
        "信息不一致": [
            { id: 6, name: "某科技公司", idNumber: "TYSH2345678901", score: 78, level: "B", mismatchItems: 2 },
            { id: 7, name: "某餐饮连锁", idNumber: "TYSH2023001234", score: 60, level: "C", mismatchItems: 3 }
        ],
        "贷款逾期": [
            { id: 8, name: "某建材公司", idNumber: "TYSH6789012345", score: 55, level: "C", overdueRate: "35%" }
        ],
        "一般失信": [
            { id: 9, name: "某物流公司", idNumber: "TYSH4567890123", score: 55, level: "C", reason: "违反承诺" }
        ]
    },
    "缴存人": {
        "信息不完善": [
            { id: 10, name: "王芳", idNumber: "320102199303039012", score: 75, level: "B", missingItems: 3 },
            { id: 11, name: "张三", idNumber: "320102199202025678", score: 85, level: "B", missingItems: 2 }
        ],
        "违规提取": [
            { id: 12, name: "赵六", idNumber: "320102199505051234", score: 55, level: "C", reason: "虚假证明" }
        ],
        "贷后停缴": [
            { id: 13, name: "李四", idNumber: "320102199404045678", score: 65, level: "C", stopMonths: 4 }
        ],
        "账户冻结": [
            { id: 14, name: "钱七", idNumber: "320102199707073456", score: 30, level: "D", reason: "法院冻结" }
        ],
        "贷款逾期": [
            { id: 15, name: "王五", idNumber: "320102199606067890", score: 45, level: "D", overdueMonths: 5 }
        ]
    },
    "开发商": {
        "楼盘停工": [
            { id: 16, name: "天山工程", idNumber: "TYSH8398209090", score: 55, level: "D", project: "天山花园" },
            { id: 17, name: "某置业公司", idNumber: "KF202001004", score: 48, level: "D", project: "阳光小区" }
        ],
        "协助违规": [
            { id: 18, name: "某置业公司", idNumber: "KF202001004", score: 48, level: "D", reason: "提供虚假材料" }
        ],
        "捂盘惜售": [
            { id: 19, name: "某地产集团", idNumber: "KF202015003", score: 68, level: "C", project: "城市花园" }
        ],
        "资金异常": [
            { id: 20, name: "天山工程", idNumber: "TYSH8398209090", score: 55, level: "D", amount: 5000000 }
        ],
        "延期交房": [
            { id: 21, name: "某地产集团", idNumber: "KF202015003", score: 68, level: "C", delayMonths: 6 }
        ]
    }
};

/**
 * POST - 按风险行为钻取（风险行为柱状图点击）
 */
router.post('/credit/risk/drilldown/behavior', (req, res) => {
    const { subject = '缴存单位', selectedId, page = 1, perPage = 10 } = req.body;

    console.log('[POST] 风险行为钻取:', { subject, selectedId, page, perPage });

    if (!selectedId) {
        return res.status(400).json({ status: 400, msg: 'selectedId is required' });
    }

    const items = drilldownByBehavior[subject]?.[selectedId] || [];

    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
    });
});

// 钻取数据：按区域的风险主体列表
const drilldownByRegion = {
    "缴存单位": {
        "城关管理部": [
            { id: 1, name: "YY制造厂", idNumber: "DW2022112345", score: 40, level: "D", riskBehavior: "连续欠缴" },
            { id: 2, name: "某餐饮连锁", idNumber: "TYSH2023001234", score: 60, level: "C", riskBehavior: "信息不一致" },
            { id: 3, name: "某建材公司", idNumber: "TYSH6789012345", score: 55, level: "C", riskBehavior: "贷款逾期" }
        ],
        "七里河管理部": [
            { id: 4, name: "某物流公司", idNumber: "TYSH4567890123", score: 55, level: "C", riskBehavior: "缴存人数骤降" },
            { id: 5, name: "某科技公司", idNumber: "TYSH2345678901", score: 78, level: "B", riskBehavior: "信息不一致" }
        ],
        "西固管理部": [
            { id: 6, name: "某机械厂", idNumber: "TYSH7890123456", score: 50, level: "C", riskBehavior: "连续欠缴" }
        ],
        "安宁管理部": [
            { id: 7, name: "某商贸公司", idNumber: "TYSH8901234567", score: 62, level: "C", riskBehavior: "一般失信" }
        ],
        "红古管理部": [
            { id: 8, name: "某化工厂", idNumber: "TYSH9012345678", score: 58, level: "C", riskBehavior: "缴存人数骤降" }
        ]
    },
    "缴存人": {
        "城关管理部": [
            { id: 9, name: "王五", idNumber: "320102199606067890", score: 45, level: "D", riskBehavior: "贷款逾期" },
            { id: 10, name: "李四", idNumber: "320102199404045678", score: 65, level: "C", riskBehavior: "贷后停缴" }
        ],
        "七里河管理部": [
            { id: 11, name: "赵六", idNumber: "320102199505051234", score: 55, level: "C", riskBehavior: "违规提取" }
        ],
        "西固管理部": [
            { id: 12, name: "钱七", idNumber: "320102199707073456", score: 30, level: "D", riskBehavior: "账户冻结" }
        ],
        "安宁管理部": [
            { id: 13, name: "孙八", idNumber: "320102199808088901", score: 68, level: "C", riskBehavior: "信息不完善" }
        ],
        "新华管理部": [
            { id: 14, name: "周九", idNumber: "320102199909099012", score: 52, level: "C", riskBehavior: "贷后停缴" }
        ]
    },
    "开发商": {
        "城关区": [
            { id: 15, name: "天山工程", idNumber: "TYSH8398209090", score: 55, level: "D", riskBehavior: "楼盘停工" },
            { id: 16, name: "某置业公司", idNumber: "KF202001004", score: 48, level: "D", riskBehavior: "协助违规" }
        ],
        "七里河区": [
            { id: 17, name: "某地产集团", idNumber: "KF202015003", score: 68, level: "C", riskBehavior: "延期交房" }
        ],
        "安宁区": [
            { id: 18, name: "某开发公司", idNumber: "KF202001005", score: 60, level: "C", riskBehavior: "捂盘惜售" }
        ],
        "西固区": [
            { id: 19, name: "某建设公司", idNumber: "KF202001006", score: 55, level: "C", riskBehavior: "资金异常" }
        ],
        "红古区": [
            { id: 20, name: "某房产公司", idNumber: "KF202001007", score: 62, level: "C", riskBehavior: "延期交房" }
        ]
    }
};

/**
 * POST - 按区域钻取（区域柱状图点击）
 */
router.post('/credit/risk/drilldown/region', (req, res) => {
    const { subject = '缴存单位', selectedId, page = 1, perPage = 10 } = req.body;

    console.log('[POST] 区域钻取:', { subject, selectedId, page, perPage });

    if (!selectedId) {
        return res.status(400).json({ status: 400, msg: 'selectedId is required' });
    }

    const items = drilldownByRegion[subject]?.[selectedId] || [];

    const result = paginate(items, page, perPage);

    res.json({
        status: 0,
        msg: 'success',
        data: result
    });
});

/**
 * POST - 生成信用体系管理分析报告
 * 模拟调用 Dify 工作流，返回 AMIS Schema
 */
router.post('/credit/risk/generate-report', (req, res) => {
    const { subject } = req.body;

    console.log('[POST] 生成信用风险报告请求:', { subject });

    // 获取当前日期
    const now = new Date();
    const reportDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

    // 模拟 Dify 工作流返回的 AMIS Schema
    const reportSchema = {
        type: "page",
        body: [
            {
                type: "wrapper",
                className: "bg-white p-lg",
                style: {
                    fontFamily: "SimSun, Songti SC, serif",
                    lineHeight: "1.8"
                },
                body: [
                    // 报告标题
                    {
                        type: "html",
                        html: "<h1 style='text-align:center;font-size:28px;font-weight:bold;margin-bottom:40px;color:#000'>公积金信用体系管理分析报告</h1>"
                    },
                    {
                        type: "html",
                        html: `<p style='text-align:center;font-size:16px;margin-bottom:60px;color:#666'>报告生成日期：${reportDate}</p>`
                    },

                    // 一、信用体系运行概况
                    {
                        type: "html",
                        html: "<div style='font-size:18px;font-weight:bold;margin-top:30px;margin-bottom:15px;border-left:4px solid #1890ff;padding:8px 10px;background:#f0f7ff'>一、信用体系运行概况</div>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'>截至本报告期，我中心信用管理系统已纳入信用主体共计 <strong>12,842</strong> 个，包括缴存单位 <strong>2,400</strong> 家、缴存人 <strong>10,200</strong> 人、开发商 <strong>242</strong> 家。</p>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'>整体信用状况良好，A级（优秀）主体占比 <strong>61.4%</strong>，B级（良好）主体占比 <strong>26.2%</strong>，C级及D级风险主体合计占比 <strong>12.4%</strong>。</p>"
                    },

                    // 二、风险主体分析
                    {
                        type: "html",
                        html: "<div style='font-size:18px;font-weight:bold;margin-top:30px;margin-bottom:15px;border-left:4px solid #1890ff;padding:8px 10px;background:#f0f7ff'>二、风险主体分析</div>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'><strong>2.1 缴存单位风险分析</strong></p>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'>当前共有 <strong>100</strong> 家缴存单位被标记为D级（高风险），主要风险行为集中在：连续欠缴（120起）、缴存人数骤降（85起）、信息不一致（45起）。城关管理部辖区内高风险主体数量最多（450家），建议重点关注。</p>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'><strong>2.2 缴存人风险分析</strong></p>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'>高风险缴存人共 <strong>200</strong> 人，主要风险点为：信息不完善（150人）、违规提取（80人）、贷后停缴（60人）。近30天风险趋势呈上升态势，需加强监控。</p>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'><strong>2.3 开发商风险分析</strong></p>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'>高风险开发商 <strong>12</strong> 家，主要风险行为为楼盘停工（8起）、协助违规（5起）。建议对相关楼盘开展专项核查。</p>"
                    },

                    // 三、趋势预警
                    {
                        type: "html",
                        html: "<div style='font-size:18px;font-weight:bold;margin-top:30px;margin-bottom:15px;border-left:4px solid #1890ff;padding:8px 10px;background:#f0f7ff'>三、趋势预警</div>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'>基于AI模型分析，预测未来30天内：</p>"
                    },
                    {
                        type: "html",
                        html: "<ul style='font-size:16px;padding-left:20px;margin-bottom:20px'><li>缴存单位高风险数量可能增加 <strong>15-20%</strong></li><li>缴存人贷款逾期率预计上升 <strong>0.3个百分点</strong></li><li>开发商风险相对稳定，无明显波动</li></ul>"
                    },

                    // 四、管理建议
                    {
                        type: "html",
                        html: "<div style='font-size:18px;font-weight:bold;margin-top:30px;margin-bottom:15px;border-left:4px solid #1890ff;padding:8px 10px;background:#f0f7ff'>四、管理建议</div>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'>1. <strong>强化分类监管：</strong>对C级、D级主体实施差异化管理，建立\"红黄牌\"预警机制，确保风险早发现、早干预。</p>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'>2. <strong>深化数据共享：</strong>加强与工商、税务、人社等部门的数据联动，提升信用信息的全面性与时效性。</p>"
                    },
                    {
                        type: "html",
                        html: "<p style='font-size:16px;text-align:justify;margin-bottom:20px'>3. <strong>完善信用修复通道：</strong>针对非恶意失信主体（如因疫情等不可抗力导致），建立快速信用修复与异议处理通道，体现管理的温度与弹性。</p>"
                    },

                    // 落款
                    {
                        type: "html",
                        html: `<div style='text-align:right;margin-top:50px'><p><strong>住房公积金管理中心 · 信用管理部</strong></p><p>${reportDate}</p></div>`
                    }
                ]
            }
        ]
    };

    res.json({
        status: 0,
        msg: 'success',
        data: reportSchema
    });
});

// ==================== 智能稽核 - 风险总览 API ====================

/**
 * POST - 获取风险总览统计数据
 * 返回顶部4个统计卡片的数据
 */
router.post('/audit/risk/overview/stats', (req, res) => {
    console.log('[POST] 风险总览统计请求');

    // 模拟统计数据
    const stats = {
        todayRiskCount: 18,           // 今日风险识别
        unreviewedCount: 11,          // 未复核数量
        totalIdentified: 929,         // 累计识别数量
        lastUpdateTime: new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    };

    res.json({
        status: 0,
        msg: 'success',
        data: stats
    });
});

/**
 * POST - 获取近7日AI预警趋势图数据
 * 返回 ECharts 折线图配置
 */
router.post('/audit/risk/overview/chart/trend', (req, res) => {
    console.log('[POST] 风险趋势图请求');

    // 生成近7天的日期
    const dates = [];
    const values = [12, 15, 10, 18, 16, 14, 18]; // 模拟数据

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(`${date.getMonth() + 1}/${date.getDate()}`);
    }
    // 最后一天改为"今日"
    dates[dates.length - 1] = '今日';

    const chartConfig = {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            data: dates,
            axisLine: { lineStyle: { color: '#ccc' } },
            axisLabel: { color: '#666' }
        },
        yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#ccc' } },
            axisLabel: { color: '#666' },
            splitLine: { lineStyle: { color: '#eee' } }
        },
        series: [{
            name: 'AI预警数',
            type: 'line',
            data: values,
            smooth: true,
            itemStyle: { color: '#e63946' },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(230, 57, 70, 0.3)' },
                        { offset: 1, color: 'rgba(230, 57, 70, 0.05)' }
                    ]
                }
            }
        }]
    };

    res.json({
        status: 0,
        msg: 'success',
        data: chartConfig
    });
});

/**
 * POST - 获取AI风险类型分布饼图数据
 * 返回 ECharts 饼图配置
 */
router.post('/audit/risk/overview/chart/pie', (req, res) => {
    console.log('[POST] 风险分布饼图请求');

    // 模拟各类型风险数量
    const riskTypes = [
        { value: 5, name: '材料伪造', itemId: 'material_forgery' },
        { value: 5, name: '团伙骗提', itemId: 'gang_fraud' },
        { value: 5, name: '单位挂靠', itemId: 'unit_affiliation' },
        { value: 5, name: '合同造假', itemId: 'contract_fake' },
        { value: 5, name: '地址矛盾', itemId: 'address_conflict' },
        { value: 5, name: '突击提取', itemId: 'rush_withdrawal' }
    ];

    const chartConfig = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}笔 ({d}%)'
        },
        legend: {
            bottom: '5%',
            left: 'center',
            textStyle: { color: '#666' }
        },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['50%', '45%'],
            data: riskTypes,
            label: { show: false },
            emphasis: {
                label: { show: true, fontSize: 14, fontWeight: 'bold' }
            },
            itemStyle: {
                borderRadius: 4,
                borderColor: '#fff',
                borderWidth: 2
            },
            color: ['#e63946', '#f4a261', '#2a9d8f', '#264653', '#e9c46a', '#9b59b6']
        }]
    };

    res.json({
        status: 0,
        msg: 'success',
        data: chartConfig
    });
});

// ==================== 智能稽核 - 风险清册 API ====================

// 风险清册模拟数据
const auditRiskRegistry = [
    // 材料伪造
    { id: 1, name: "张伟", idCard: "3301061990******12", type: "购房提取", amount: 480000, date: "2025-04-05", riskType: "材料伪造", confidence: 92, status: "未复核" },
    { id: 2, name: "李娜", idCard: "3301081988******21", type: "购房提取", amount: 420000, date: "2025-04-04", riskType: "材料伪造", confidence: 88, status: "未复核" },
    { id: 3, name: "王强", idCard: "3301051985******33", type: "租房提取", amount: 36000, date: "2025-04-03", riskType: "材料伪造", confidence: 85, status: "已复核" },
    { id: 4, name: "赵芳", idCard: "3301091992******44", type: "购房提取", amount: 520000, date: "2025-04-02", riskType: "材料伪造", confidence: 90, status: "未复核" },
    { id: 5, name: "郑明", idCard: "3301101987******55", type: "租房提取", amount: 42000, date: "2025-04-01", riskType: "材料伪造", confidence: 87, status: "已复核" },
    // 团伙骗提
    { id: 6, name: "刘洋", idCard: "3301081988******21", type: "租房提取", amount: 36000, date: "2025-04-04", riskType: "团伙骗提", confidence: 78, status: "未复核" },
    { id: 7, name: "陈涛", idCard: "3301071986******11", type: "离职提取", amount: 18000, date: "2025-04-03", riskType: "团伙骗提", confidence: 82, status: "未复核" },
    { id: 8, name: "周静", idCard: "3301061991******22", type: "购房提取", amount: 450000, date: "2025-04-02", riskType: "团伙骗提", confidence: 80, status: "已复核" },
    { id: 9, name: "吴磊", idCard: "3301051984******33", type: "租房提取", amount: 38000, date: "2025-04-01", riskType: "团伙骗提", confidence: 76, status: "未复核" },
    { id: 10, name: "黄蓉", idCard: "3301091989******44", type: "离职提取", amount: 15000, date: "2025-03-31", riskType: "团伙骗提", confidence: 79, status: "已复核" },
    // 单位挂靠
    { id: 11, name: "孙强", idCard: "3301051985******33", type: "离职提取", amount: 18000, date: "2025-04-03", riskType: "单位挂靠", confidence: 85, status: "未复核" },
    { id: 12, name: "钱伟", idCard: "3301101987******55", type: "租房提取", amount: 42000, date: "2025-04-01", riskType: "单位挂靠", confidence: 73, status: "已复核" },
    { id: 13, name: "李鹏", idCard: "3301061983******12", type: "购房提取", amount: 480000, date: "2025-03-30", riskType: "单位挂靠", confidence: 81, status: "未复核" },
    { id: 14, name: "王燕", idCard: "3301081990******21", type: "离职提取", amount: 18000, date: "2025-03-28", riskType: "单位挂靠", confidence: 77, status: "未复核" },
    { id: 15, name: "赵鑫", idCard: "3301071985******11", type: "租房提取", amount: 36000, date: "2025-03-25", riskType: "单位挂靠", confidence: 75, status: "已复核" },
    // 合同造假
    { id: 16, name: "陈峰", idCard: "3301091992******44", type: "购房提取", amount: 520000, date: "2025-04-02", riskType: "合同造假", confidence: 90, status: "未复核" },
    { id: 17, name: "张芳", idCard: "3301101986******12", type: "购房提取", amount: 480000, date: "2025-04-01", riskType: "合同造假", confidence: 88, status: "未复核" },
    { id: 18, name: "刘华", idCard: "3301051989******22", type: "购房提取", amount: 460000, date: "2025-03-30", riskType: "合同造假", confidence: 86, status: "已复核" },
    { id: 19, name: "李明", idCard: "3301061984******11", type: "购房提取", amount: 490000, date: "2025-03-28", riskType: "合同造假", confidence: 84, status: "未复核" },
    { id: 20, name: "王丽", idCard: "3301081991******22", type: "购房提取", amount: 510000, date: "2025-03-25", riskType: "合同造假", confidence: 82, status: "已复核" },
    // 地址矛盾
    { id: 21, name: "赵强", idCard: "3301051985******33", type: "离职提取", amount: 18000, date: "2025-04-03", riskType: "地址矛盾", confidence: 85, status: "未复核" },
    { id: 22, name: "孙梅", idCard: "3301101987******55", type: "租房提取", amount: 42000, date: "2025-04-01", riskType: "地址矛盾", confidence: 73, status: "已复核" },
    { id: 23, name: "黄军", idCard: "3301091988******21", type: "离职提取", amount: 15000, date: "2025-03-30", riskType: "地址矛盾", confidence: 79, status: "未复核" },
    { id: 24, name: "周敏", idCard: "3301061985******11", type: "离职提取", amount: 18000, date: "2025-03-28", riskType: "地址矛盾", confidence: 76, status: "未复核" },
    { id: 25, name: "吴刚", idCard: "3301071990******22", type: "离职提取", amount: 15000, date: "2025-03-25", riskType: "地址矛盾", confidence: 74, status: "已复核" },
    // 突击提取
    { id: 26, name: "林涛", idCard: "3301081988******21", type: "租房提取", amount: 36000, date: "2025-04-04", riskType: "突击提取", confidence: 78, status: "未复核" },
    { id: 27, name: "杨芳", idCard: "3301061960******12", type: "退休提取", amount: 620000, date: "2025-04-03", riskType: "突击提取", confidence: 83, status: "未复核" },
    { id: 28, name: "郭华", idCard: "3301051961******11", type: "退休提取", amount: 580000, date: "2025-04-02", riskType: "突击提取", confidence: 80, status: "已复核" },
    { id: 29, name: "何梅", idCard: "3301081960******22", type: "退休提取", amount: 610000, date: "2025-04-01", riskType: "突击提取", confidence: 85, status: "未复核" },
    { id: 30, name: "罗才", idCard: "3301071962******11", type: "退休提取", amount: 590000, date: "2025-03-30", riskType: "突击提取", confidence: 79, status: "已复核" }
];

/**
 * POST - 获取风险清册列表
 * 支持筛选和分页
 */
router.post('/audit/risk/registry/list', (req, res) => {
    const { riskType, status, page = 1, perPage = 10 } = req.body;
    console.log('[POST] 风险清册列表请求:', { riskType, status, page, perPage });

    let filtered = [...auditRiskRegistry];

    // 筛选条件
    if (riskType) {
        filtered = filtered.filter(item => item.riskType === riskType);
    }
    if (status) {
        filtered = filtered.filter(item => item.status === status);
    }

    // 分页
    const total = filtered.length;
    const start = (page - 1) * perPage;
    const items = filtered.slice(start, start + perPage);

    // 格式化金额
    const formattedItems = items.map(item => ({
        ...item,
        amountFormatted: `¥${item.amount.toLocaleString()}`,
        confidenceFormatted: `${item.confidence}%`
    }));

    res.json({
        status: 0,
        msg: 'success',
        data: {
            items: formattedItems,
            total,
            page: parseInt(page),
            perPage: parseInt(perPage)
        }
    });
});

// ==================== 智能稽核 - AI 模型库 API ====================

/**
 * POST - 获取 AI 模型库列表
 * 返回所有 AI 稽核模型的信息
 */
router.post('/audit/ai-models/list', (req, res) => {
    console.log('[POST] AI 模型库列表请求');

    const models = [
        {
            id: 1,
            name: "材料伪造识别模型",
            icon: "fa fa-picture-o",
            color: "#1890ff",
            bgColor: "primary",
            function: "通过图像特征识别PS痕迹、重复上传、印章异常等模板材料检测。",
            technology: "卷积神经网络（CNN）+ 图像哈希对比",
            accuracy: "96.5%",
            status: "运行中",
            lastUpdate: "2025-04-01"
        },
        {
            id: 2,
            name: "团伙骗提检测模型",
            icon: "fa fa-users",
            color: "#dc3545",
            bgColor: "danger",
            function: "基于'共用电话、合同签约、金额近似'等关联关系图谱，识别团伙式骗提。",
            technology: "图神经网络（GNN）+ 社区检测算法",
            accuracy: "94.2%",
            status: "运行中",
            lastUpdate: "2025-03-28"
        },
        {
            id: 3,
            name: "单位挂靠识别模型",
            icon: "fa fa-building",
            color: "#ffc107",
            bgColor: "warning",
            function: "识别短工龄申报、短期参保、多次变更单位等'挂靠缴存'行为。",
            technology: "随机森林 + 行为序列建模（LSTM）",
            accuracy: "91.8%",
            status: "运行中",
            lastUpdate: "2025-04-02"
        },
        {
            id: 4,
            name: "合同套用检测模型",
            icon: "fa fa-file-text-o",
            color: "#17a2b8",
            bgColor: "info",
            function: "检测同一份合同在不同申请人之间重复使用。",
            technology: "文本相似度（SimHash）+ 规则表达式验证对比",
            accuracy: "98.1%",
            status: "运行中",
            lastUpdate: "2025-03-25"
        },
        {
            id: 5,
            name: "租房地址矛盾识别",
            icon: "fa fa-home",
            color: "#28a745",
            bgColor: "success",
            function: "对比租房合同地址与社保/劳动合同/居住证地址是否一致。",
            technology: "NLP实体抽取 + 地址标准化匹配",
            accuracy: "93.6%",
            status: "运行中",
            lastUpdate: "2025-04-03"
        },
        {
            id: 6,
            name: "突击提取行为预警",
            icon: "fa fa-clock-o",
            color: "#6c757d",
            bgColor: "secondary",
            function: "识别临近退休集中大额提取、失业前突击提取等异常行为。",
            technology: "时序异常检测（Prophet + Z-score）",
            accuracy: "89.4%",
            status: "运行中",
            lastUpdate: "2025-03-30"
        }
    ];

    res.json({
        status: 0,
        msg: 'success',
        data: {
            items: models,
            total: models.length
        }
    });
});

module.exports = router;

