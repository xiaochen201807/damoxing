/**
 * 政策预测 API 路由
 * 处理政策参数调整并返回预测结果
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * 租房提取政策预测
 * POST /api/policy/zftq/predict
 */
router.post('/zftq/predict', (req, res) => {
    const {
        rent_limit,        // 月租金提取上限
        deposit_months,    // 连续缴存月数要求
        annual_times,      // 年度提取次数上限
        require_contract   // 是否要求备案租赁合同
    } = req.body;

    logger.info('[Policy Predict] 收到租房提取政策预测请求:', req.body);

    // 简化的预测逻辑（实际应调用 AI 模型或数学模型）
    try {
        // 1. 计算影响系数
        const basePeople = 225405;  // 基准满足人数
        const baseAmount = 342000000;  // 基准季度提取金额（3.42亿）

        // 影响因子计算
        const limitFactor = rent_limit / 2500;  // 上限调整系数
        const monthsFactor = 1 - (deposit_months - 6) * 0.05;  // 缴存要求系数
        const timesFactor = 1 + (annual_times - 1) * 0.1;  // 提取次数系数
        const contractFactor = require_contract ? 0.9 : 1.1;  // 合同要求系数

        // 综合系数
        const totalFactor = limitFactor * monthsFactor * timesFactor * contractFactor;

        // 2. 计算预测值
        const predictedPeople = Math.round(basePeople * totalFactor);
        const predictedAmount = Math.round(baseAmount * totalFactor);
        const predictedTimes = Math.round(153200 * totalFactor);
        const predictedRatio = ((predictedTimes / 533800) * 100).toFixed(1);  // 假设总提取人次为 533,800

        // 3. 计算趋势
        const peopleChange = (((predictedPeople - basePeople) / basePeople) * 100).toFixed(1);
        const timesChange = (((predictedTimes - 153200) / 153200) * 100).toFixed(1);
        const amountChange = (((predictedAmount - baseAmount) / baseAmount) * 100).toFixed(1);
        const ratioChange = (predictedRatio - 28.7).toFixed(1);

        // 4. 生成趋势标识
        const getTrend = (change) => {
            const num = parseFloat(change);
            if (num > 0) return { symbol: '↑', color: '#e53935' };
            if (num < 0) return { symbol: '↓', color: '#4caf50' };
            return { symbol: '→', color: '#999' };
        };

        const peopleTrend = getTrend(peopleChange);
        const timesTrend = getTrend(timesChange);
        const amountTrend = getTrend(amountChange);
        const ratioTrend = getTrend(ratioChange);

        // 5. 返回预测结果
        const response = {
            status: 0,
            msg: '预测成功',
            data: {
                prediction_data_items: [
                    {
                        label: '预测满足租房提取人数',
                        value: predictedPeople.toLocaleString(),
                        trend: `${peopleTrend.symbol} ${Math.abs(peopleChange)}%`,
                        trend_color: peopleTrend.color
                    },
                    {
                        label: '预测季度提取人次',
                        value: predictedTimes.toLocaleString(),
                        trend: `${timesTrend.symbol} ${Math.abs(timesChange)}%`,
                        trend_color: timesTrend.color
                    },
                    {
                        label: '预测租房占比',
                        value: `${predictedRatio}%`,
                        trend: `${ratioTrend.symbol} ${Math.abs(ratioChange)}%`,
                        trend_color: ratioTrend.color
                    },
                    {
                        label: '预测季度提取金额',
                        value: `¥${(predictedAmount / 100000000).toFixed(2)}亿`,
                        trend: `${amountTrend.symbol} ${Math.abs(amountChange)}%`,
                        trend_color: amountTrend.color
                    }
                ],
                summary: {
                    impact_level: Math.abs(peopleChange) > 20 ? 'high' : Math.abs(peopleChange) > 10 ? 'medium' : 'low',
                    key_changes: [
                        `提取人数变化: ${peopleChange}%`,
                        `提取金额变化: ${amountChange}%`,
                        `提取次数变化: ${timesChange}%`
                    ]
                }
            }
        };

        logger.info('[Policy Predict] 预测结果:', response.data.summary);
        res.json(response);

    } catch (error) {
        logger.error('[Policy Predict] 预测失败:', error);
        res.status(500).json({
            status: 500,
            msg: '预测失败',
            error: error.message
        });
    }
});

module.exports = router;
