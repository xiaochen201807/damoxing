#!/usr/bin/env bash
# ---
# name: setup-beibei-entry
# description: 为指定机构配置贝贝入口，向 PT_JG_SX_CSH 表补充 4 条 bbPro 相关入口记录
# args:
#   jgbh: 机构编号 (例如 2301110003)
#   base_domain: 基础域名 (可选，默认为 https://appcs.jbysoft.com)
# ---
#
# 使用示例:
#   /setup-beibei-entry 2301110003
#   /setup-beibei-entry 2301110003 https://custom.domain.com
#
# 说明:
# 1. 脚本会自动拼接实际入口路径，无需传入完整页面 URL
# 2. 会写入以下 4 条入口记录:
#    - 关键数据计算模型
#    - 公积金关键数据计算模型配置
#    - 公积金业务标准库
#    - 程序规则控制管理
#
# 工作流程:
# 1. 根据机构编号查询PT_JG_SX_CSH表中的"对象定义"记录，获取ZXJSID
# 2. 查询该机构最大的SXBS值，自动生成新的SXBS（最大值+1）
# 3. 按 jgbh + sxmc 检查目标记录是否已存在，不存在时再插入
# 4. 验证本次新增记录是否写入成功，并输出结果统计
#

set -euo pipefail

# Parse arguments
JGBH="${1:-}"
BASE_DOMAIN="${2:-https://appcs.jbysoft.com}"

if [[ -z "$JGBH" ]]; then
    echo "❌ 错误: 缺少机构编号参数"
    echo "使用方法: /setup-beibei-entry <机构编号> [基础域名]"
    echo "示例: /setup-beibei-entry 2301110003"
    echo "示例(自定义域名): /setup-beibei-entry 2301110003 https://custom.domain.com"
    exit 1
fi

echo "🚀 开始配置贝贝入口..."
echo "📋 机构编号: $JGBH"
echo "🌐 基础域名: $BASE_DOMAIN"
echo ""

# Navigate to server directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/../../server" && pwd)"

cd "$SERVER_DIR" || exit 1

# Create a Node.js script to perform the database operations
node << 'EOF_NODE_SCRIPT'
const path = require('path');
const db = require(path.join(process.env.SERVER_DIR, 'db'));
const logger = console;

async function setupBeibeiEntry() {
    const jgbh = process.env.JGBH;
    const baseDomain = process.env.BASE_DOMAIN;

    if (!jgbh) {
        logger.error('❌ 缺少机构编号参数');
        process.exit(1);
    }

    try {
        logger.info('📡 正在连接数据库...');

        // Wait for datasource manager initialization
        await db.ready();

        const adapter = db.getByJgbh(jgbh);

        if (!adapter) {
            logger.error(`❌ 未找到机构 ${jgbh} 对应的数据源配置`);
            logger.error('💡 请检查 server/config/datasources.json 中是否配置了该机构的数据源路由');
            process.exit(1);
        }

        const adapterType = adapter.adapterType || adapter.constructor?.name || 'unknown';
        logger.info(`✅ 已连接到数据源: ${adapterType}`);

        // Determine if we need positional or named parameters
        const isOracle = adapterType === 'oracle' || adapterType === 'OracleAdapter';
        const useNamedParams = isOracle;

        // Helper function to build SQL and params based on adapter type
        function buildQuery(sqlTemplate, namedParams) {
            if (useNamedParams) {
                // Oracle: use :param1, :param2 with object
                return { sql: sqlTemplate.oracle, params: namedParams };
            } else {
                // PostgreSQL: use $1, $2 with array
                const paramKeys = sqlTemplate.paramOrder || [];
                const paramArray = paramKeys.map(key => namedParams[key]);
                return { sql: sqlTemplate.pg, params: paramArray };
            }
        }

        // Step 1: Query for "对象定义" record to get ZXJSID
        logger.info('');
        logger.info('📝 步骤 1/4: 查询"对象定义"记录获取ZXJSID...');

        const query1 = buildQuery(
            {
                oracle: `SELECT ID, ZXJSID, SXMC FROM PT_JG_SX_CSH WHERE JGBH = :jgbh AND SXMC LIKE '%对象定义%'`,
                pg: `SELECT ID, ZXJSID, SXMC FROM PT_JG_SX_CSH WHERE JGBH = $1 AND SXMC LIKE '%对象定义%'`,
                paramOrder: ['jgbh']
            },
            { jgbh }
        );

        const rows = await adapter.all(query1.sql, query1.params);

        if (!rows || rows.length === 0) {
            logger.error(`❌ 未找到机构 ${jgbh} 的"对象定义"记录`);
            logger.info('💡 提示: 请确认该机构已配置"对象定义"属性');
            process.exit(1);
        }

        // Handle case-insensitive field names (Oracle returns uppercase, PostgreSQL returns lowercase)
        const firstRow = rows[0];
        const id = firstRow.ID || firstRow.id;
        const zxjsid = firstRow.ZXJSID || firstRow.zxjsid || id;
        const sxmc = firstRow.SXMC || firstRow.sxmc;

        logger.info(`✅ 找到"对象定义"记录: ID=${id}, ZXJSID=${zxjsid}, SXMC="${sxmc}"`);

        // Step 2: Query for max SXBS value
        logger.info('');
        logger.info('📝 步骤 2/4: 查询最大SXBS值...');

        // SXBS 是字符类型，需要转换成数字找最大值
        const query2 = buildQuery(
            {
                oracle: `SELECT MAX(TO_NUMBER(SXBS)) as max_sxbs FROM PT_JG_SX_CSH WHERE JGBH = :jgbh AND REGEXP_LIKE(SXBS, '^-?[0-9]+$')`,
                pg: `SELECT MAX(CAST(SXBS AS INTEGER)) as max_sxbs FROM PT_JG_SX_CSH WHERE JGBH = $1 AND SXBS ~ '^-?[0-9]+$'`,
                paramOrder: ['jgbh']
            },
            { jgbh }
        );

        const maxResult = await adapter.get(query2.sql, query2.params);
        const maxSxbs = maxResult?.max_sxbs || maxResult?.MAX_SXBS || -10288;

        logger.info(`✅ 当前最大SXBS值: ${maxSxbs}`);

        // Step 3: Insert the three key data records
        logger.info('');
        logger.info('📝 步骤 3/4: 插入关键数据算法相关记录...');

        const insertRecords = [
            {
                sxmc: '关键数据计算模型',
                bdUrl: `${baseDomain}/gjj_gjsjjsmx/ywbz/ywbz`,
                bkmc: '数据应用'
            },
            {
                sxmc: '公积金关键数据计算模型配置',
                bdUrl: `${baseDomain}/gjj_gjsjjsmx/system/config`,
                bkmc: '数据应用'
            },
            {
                sxmc: '公积金业务标准库',
                bdUrl: `${baseDomain}/gjj_gjsjjsmx/ywblbzk/main`,
                bkmc: '数据应用'
            },
            {
                sxmc: '程序规则控制管理',
                bdUrl: `${baseDomain}/gjj_gjsjjsmx/cxgzkz/cxgzkz`,
                bkmc: '数据应用'
            }
        ];

        let insertedCount = 0;
        let skippedCount = 0;
        let startSxbs = maxSxbs + 1;
        const insertedSxbs = [];

        for (let i = 0; i < insertRecords.length; i++) {
            const record = insertRecords[i];
            const sxbs = String(startSxbs + i);

            // Check if record already exists by jgbh + sxmc (not sxbs)
            const checkQuery = buildQuery(
                {
                    oracle: `SELECT COUNT(*) as cnt FROM PT_JG_SX_CSH WHERE JGBH = :jgbh AND SXMC = :sxmc`,
                    pg: `SELECT COUNT(*) as cnt FROM PT_JG_SX_CSH WHERE JGBH = $1 AND SXMC = $2`,
                    paramOrder: ['jgbh', 'sxmc']
                },
                { jgbh, sxmc: record.sxmc }
            );

            const checkResult = await adapter.get(checkQuery.sql, checkQuery.params);
            const exists = (checkResult?.cnt || checkResult?.CNT || 0) > 0;

            if (exists) {
                logger.info(`⏭️  记录已存在，跳过: ${record.sxmc}`);
                skippedCount++;
                continue;
            }

            // Insert the record
            const insertQuery = buildQuery(
                {
                    oracle: `INSERT INTO PT_JG_SX_CSH (ID, JGBH, SXFL, SXBS, SXMC, BD_URL, TB_URL, ZXJSID, ZDLX, CPBS, BKMC) VALUES (f_newid(), :jgbh, '数据中台', :sxbs, :sxmc, :bdUrl, ' ', :zxjsid, '0', 'bbPro', :bkmc)`,
                    pg: `INSERT INTO PT_JG_SX_CSH (ID, JGBH, SXFL, SXBS, SXMC, BD_URL, TB_URL, ZXJSID, ZDLX, CPBS, BKMC) VALUES (f_newid(), $1, '数据中台', $2, $3, $4, ' ', $5, '0', 'bbPro', $6)`,
                    paramOrder: ['jgbh', 'sxbs', 'sxmc', 'bdUrl', 'zxjsid', 'bkmc']
                },
                {
                    jgbh,
                    sxbs,
                    sxmc: record.sxmc,
                    bdUrl: record.bdUrl,
                    zxjsid,
                    bkmc: record.bkmc
                }
            );

            try {
                await adapter.run(insertQuery.sql, insertQuery.params);
                logger.info(`✅ 插入成功: ${record.sxmc} (SXBS=${sxbs})`);
                insertedCount++;
                insertedSxbs.push(sxbs);
            } catch (err) {
                logger.error(`❌ 插入失败: ${record.sxmc} (SXBS=${sxbs})`);
                logger.error(`   错误信息: ${err.message}`);
                throw err;
            }
        }

        // Step 4: Verify the results
        logger.info('');
        logger.info('📝 步骤 4/4: 验证插入结果...');

        if (insertedSxbs.length > 0) {
            const sxbsPlaceholders = useNamedParams
                ? insertedSxbs.map((_, idx) => `:sxbs${idx}`).join(', ')
                : insertedSxbs.map((_, idx) => `$${idx + 2}`).join(', ');

            const verifyParams = useNamedParams
                ? insertedSxbs.reduce((acc, val, idx) => {
                    acc[`sxbs${idx}`] = val;
                    return acc;
                }, { jgbh })
                : [jgbh, ...insertedSxbs];

            const verifySQL = `
                SELECT ID, SXMC, SXBS, SXFL, BD_URL, ZXJSID, BKMC
                FROM PT_JG_SX_CSH
                WHERE JGBH = ${useNamedParams ? ':jgbh' : '$1'} AND SXBS IN (${sxbsPlaceholders})
                ORDER BY SXBS
            `;

            const verifyRows = await adapter.all(verifySQL, verifyParams);

            if (verifyRows && verifyRows.length > 0) {
                logger.info(`✅ 验证成功! 找到 ${verifyRows.length} 条记录:`);
                logger.info('');
                verifyRows.forEach((row, idx) => {
                    logger.info(`  记录 ${idx + 1}:`);
                    logger.info(`    ID: ${row.ID || row.id}`);
                    logger.info(`    属性名称: ${row.SXMC || row.sxmc}`);
                    logger.info(`    属性标识: ${row.SXBS || row.sxbs}`);
                    logger.info(`    属性分类: ${row.SXFL || row.sxfl}`);
                    logger.info(`    绑定URL: ${row.BD_URL || row.bd_url}`);
                    logger.info(`    执行顺序ID: ${row.ZXJSID || row.zxjsid}`);
                    logger.info(`    版块名称: ${row.BKMC || row.bkmc}`);
                    logger.info('');
                });
            } else {
                logger.warn('⚠️  验证警告: 未找到插入的记录');
            }
        } else {
            logger.info('ℹ️  没有新插入的记录需要验证');
        }

        logger.info('');
        logger.info('🎉 配置完成!');
        logger.info(`📊 统计信息:`);
        logger.info(`   新插入: ${insertedCount} 条`);
        logger.info(`   已跳过: ${skippedCount} 条`);
        logger.info(`   共计: ${insertedCount + skippedCount} 条`);
        if (insertedCount > 0) {
            logger.info(`   使用的SXBS范围: ${startSxbs} ~ ${startSxbs + insertedCount - 1}`);
        }

    } catch (err) {
        logger.error('');
        logger.error('❌ 操作失败:', err.message);
        logger.error('');
        logger.error('💡 故障排查建议:');
        logger.error('   1. 检查 server/config/datasources.json 中是否正确配置了该机构的数据源');
        logger.error('   2. 检查数据库连接是否正常');
        logger.error('   3. 检查 PT_JG_SX_CSH 表是否存在');
        logger.error('   4. 检查该机构是否已配置"对象定义"属性');
        logger.error('');
        process.exit(1);
    } finally {
        // Close database connections
        if (db.closeAll) {
            await db.closeAll();
        }
    }
}

setupBeibeiEntry();
EOF_NODE_SCRIPT

echo ""
echo "✨ 完成!"
