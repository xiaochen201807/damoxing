/**
 * 数据初始化聚合打包服务
 * 汇集 标准库(ywbzk)、关键数据算法(ywbz)、程序规则控制(cxgzkz) 的初始化数据，
 * 输出紧凑的 Tabular JSON 结构，并支持目标机构码替换。
 */

const db = require('../db');
const logger = require('../utils/logger');

const TABLE_EXECUTION_ORDER = Object.freeze([
    'gjj_ywnrfl',
    'gjj_ywbzk',
    'gjj_ywbzksx',
    'gjj_ywbzkhc',
    'gjj_ywbz',
    'gjj_ywbzsx',
    'gjj_cxgzkz'
]);

/**
 * 将对象数组转换为紧凑的 Tabular 格式（列名数组 + 二维数据行数组）
 */
function rowsToTabular(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return { columns: [], rows: [] };
    }
    // 收集所有行可能出现的所有列名，保证完整性
    const colSet = new Set();
    for (const row of rows) {
        if (row && typeof row === 'object') {
            Object.keys(row).forEach(k => colSet.add(k));
        }
    }
    const columns = Array.from(colSet);
    const tabularRows = rows.map(row => {
        return columns.map(col => {
            const val = row?.[col];
            return val === undefined ? null : val;
        });
    });
    return { columns, rows: tabularRows };
}

/**
 * 抽取初始化全量数据
 * @param {object} options
 * @param {string} [options.sourceJgbh] - 源机构编号
 * @param {string} [options.sourceZjgbh] - 源子机构编号
 * @param {string} [options.targetJgbh] - 目标机构编号（若传入，将替换 ywbz 和 cxgzkz 中的 jgbh）
 * @param {string} [options.targetZjgbh] - 目标子机构编号（若传入，将替换 ywbz 和 cxgzkz 中的 zjgbh）
 * @param {string[]} [options.modules] - 需要抽取的模块列表，默认 ['ywbzk', 'ywbz', 'cxgzkz']
 */
async function getInitPackageData(options = {}) {
    const {
        sourceJgbh = '',
        sourceZjgbh = '',
        targetJgbh,
        targetZjgbh,
        modules = ['ywbzk', 'ywbz', 'cxgzkz']
    } = options;

    const moduleSet = new Set(Array.isArray(modules) ? modules : [modules]);
    const adapter = db.getByJgbh(typeof sourceJgbh !== 'undefined' ? sourceJgbh : '');
    const coalesce = 'COALESCE';

    const tablesData = {};
    const effectiveExecutionOrder = [];

    // -------------------------------------------------------------------------
    // 1. 标准库模块 (ywbzk: gjj_ywnrfl, gjj_ywbzk, gjj_ywbzksx, gjj_ywbzkhc)
    // -------------------------------------------------------------------------
    if (moduleSet.has('ywbzk')) {
        // 1.1 业务内容分类
        const contentClasses = await adapter.all('SELECT * FROM gjj_ywnrfl ORDER BY id');
        tablesData['gjj_ywnrfl'] = rowsToTabular(contentClasses);
        effectiveExecutionOrder.push('gjj_ywnrfl');

        // 1.2 标准库主表
        const standards = await adapter.all('SELECT * FROM gjj_ywbzk ORDER BY id');
        tablesData['gjj_ywbzk'] = rowsToTabular(standards);
        effectiveExecutionOrder.push('gjj_ywbzk');

        // 1.3 标准库属性表
        const standardAttrs = await adapter.all('SELECT * FROM gjj_ywbzksx ORDER BY ywid, id');
        tablesData['gjj_ywbzksx'] = rowsToTabular(standardAttrs);
        effectiveExecutionOrder.push('gjj_ywbzksx');

        // 1.4 标准库互斥表
        const mutuals = await adapter.all('SELECT * FROM gjj_ywbzkhc ORDER BY id');
        tablesData['gjj_ywbzkhc'] = rowsToTabular(mutuals);
        effectiveExecutionOrder.push('gjj_ywbzkhc');
    }

    // -------------------------------------------------------------------------
    // 2. 关键数据算法/模型模块 (ywbz: gjj_ywbz, gjj_ywbzsx)
    // -------------------------------------------------------------------------
    if (moduleSet.has('ywbz')) {
        let ywbzSql = `SELECT * FROM gjj_ywbz`;
        const ywbzParams = [];

        if (sourceJgbh !== undefined && sourceJgbh !== null && sourceJgbh !== '') {
            ywbzSql += ` WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
            ywbzParams.push(sourceJgbh, sourceZjgbh || '');
        }
        ywbzSql += ` ORDER BY id`;

        const ywbzRows = await adapter.all(ywbzSql, ywbzParams);

        // 如果传入了目标机构码，执行替换
        if (targetJgbh !== undefined && targetJgbh !== null) {
            ywbzRows.forEach(row => {
                row.jgbh = targetJgbh;
                if (targetZjgbh !== undefined && targetZjgbh !== null) {
                    row.zjgbh = targetZjgbh;
                }
            });
        }

        tablesData['gjj_ywbz'] = rowsToTabular(ywbzRows);
        effectiveExecutionOrder.push('gjj_ywbz');

        // 2.2 算法模型属性表
        const ywbzIds = ywbzRows.map(r => r.id || r.ID).filter(Boolean);
        let ywbzsxRows = [];
        if (ywbzIds.length > 0) {
            const placeholders = ywbzIds.map(() => '?').join(',');
            ywbzsxRows = await adapter.all(
                `SELECT * FROM gjj_ywbzsx WHERE ywid IN (${placeholders}) ORDER BY ywid, id`,
                ywbzIds
            );
        } else if (sourceJgbh === '') {
            // 如果未指定特定机构，直接查全部
            ywbzsxRows = await adapter.all(`SELECT * FROM gjj_ywbzsx ORDER BY ywid, id`);
        }
        tablesData['gjj_ywbzsx'] = rowsToTabular(ywbzsxRows);
        effectiveExecutionOrder.push('gjj_ywbzsx');
    }

    // -------------------------------------------------------------------------
    // 3. 程序规则控制模块 (cxgzkz: gjj_cxgzkz)
    // -------------------------------------------------------------------------
    if (moduleSet.has('cxgzkz')) {
        let cxgzkzSql = `SELECT * FROM gjj_cxgzkz`;
        const cxgzkzParams = [];

        if (sourceJgbh !== undefined && sourceJgbh !== null && sourceJgbh !== '') {
            cxgzkzSql += ` WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
            cxgzkzParams.push(sourceJgbh, sourceZjgbh || '');
        }
        cxgzkzSql += ` ORDER BY id`;

        const cxgzkzRows = await adapter.all(cxgzkzSql, cxgzkzParams);

        // 如果传入了目标机构码，执行替换
        if (targetJgbh !== undefined && targetJgbh !== null) {
            cxgzkzRows.forEach(row => {
                row.jgbh = targetJgbh;
                if (targetZjgbh !== undefined && targetZjgbh !== null) {
                    row.zjgbh = targetZjgbh;
                }
            });
        }

        tablesData['gjj_cxgzkz'] = rowsToTabular(cxgzkzRows);
        effectiveExecutionOrder.push('gjj_cxgzkz');
    }

    const totalRecordCount = Object.values(tablesData).reduce((sum, item) => sum + (item.rows?.length || 0), 0);

    logger.info(
        `[InitPackage] Data extracted: totalRecords=${totalRecordCount}, tables=${effectiveExecutionOrder.join(',')}, sourceJgbh=${sourceJgbh || '-'}, targetJgbh=${targetJgbh || '-'}`
    );

    return {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        meta: {
            sourceJgbh,
            sourceZjgbh,
            targetJgbh: targetJgbh || sourceJgbh,
            targetZjgbh: targetZjgbh || sourceZjgbh,
            modules: Array.from(moduleSet),
            totalRecords: totalRecordCount
        },
        executionOrder: effectiveExecutionOrder,
        tables: tablesData
    };
}

module.exports = {
    getInitPackageData,
    rowsToTabular,
    TABLE_EXECUTION_ORDER
};
