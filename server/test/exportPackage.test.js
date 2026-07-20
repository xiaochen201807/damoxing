const {
    PACKAGE_TYPES,
    PACKAGE_SCOPES,
    EXECUTION_MODES,
    buildExportFileName,
    assembleExportScript,
    parsePackageHeader,
    validateYwbzImportPackage,
    splitSqlStatements,
    isAllowedExportHistoryName
} = require('../utils/exportPackage');

describe('exportPackage 防呆工具', () => {
    test('文件名可区分标准库与关键数据计算模型', () => {
        const ywbzk = buildExportFileName({
            packageType: PACKAGE_TYPES.YWBZK,
            scope: PACKAGE_SCOPES.FULL,
            timestamp: '20260720_120000'
        });
        const ywbz = buildExportFileName({
            packageType: PACKAGE_TYPES.YWBZ,
            scope: PACKAGE_SCOPES.FULL,
            jgbh: '1305282025',
            timestamp: '20260720_120000'
        });
        expect(ywbzk).toBe('业务标准库_ywbzk_全量_20260720_120000.sql');
        expect(ywbz).toBe('关键数据计算模型_ywbz_全量_1305282025_20260720_120000.sql');
        expect(ywbzk).not.toEqual(ywbz);
        expect(ywbzk.endsWith('.sql')).toBe(true);
        expect(ywbz.includes('ywbzk')).toBe(false);
    });

    test('assemble + parse package 头', () => {
        const body = "INSERT INTO gjj_ywbz (id) VALUES (1);\n";
        const { content, contentSha256 } = assembleExportScript({
            packageType: PACKAGE_TYPES.YWBZ,
            scope: PACKAGE_SCOPES.FULL,
            executionMode: EXECUTION_MODES.APP_IMPORT,
            jgbh: '1',
            zjgbh: '2',
            recordCount: 1,
            tables: ['gjj_ywbz', 'gjj_ywbzsx'],
            operator: 'tester'
        }, body);
        const header = parsePackageHeader(content);
        expect(header).not.toBeNull();
        expect(header.packageType).toBe('ywbz');
        expect(header.executionMode).toBe('app-import');
        expect(header.contentSha256).toBe(contentSha256);
        expect(header.jgbh).toBe('1');
    });

    test('拒绝将标准库脚本导入关键数据计算模型', () => {
        const body = "DELETE FROM gjj_ywbzk;\nINSERT INTO gjj_ywbzk (id) VALUES (1);\n";
        const { content } = assembleExportScript({
            packageType: PACKAGE_TYPES.YWBZK,
            scope: PACKAGE_SCOPES.FULL,
            executionMode: EXECUTION_MODES.DB_ONLY,
            recordCount: 1,
            tables: ['gjj_ywbzk']
        }, body);
        const result = validateYwbzImportPackage(content);
        expect(result.ok).toBe(false);
        expect(result.msg).toMatch(/业务标准库/);
    });

    test('拒绝无头但含标准库表的脚本', () => {
        const sql = "-- old\nINSERT INTO gjj_ywbzk (id) VALUES (1);\nINSERT INTO gjj_ywbzksx (id) VALUES (1);";
        const result = validateYwbzImportPackage(sql);
        expect(result.ok).toBe(false);
        expect(result.msg).toMatch(/业务标准库表|gjj_ywbzk/);
    });

    test('允许合法关键数据计算模型脚本', () => {
        const body = "INSERT INTO gjj_ywbz (id, mbid) VALUES (1, 2);\nINSERT INTO gjj_ywbzsx (id, ywid) VALUES (1, 1);\n";
        const { content } = assembleExportScript({
            packageType: PACKAGE_TYPES.YWBZ,
            scope: PACKAGE_SCOPES.FULL,
            executionMode: EXECUTION_MODES.APP_IMPORT,
            recordCount: 1,
            tables: ['gjj_ywbz', 'gjj_ywbzsx']
        }, body);
        const result = validateYwbzImportPackage(content, { statements: splitSqlStatements(content) });
        expect(result.ok).toBe(true);
        expect(result.tables.sort()).toEqual(['gjj_ywbz', 'gjj_ywbzsx']);
    });

    test('isAllowedExportHistoryName 覆盖新旧命名', () => {
        expect(isAllowedExportHistoryName('业务标准库_ywbzk_全量_20260720_120000.sql')).toBe(true);
        expect(isAllowedExportHistoryName('关键数据计算模型_ywbz_全量_1_20260720_120000.sql')).toBe(true);
        expect(isAllowedExportHistoryName('ywbz_full_export.csv')).toBe(true);
        expect(isAllowedExportHistoryName('ywbzk_full_export.csv')).toBe(true);
        expect(isAllowedExportHistoryName('../etc/passwd')).toBe(false);
        expect(isAllowedExportHistoryName('other.sql')).toBe(false);
    });
});
