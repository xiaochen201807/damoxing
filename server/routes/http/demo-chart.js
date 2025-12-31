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

module.exports = router;
