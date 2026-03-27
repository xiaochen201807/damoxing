const express = require('express');
const router = express.Router();
const db = require('../../db');
const SqlHelper = require('../../utils/sqlHelper');
const logger = require('../../utils/logger');
const algorithmConfig = require('../../utils/business-algorithms');
const { isBusinessStandardMasterEnabled, getBusinessStandardWriteDeniedMessage } = require('../../utils/business-standard-access');

function getRequestJgbh(req) {
    return req.body?.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
}

function normalizeStatus(value) {
    if (value === undefined || value === null || value === '') {
        return 1;
    }

    if (value === 0 || value === '0' || value === false || value === 'false') {
        return 0;
    }

    return 1;
}

function getCountValue(row) {
    if (!row) {
        return 0;
    }

    return row.total || row.TOTAL || 0;
}

router.post('/list', async (req, res) => {
    const { page = 1, perPage = 10, gjsjsf, flbm, flmc, sfqy } = req.body;
    const jgbh = getRequestJgbh(req);
    const offset = (page - 1) * perPage;
    const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
    let sql = 'SELECT * FROM gjj_ywnrfl WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM gjj_ywnrfl WHERE 1=1';
    const params = [];

    if (gjsjsf) {
        sql += ' AND gjsjsf = ?';
        countSql += ' AND gjsjsf = ?';
        params.push(gjsjsf);
    }

    if (flbm) {
        sql += ' AND flbm LIKE ?';
        countSql += ' AND flbm LIKE ?';
        params.push(`%${flbm}%`);
    }

    if (flmc) {
        sql += ' AND flmc LIKE ?';
        countSql += ' AND flmc LIKE ?';
        params.push(`%${flmc}%`);
    }

    if (sfqy !== undefined && sfqy !== null && sfqy !== '') {
        sql += ' AND sfqy = ?';
        countSql += ' AND sfqy = ?';
        params.push(normalizeStatus(sfqy));
    }

    sql += ' ORDER BY pxh ASC, id ASC';
    const paged = SqlHelper.paginateQuery(sql, params, perPage, offset, _adapter);

    try {
        const countRow = await _adapter.get(countSql, params);
        const rows = await _adapter.all(paged.sql, paged.params);
        res.json({
            status: 0,
            msg: 'ok',
            data: {
                items: rows,
                total: getCountValue(countRow),
            },
        });
    } catch (err) {
        logger.error(`Failed to query ywnrfl: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

router.post('/save', async (req, res) => {
    const jgbh = getRequestJgbh(req);
    const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
    const id = req.body.id;
    const gjsjsf = String(req.body.gjsjsf || '').trim();
    const flbm = String(req.body.flbm || '').trim();
    const flmc = String(req.body.flmc || '').trim();
    const pxh = Number(req.body.pxh || 0);
    const sfqy = normalizeStatus(req.body.sfqy);

    if (!isBusinessStandardMasterEnabled(req)) {
        return res.status(403).json({ status: 403, msg: getBusinessStandardWriteDeniedMessage() });
    }

    if (!gjsjsf) {
        return res.status(400).json({ status: 1, msg: '关键数据算法不能为空' });
    }

    if (!algorithmConfig.isValidAlgorithm(gjsjsf)) {
        return res.status(400).json({ status: 1, msg: `无效的关键数据算法编码: ${gjsjsf}` });
    }

    if (!flbm) {
        return res.status(400).json({ status: 1, msg: '业务内容分类编码不能为空' });
    }

    if (!flmc) {
        return res.status(400).json({ status: 1, msg: '业务内容分类名称不能为空' });
    }

    try {
        const duplicateSql = id
            ? 'SELECT id FROM gjj_ywnrfl WHERE gjsjsf = ? AND flbm = ? AND id <> ?'
            : 'SELECT id FROM gjj_ywnrfl WHERE gjsjsf = ? AND flbm = ?';
        const duplicateParams = id ? [gjsjsf, flbm, id] : [gjsjsf, flbm];
        const duplicateRow = await _adapter.get(duplicateSql, duplicateParams);

        if (duplicateRow) {
            return res.status(400).json({ status: 1, msg: '同一关键数据算法下业务内容分类编码不能重复' });
        }

        const result = await _adapter.transaction(async (tx) => {
            if (id) {
                await tx.run(
                    `UPDATE gjj_ywnrfl SET gjsjsf = ?, flbm = ?, flmc = ?, pxh = ?, sfqy = ?, gxsj = ${SqlHelper.now(_adapter)} WHERE id = ?`,
                    [gjsjsf, flbm, flmc, pxh, sfqy, id]
                );
                return { id };
            }

            const insertResult = await tx.run(
                'INSERT INTO gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy) VALUES (?, ?, ?, ?, ?)',
                [gjsjsf, flbm, flmc, pxh, sfqy]
            );
            return { id: insertResult.lastID };
        });

        res.json({ status: 0, msg: '保存成功', data: result });
    } catch (err) {
        logger.error(`Failed to save ywnrfl: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

router.post('/delete', async (req, res) => {
    const jgbh = getRequestJgbh(req);
    const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
    const { id } = req.body;

    if (!isBusinessStandardMasterEnabled(req)) {
        return res.status(403).json({ status: 403, msg: getBusinessStandardWriteDeniedMessage() });
    }

    if (!id) {
        return res.status(400).json({ status: 1, msg: 'ID is required' });
    }

    try {
        const current = await _adapter.get('SELECT * FROM gjj_ywnrfl WHERE id = ?', [id]);

        if (!current) {
            return res.status(404).json({ status: 1, msg: 'Record not found' });
        }

        const gjsjsf = current.gjsjsf || current.GJSJSF;
        const flbm = current.flbm || current.FLBM;
        const templateRef = await _adapter.get(
            'SELECT COUNT(*) as total FROM gjj_ywbzk WHERE gjsjsf = ? AND ywnrfl = ?',
            [gjsjsf, flbm]
        );
        const ruleRef = await _adapter.get(
            'SELECT COUNT(*) as total FROM gjj_ywbz WHERE ywsf = ? AND ywnrfl = ?',
            [gjsjsf, flbm]
        );

        if (getCountValue(templateRef) > 0 || getCountValue(ruleRef) > 0) {
            return res.status(400).json({ status: 1, msg: '该业务内容分类已被标准库或业务规则引用，无法删除' });
        }

        await _adapter.run('DELETE FROM gjj_ywnrfl WHERE id = ?', [id]);
        res.json({ status: 0, msg: '删除成功' });
    } catch (err) {
        logger.error(`Failed to delete ywnrfl: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

module.exports = router;
