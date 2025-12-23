/**
 * 用户认证路由
 * 处理登录、登出等认证相关接口
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { generateToken } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const axios = require('axios');

/**
 * 调用第三方网关验证接口
 * @param {string} ticket - 从前端 URL 获取的 ticket 参数
 * @param {string} tyLoginToken - 从前端 URL 获取的 tyLoginToken 参数
 */
async function callGatewayValidate(ticket, tyLoginToken) {
    const gatewayEnabled = process.env.GATEWAY_ENABLED === 'true';

    if (!gatewayEnabled) {
        logger.info('[Gateway] 网关集成已禁用，返回模拟数据');
        return {
            success: true,
            gateway_token: 'mock-gateway-token-' + Date.now(),
            tenant_id: 'mock-tenant-id',
            user_id: 'mock-user-id'
        };
    }

    const gatewayUrl = process.env.GATEWAY_VALIDATE_URL;

    if (!gatewayUrl) {
        logger.warn('[Gateway] 网关 URL 未配置，使用模拟数据');
        return {
            success: true,
            gateway_token: 'mock-gateway-token',
            tenant_id: 'mock-tenant-id',
            user_id: 'mock-user-id'
        };
    }

    // 参数来自前端 URL，如果未提供则使用环境变量兜底
    const finalTicket = ticket || process.env.GATEWAY_TICKET;
    const finalLoginToken = tyLoginToken || process.env.GATEWAY_LOGIN_TOKEN;

    if (!finalTicket || !finalLoginToken) {
        logger.warn('[Gateway] 网关参数不完整 (ticket 或 tyLoginToken 缺失)，使用模拟数据');
        return {
            success: true,
            gateway_token: 'mock-gateway-token',
            tenant_id: 'mock-tenant-id',
            user_id: 'mock-user-id'
        };
    }

    try {
        logger.info(`[Gateway] 调用网关验证接口: ${gatewayUrl}`);
        logger.info(`[Gateway] 参数: ticket=${finalTicket.substring(0, 10)}..., tyLoginToken=${finalLoginToken.substring(0, 10)}...`);

        // 使用 JSON 格式发送（更简单可靠）
        const response = await axios.post(gatewayUrl, {
            ticket: finalTicket,
            loginToken: finalLoginToken
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        logger.info('[Gateway] 网关响应成功');
        logger.info('[Gateway] Response code:', response.data.code);

        // 解析返回数据
        const { code, user_info, role_info, success } = response.data;

        let jgbh = null;
        let jgmc = null;
        let grbh = null;
        let xingming = null;
        let zzbs = null;      // 组织标识

        // 解析 user_info（JSON 字符串）
        if (user_info) {
            try {
                const userInfoObj = JSON.parse(user_info);

                // 提取机构编号和机构名称
                if (userInfoObj.zzjgxx?.results?.jgmsg?.jgbh) {
                    jgbh = userInfoObj.zzjgxx.results.jgmsg.jgbh;
                    jgmc = userInfoObj.zzjgxx.results.jgmsg.jgmc;
                    zzbs = userInfoObj.zzjgxx.results.jgmsg.jgbh; // 组织标识使用 jgbh
                }

                // 提取个人编号和姓名
                if (userInfoObj.zzjgxx?.results?.personmsg && userInfoObj.zzjgxx.results.personmsg.length > 0) {
                    const person = userInfoObj.zzjgxx.results.personmsg[0];
                    grbh = person.grbh;
                    xingming = person.xingming;
                }

                logger.info(`[Gateway] 解析到: jgbh=${jgbh}, jgmc=${jgmc}, grbh=${grbh}, xingming=${xingming}, zzbs=${zzbs}`);
            } catch (parseError) {
                logger.warn('[Gateway] user_info 解析失败:', parseError.message);
            }
        }

        return {
            success: true,
            gateway_token: code || 'no-code',
            tenant_id: jgbh || 'unknown-tenant',
            user_id: grbh || 'unknown-user',
            jgbh: jgbh,           // 机构编号
            jgmc: jgmc,           // 机构名称
            grbh: grbh,           // 个人编号
            xingming: xingming,   // 姓名
            zzbs: zzbs,           // 组织标识
            login_token: tyLoginToken,  // 保存原始 loginToken 供后续使用
            raw_response: {
                code,
                success,
                user_info_parsed: user_info ? JSON.parse(user_info) : null,
                role_info_parsed: role_info ? JSON.parse(role_info) : null
            }
        };
    } catch (error) {
        // 打印完整的错误信息便于调试
        logger.error('[Gateway] 网关调用失败:');
        logger.error('[Gateway] Error message:', error.message || 'No message');
        logger.error('[Gateway] Error stack:', error.stack);

        // 如果是 axios 错误，打印更多细节
        if (error.response) {
            logger.error('[Gateway] Response status:', error.response.status);
            logger.error('[Gateway] Response data:', JSON.stringify(error.response.data));
        } else if (error.request) {
            logger.error('[Gateway] No response received');
            logger.error('[Gateway] Request:', error.request);
        } else {
            logger.error('[Gateway] Error config:', error.config);
        }

        // 网关调用失败时返回模拟数据，不阻塞登录
        return {
            success: false,
            error: error.message,
            gateway_token: 'fallback-token',
            tenant_id: 'fallback-tenant',
            user_id: 'fallback-user'
        };
    }
}

/**
 * POST /api/auth/login
 * 用户登录接口
 *
 * 请求参数：
 * - username: 用户名
 * - password: 密码
 * - ticket: （可选）从 URL 获取的网关 ticket
 * - tyLoginToken: （可选）从 URL 获取的网关 tyLoginToken
 * - qycode: （可选）企业代码，会返回给前端保存
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password, ticket, tyLoginToken, qycode } = req.body;

        // 参数校验
        if (!username || !password) {
            return res.status(400).json({
                status: 400,
                msg: '用户名和密码不能为空'
            });
        }

        // 查询用户
        const sql = 'SELECT * FROM sys_user WHERE username = ? AND is_active = 1';

        db.get(sql, [username], async (err, user) => {
            if (err) {
                logger.error('登录查询失败:', err);
                return res.status(500).json({
                    status: 500,
                    msg: '服务器错误'
                });
            }

            if (!user) {
                logger.warn(`登录失败 - 用户不存在: ${username}`);
                return res.status(401).json({
                    status: 401,
                    msg: '用户名或密码错误'
                });
            }

            // 验证密码（注意：这里使用明文比对，生产环境应使用 bcrypt）
            if (user.password !== password) {
                logger.warn(`登录失败 - 密码错误: ${username}`);
                return res.status(401).json({
                    status: 401,
                    msg: '用户名或密码错误'
                });
            }

            // 生成 JWT Token
            const token = generateToken({
                id: user.id,
                username: user.username,
                role: user.role
            });

            // 更新最后登录时间
            db.run(
                'UPDATE sys_user SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id],
                (err) => {
                    if (err) {
                        logger.error('更新登录时间失败:', err);
                    }
                }
            );

            logger.info(`用户登录成功: ${username} (${user.role})`);

            // 调用第三方网关（传递从前端获取的参数）
            const gatewayInfo = await callGatewayValidate(ticket, tyLoginToken);

            // 返回 token、用户信息、网关信息（包含 qycode 和 jgbh）
            res.json({
                status: 0,
                msg: '登录成功',
                data: {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        nickname: user.nickname,
                        role: user.role
                    },
                    gateway_info: {
                        gateway_token: gatewayInfo.gateway_token,
                        tenant_id: gatewayInfo.tenant_id,
                        user_id: gatewayInfo.user_id,
                        qycode: qycode || gatewayInfo.tenant_id,  // 企业代码
                        jgbh: gatewayInfo.jgbh,                     // 机构编号
                        jgmc: gatewayInfo.jgmc,                     // 机构名称
                        grbh: gatewayInfo.grbh,                     // 个人编号
                        xingming: gatewayInfo.xingming,             // 姓名
                        zzbs: gatewayInfo.zzbs,                     // 组织标识
                        zzjgdmz: qycode,                            // 组织机构代码证（使用前端传入的 qycode）
                        login_token: gatewayInfo.login_token        // login-token
                    }
                }
            });
        });
    } catch (error) {
        logger.error('登录接口异常:', error);
        res.status(500).json({
            status: 500,
            msg: '服务器错误'
        });
    }
});

/**
 * GET /api/auth/current
 * 获取当前登录用户信息
 */
router.get('/current', (req, res) => {
    // 这个接口需要鉴权，req.user 由 auth 中间件注入
    if (!req.user) {
        return res.status(401).json({
            status: 401,
            msg: '未登录'
        });
    }

    res.json({
        status: 0,
        msg: 'success',
        data: req.user
    });
});

module.exports = router;
