const {
    parseDialectSql,
    buildDialectSql,
    resolveSql,
    validateDialectSqlObject,
    DIALECT_LIST
} = require('../utils/sqlDialectHelper');

describe('sqlDialectHelper', () => {
    describe('DIALECT_LIST', () => {
        it('should have 6 dialects', () => {
            expect(DIALECT_LIST).toHaveLength(6);
            expect(DIALECT_LIST.map(d => d.key)).toEqual([
                'default', 'oracle', 'dm', 'gauss', 'kingbase', 'pg'
            ]);
        });
    });

    describe('parseDialectSql', () => {
        it('null / undefined / empty → 全空方言对象', () => {
            const r1 = parseDialectSql(null);
            expect(r1.default).toBe('');
            expect(r1.oracle).toBe('');

            const r2 = parseDialectSql(undefined);
            expect(r2.default).toBe('');

            const r3 = parseDialectSql('');
            expect(r3.default).toBe('');
        });

        it('旧版纯 SQL → 放入 default', () => {
            const r = parseDialectSql('SELECT * FROM t1 WHERE id = 1');
            expect(r.default).toBe('SELECT * FROM t1 WHERE id = 1');
            expect(r.oracle).toBe('');
            expect(r.dm).toBe('');
        });

        it('JSON 数组文本 → 正确拆解到对应 dialect', () => {
            const json = JSON.stringify([
                { dialect: 'default', sql: 'SELECT 1' },
                { dialect: 'oracle', sql: 'SELECT 1 FROM DUAL' },
                { dialect: 'dm', sql: 'SELECT 1 FROM DUAL_DM' }
            ]);
            const r = parseDialectSql(json);
            expect(r.default).toBe('SELECT 1');
            expect(r.oracle).toBe('SELECT 1 FROM DUAL');
            expect(r.dm).toBe('SELECT 1 FROM DUAL_DM');
            expect(r.gauss).toBe('');
            expect(r.kingbase).toBe('');
            expect(r.pg).toBe('');
        });

        it('非法 JSON（以 [ 开头但解析失败）→ 直接报错，避免静默当成旧版 SQL', () => {
            expect(() => parseDialectSql('[not valid json')).toThrow('不是合法的 JSON 数组文本');
        });

        it('JSON 中包含不支持的 dialect → 直接报错', () => {
            const json = JSON.stringify([{ dialect: 'mysql', sql: 'SELECT 1' }]);
            expect(() => parseDialectSql(json)).toThrow('包含不支持的 dialect');
        });
    });

    describe('buildDialectSql', () => {
        it('全空 → 返回空字符串', () => {
            expect(buildDialectSql({ default: '', oracle: '' })).toBe('');
        });

        it('null / undefined → 返回空字符串', () => {
            expect(buildDialectSql(null)).toBe('');
            expect(buildDialectSql(undefined)).toBe('');
        });

        it('仅 default → 返回纯 SQL（兼容旧格式）', () => {
            const r = buildDialectSql({ default: 'SELECT 1', oracle: '', dm: '' });
            expect(r).toBe('SELECT 1');
        });

        it('多方言 → 返回 JSON 数组文本', () => {
            const r = buildDialectSql({
                default: 'SELECT 1',
                oracle: 'SELECT 1 FROM DUAL',
                dm: '',
                gauss: '',
                kingbase: '',
                pg: ''
            });
            const parsed = JSON.parse(r);
            expect(parsed).toHaveLength(2);
            expect(parsed[0]).toEqual({ dialect: 'default', sql: 'SELECT 1' });
            expect(parsed[1]).toEqual({ dialect: 'oracle', sql: 'SELECT 1 FROM DUAL' });
        });

        it('存在不支持的方言键 → 直接报错', () => {
            expect(() => buildDialectSql({
                default: 'SELECT 1',
                mysql: 'SELECT 1'
            })).toThrow('包含不支持的方言键');
        });
    });

    describe('resolveSql', () => {
        const jsonStr = JSON.stringify([
            { dialect: 'default', sql: 'SELECT 1' },
            { dialect: 'oracle', sql: 'SELECT 1 FROM DUAL' }
        ]);

        it('当前数据库有专属 SQL → 返回专属', () => {
            expect(resolveSql(jsonStr, 'oracle')).toBe('SELECT 1 FROM DUAL');
        });

        it('当前数据库无专属 SQL → 回退到 default', () => {
            expect(resolveSql(jsonStr, 'pg')).toBe('SELECT 1');
        });

        it('旧版纯 SQL → 直接返回', () => {
            expect(resolveSql('SELECT * FROM t1', 'oracle')).toBe('SELECT * FROM t1');
        });

        it('空值 → 返回 null', () => {
            expect(resolveSql(null, 'oracle')).toBeNull();
            expect(resolveSql('', 'oracle')).toBeNull();
        });

        it('JSON 中既无专属又无 default → 返回 null', () => {
            const json = JSON.stringify([{ dialect: 'dm', sql: 'SELECT 1' }]);
            expect(resolveSql(json, 'oracle')).toBeNull();
        });

        it('非法 JSON → 直接报错，避免运行时静默回退', () => {
            expect(() => resolveSql('[not valid json', 'oracle')).toThrow('不是合法的 JSON 数组文本');
        });
    });

    describe('validateDialectSqlObject', () => {
        it('合法对象可以通过校验', () => {
            expect(validateDialectSqlObject({
                default: 'SELECT 1',
                oracle: 'SELECT 1 FROM DUAL'
            })).toEqual({
                default: 'SELECT 1',
                oracle: 'SELECT 1 FROM DUAL'
            });
        });

        it('不支持的方言键会报错', () => {
            expect(() => validateDialectSqlObject({
                default: 'SELECT 1',
                mysql: 'SELECT 1'
            })).toThrow('包含不支持的方言键');
        });

        it('非字符串值会报错', () => {
            expect(() => validateDialectSqlObject({
                default: { sql: 'SELECT 1' }
            })).toThrow('必须是字符串');
        });
    });
});
