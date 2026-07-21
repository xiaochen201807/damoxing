const {
    EXPORT_DIALECTS,
    buildInsertStatement,
    buildAllDialectExportBodies,
    isOracleFamily,
    isPgFamily
} = require('../utils/ywbzkExportSql');

describe('ywbzk multi-dialect export SQL', () => {
    test('导出目标方言覆盖 Oracle/DM/PG/Gauss/Kingbase', () => {
        expect(EXPORT_DIALECTS.map(d => d.key)).toEqual([
            'oracle',
            'dm',
            'pg',
            'gauss',
            'kingbase'
        ]);
    });

    test('Oracle/DM 超长文本生成 CLOB 分段写入，不依赖源库类型', () => {
        const longText = '中文'.repeat(2000); // > 3000 utf8 bytes
        const row = { id: 1, ywbzjg: longText };
        const oracleSql = buildInsertStatement('gjj_ywbzk', row, 'oracle');
        const dmSql = buildInsertStatement('gjj_ywbzk', row, 'dm');

        expect(oracleSql).toContain('DECLARE');
        expect(oracleSql).toContain('CLOB');
        expect(oracleSql).toContain('dbms_lob.writeappend');
        expect(oracleSql).toContain('INSERT INTO gjj_ywbzk');
        expect(oracleSql).toContain('END;');

        expect(dmSql).toContain('DECLARE');
        expect(dmSql).toContain('dbms_lob.writeappend');
    });

    test('PG 系超长文本不使用 Oracle CLOB 语法', () => {
        const longText = 'A'.repeat(4000);
        const row = { id: 1, ywbzjg: longText };
        for (const dialect of ['pg', 'gauss', 'kingbase']) {
            const sql = buildInsertStatement('gjj_ywbzk', row, dialect);
            expect(sql).toContain('INSERT INTO gjj_ywbzk');
            expect(sql).not.toContain('DECLARE');
            expect(sql).not.toContain('dbms_lob');
            // dollar-quote or concat
            expect(sql.includes('$ywbzk$') || sql.includes(' || ')).toBe(true);
        }
    });

    test('日期格式按方言区分', () => {
        const row = { id: 1, cjsj: new Date('2026-07-21T01:02:03Z') };
        const oracleSql = buildInsertStatement('gjj_ywbzk', row, 'oracle');
        const pgSql = buildInsertStatement('gjj_ywbzk', row, 'pg');
        expect(oracleSql).toMatch(/TO_DATE\('/);
        expect(pgSql).toMatch(/TIMESTAMP '/);
        expect(pgSql).not.toContain('TO_DATE');
    });

    test('buildAllDialectExportBodies 为每个方言生成独立正文', () => {
        const datasets = {
            contentClasses: [{ id: 1, ywnrfl: '分类A' }],
            standards: [{ id: 1, ywblbz: '标准A', ywbzjg: 'select 1' }],
            attributes: [{ id: 1, mbid: 1, ywblbzsx: '属性A' }],
            mutualStandards: [{ id: 1, mbid: 1, hcmbid: 2 }]
        };
        const bodies = buildAllDialectExportBodies(datasets);
        expect(bodies).toHaveLength(5);
        for (const item of bodies) {
            expect(item.sqlBody).toContain('DELETE FROM gjj_ywbzk');
            expect(item.sqlBody).toContain('INSERT INTO gjj_ywbzk');
            expect(item.sqlBody).toContain(`目标方言: ${item.label}`);
            if (isOracleFamily(item.key)) {
                // short text no DECLARE required
                expect(item.sqlBody).toContain('INSERT INTO gjj_ywnrfl');
            }
            if (isPgFamily(item.key)) {
                expect(item.sqlBody).not.toContain('dbms_lob');
            }
        }
    });
});
