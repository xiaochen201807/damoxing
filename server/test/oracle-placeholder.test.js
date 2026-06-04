describe('Oracle 占位符转换边界', () => {
  test('prepareOracleQuery：忽略字符串字面量内的 ?', () => {
    const { prepareOracleQuery } = require('@damoxing/datasource-manager');
    const input = "SELECT * FROM t WHERE a='?' AND b=? AND c='it''s ?' AND d=?";
    const { sql } = prepareOracleQuery(input, [1, 2]);
    expect(sql).toBe("SELECT * FROM t WHERE a='?' AND b=:1 AND c='it''s ?' AND d=:2");
  });

  test('prepareOracleQuery：与已有 :n 混用时从最大编号后续接', () => {
    const { prepareOracleQuery } = require('@damoxing/datasource-manager');
    const input = 'SELECT * FROM t WHERE a=:3 AND b=? AND c=:10 AND d=?';
    const { sql } = prepareOracleQuery(input, [1, 2]);
    expect(sql).toBe('SELECT * FROM t WHERE a=:3 AND b=:11 AND c=:10 AND d=:12');
  });

  test('prepareOracleQuery：无 ? 时保持不变', () => {
    const { prepareOracleQuery } = require('@damoxing/datasource-manager');
    const input = 'SELECT * FROM t WHERE a=:1';
    const { sql, params } = prepareOracleQuery(input, [1]);
    expect(sql).toBe(input);
    expect(params).toEqual([1]);
  });
});

describe('分页封装与占位符转换协作', () => {
  test('SqlHelper.paginateQuery (Oracle adapter) 产出 ?，交由 prepareOracleQuery 转换', () => {
    jest.resetModules();
    const SqlHelper = require('../utils/sqlHelper');
    const { prepareOracleQuery } = require('@damoxing/datasource-manager');

    const base = 'SELECT * FROM t ORDER BY id DESC';
    const { sql, params } = SqlHelper.paginateQuery(base, [], undefined, undefined, { isOracle: true });
    expect(sql).toContain('OFFSET ? ROWS FETCH NEXT ? ROWS ONLY');
    expect(params.length).toBe(2);

    const converted = prepareOracleQuery(sql, params);
    expect(converted.sql).toContain('OFFSET :1 ROWS FETCH NEXT :2 ROWS ONLY');
  });

  test('SqlHelper.paginateQuery：空/非法分页参数会被安全归一化', () => {
    process.env.ORACLE_ENABLE = 'false';
    process.env.DM_ENABLE = 'false';
    jest.resetModules();

    jest.doMock('fs', () => ({
      ...jest.requireActual('fs'),
      existsSync: jest.fn(() => false)
    }));

    const SqlHelper = require('../utils/sqlHelper');

    const base = 'SELECT * FROM t';
    const { sql, params } = SqlHelper.paginateQuery(base, [], 'NaN', -5);
    expect(sql).toContain('LIMIT ? OFFSET ?');
    expect(params[0]).toBeGreaterThanOrEqual(1);
    expect(params[1]).toBeGreaterThanOrEqual(0);

    jest.dontMock('fs');
  });
});
