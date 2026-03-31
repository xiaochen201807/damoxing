const {
    normalizeLegacyRows,
    buildOracleMergeSql,
} = require('../scripts/convert_legacy_ywnrfl');

describe('convert_legacy_ywnrfl script', () => {
    test('可以把旧接口结果转换为 gjj_ywnrfl 数据结构', () => {
        const rows = normalizeLegacyRows({
            status: 0,
            msg: 'ok',
            data: [
                {
                    label: '购买住房',
                    value: '1',
                    sequenceNumber: 1,
                    isShow: 1,
                },
                {
                    label: '租赁住房',
                    value: '5',
                    sequenceNumber: 5,
                    isShow: 0,
                },
            ],
        }, '1');

        expect(rows).toEqual([
            {
                gjsjsf: '1',
                flbm: '1',
                flmc: '购买住房',
                pxh: 1,
                sfqy: 1,
            },
            {
                gjsjsf: '1',
                flbm: '5',
                flmc: '租赁住房',
                pxh: 5,
                sfqy: 0,
            },
        ]);
    });

    test('可以生成 Oracle/达梦 MERGE SQL', () => {
        const sql = buildOracleMergeSql([
            {
                gjsjsf: '1',
                flbm: '1',
                flmc: '购买住房',
                pxh: 1,
                sfqy: 1,
            },
        ]);

        expect(sql).toContain('MERGE INTO gjj_ywnrfl t');
        expect(sql).toContain("SELECT '1' AS gjsjsf");
        expect(sql).toContain("t.gxsj = SYSTIMESTAMP");
        expect(sql).toContain('VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP)');
    });
});
