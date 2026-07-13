jest.mock('../db', () => ({
    getByJgbh: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../utils/business-algorithms', () => ({
    isValidAlgorithm: jest.fn(() => true),
}));

jest.mock('../utils/business-standard-access', () => ({
    isBusinessStandardMasterEnabled: jest.fn(() => true),
    getBusinessStandardWriteDeniedMessage: jest.fn(() => 'denied'),
    getBusinessStandardImportDisabledMessage: jest.fn(() => 'disabled'),
}));

jest.mock('../middleware/auth', () => ({
    authenticateToken: (req, res, next) => next(),
}));

jest.mock('../utils/sqlDialectHelper', () => ({
    parseDialectSql: jest.fn(() => ({})),
    buildDialectSql: jest.fn(() => '[]'),
    validateSqlText: jest.fn(),
    validateDialectSqlObject: jest.fn(),
    DIALECT_LIST: [],
}));

const express = require('express');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const db = require('../db');
const SqlHelper = require('../utils/sqlHelper');
const ywbzkRouter = require('../routes/http/ywbzk');

describe('ywbzk zdybm and ywblfl support', () => {
    let adapter;
    const exportFilePath = path.join(__dirname, '../exports/ywbzk_full_export.csv');

    beforeEach(() => {
        jest.clearAllMocks();
        adapter = {
            isOracle: false,
            all: jest.fn(),
            get: jest.fn(),
            run: jest.fn(),
            exec: jest.fn(),
            transaction: jest.fn(async (work) => work({
                run: adapter.run,
                get: adapter.get,
                all: adapter.all,
                exec: adapter.exec,
            })),
        };
        db.getByJgbh.mockReturnValue(adapter);
    });

    afterEach(() => {
        if (fs.existsSync(exportFilePath)) {
            fs.unlinkSync(exportFilePath);
        }
    });

    test('list 支持按自定义编码筛选', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get.mockResolvedValueOnce({ total: 1 });
        adapter.all.mockResolvedValueOnce([
            { id: 1, zdybm: 'STD_001' },
        ]);

        const response = await request(app)
            .post('/list')
            .send({
                zdybm: 'STD_001',
                jgbh: '1001',
            });

        expect(response.status).toBe(200);
        expect(adapter.get).toHaveBeenCalledWith(
            expect.stringContaining('zdybm LIKE ?'),
            ['%STD_001%']
        );
        expect(adapter.all).toHaveBeenCalledWith(
            expect.stringContaining('t.zdybm LIKE ?'),
            expect.arrayContaining(['%STD_001%'])
        );
    });

    test('save 会拦截重复自定义编码', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get.mockResolvedValueOnce({ id: 9 });

        const response = await request(app)
            .post('/save')
            .send({
                ywblbz: '测试标准',
                zdybm: 'STD_001',
                gjsjsf: '1',
                jgbh: '1001',
            });

        expect(response.status).toBe(400);
        expect(response.body.msg).toContain('自定义编码已存在');
    });

    test('save 新增时会写入提示语字段和自定义编码', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get.mockResolvedValueOnce(null);
        adapter.run.mockResolvedValueOnce({ lastID: 10 });

        const response = await request(app)
            .post('/save')
            .send({
                ywblbz: '测试标准',
                tsysxmc: '最高可贷额度',
                tsysxdw: '元',
                zdybm: 'STD_002',
                gjsjsf: '1',
                jgbh: '1001',
                ywblbzsxz: [],
            });

        expect(response.status).toBe(200);
        expect(adapter.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO gjj_ywbzk (pxh, ywblbz, tsysxmc, tsysxdw, zdybm'),
            expect.arrayContaining(['最高可贷额度', '元', 'STD_002'])
        );
    });

    test('save 编辑时会更新提示语字段', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.run.mockResolvedValue({ rowsAffected: 1 });

        const response = await request(app)
            .post('/save')
            .send({
                id: 10,
                ywblbz: '测试标准',
                tsysxmc: '最高可贷额度',
                tsysxdw: '万元',
                gjsjsf: '1',
                jgbh: '1001',
                ywblbzsxz: [],
            });

        expect(response.status).toBe(200);
        expect(adapter.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE gjj_ywbzk SET pxh=:1, ywblbz=:2, tsysxmc=:3, tsysxdw=:4'),
            expect.arrayContaining(['最高可贷额度', '万元', 10])
        );
    });

    test('save 会将自定义属性保存为页面录入模式', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get.mockResolvedValueOnce(null);
        adapter.run.mockResolvedValue({ lastID: 10, rowsAffected: 1 });

        const response = await request(app)
            .post('/save')
            .send({
                ywblbz: '测试标准',
                gjsjsf: '1',
                jgbh: '1001',
                ywblbzsxz: [
                    {
                        sfdxsx: '0',
                        zdsxmc: '提示金额',
                        zdsxbm: 'tipAmount',
                        ywblbzdx: 'SHOULD_IGNORE',
                        sxly: 'sql',
                        ywblbzyg: 'select 1'
                    }
                ],
            });

        expect(response.status).toBe(200);
        expect(adapter.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO gjj_ywbzksx'),
            [10, null, null, '提示金额', 'tipAmount', 'page', null]
        );
    });

    test('get 会将自定义属性回填为页面开关和手工输入字段', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get.mockResolvedValueOnce({
            id: 10,
            ywblbz: '测试标准',
            ywblfl: '1',
        });
        adapter.all
            .mockResolvedValueOnce([
                {
                    id: 21,
                    mbid: 10,
                    ywblbzdx: null,
                    fwdxbq: null,
                    sxbm: '提示金额',
                    ywblbzsx: 'tipAmount',
                    sxly: null,
                    ywblbzyg: null
                }
            ])
            .mockResolvedValueOnce([]);

        const response = await request(app)
            .post('/get')
            .send({
                id: 10,
                jgbh: '1001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.ywblbzsxz).toEqual([
            expect.objectContaining({
                sfdxsx: '0',
                zdsxmc: '提示金额',
                zdsxbm: 'tipAmount',
                sxly: 'page'
            })
        ]);
    });

    test('list 支持按业务办理分类筛选并默认回填历史值', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get.mockResolvedValueOnce({ total: 1 });
        adapter.all.mockResolvedValueOnce([
            { id: 1, ywblfl: null },
        ]);

        const response = await request(app)
            .post('/list')
            .send({
                ywblfl: '2',
                jgbh: '1001',
            });

        expect(response.status).toBe(200);
        expect(adapter.get).toHaveBeenCalledWith(
            expect.stringContaining("COALESCE(ywblfl, '1') = ?"),
            ['2']
        );
        expect(response.body.data.items[0].ywblfl).toBe('1');
    });

    test('save 会拦截非法业务办理分类编码', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);

        const response = await request(app)
            .post('/save')
            .send({
                ywblbz: '条件模板',
                ywblfl: '3',
                gjsjsf: '1',
                jgbh: '1001',
            });

        expect(response.status).toBe(400);
        expect(response.body.msg).toContain('无效的业务办理分类编码');
    });

    test('save 新增时会写入业务办理分类', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get.mockResolvedValueOnce(null);
        adapter.run.mockResolvedValueOnce({ lastID: 11 });

        const response = await request(app)
            .post('/save')
            .send({
                ywblbz: '条件模板',
                zdybm: 'COND_001',
                ywblfl: '2',
                gjsjsf: '1',
                jgbh: '1001',
                ywblbzsxz: [],
            });

        expect(response.status).toBe(200);
        expect(adapter.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO gjj_ywbzk'),
            expect.arrayContaining(['2'])
        );
    });

    test('save 会用两个绑定值清理互斥关系，兼容 Oracle 重复占位符限制', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get
            .mockResolvedValueOnce({ id: 1 });
        adapter.run.mockResolvedValue({ lastID: 12, rowsAffected: 1 });

        const response = await request(app)
            .post('/save')
            .send({
                ywblbz: '条件模板',
                ywblfl: '2',
                gjsjsf: '1',
                ywnrfl: 'A01',
                hcbzIds: [],
                jgbh: '1001',
                ywblbzsxz: [],
            });

        expect(response.status).toBe(200);
        expect(adapter.run).toHaveBeenCalledWith(
            'DELETE FROM gjj_ywbzkhc WHERE mbid = :1 OR hcmbid = :2',
            [12, 12]
        );
    });

    test('save 会校验互斥标准必须同算法同分类', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get.mockResolvedValueOnce({ id: 1 });
        adapter.all.mockResolvedValueOnce([{ id: 12 }]);

        const response = await request(app)
            .post('/save')
            .send({
                ywblbz: '标准模板',
                gjsjsf: '1',
                ywnrfl: 'A01',
                hcbzIds: ['11', '12'],
                jgbh: '1001',
                ywblbzsxz: [],
            });

        expect(response.status).toBe(400);
        expect(response.body.msg).toContain('同一关键数据算法和业务内容分类');
    });

    test('mutual-options 会按算法分类返回互斥候选项', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.all.mockResolvedValueOnce([
            { value: 2, label: '标准B' },
        ]);

        const response = await request(app)
            .post('/mutual-options')
            .send({
                id: 1,
                gjsjsf: '1',
                ywnrfl: 'A01',
                jgbh: '1001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([{ value: 2, label: '标准B' }]);
        expect(adapter.all).toHaveBeenCalledWith(
            expect.stringContaining('FROM gjj_ywbzk'),
            ['1', 'A01', 1]
        );
    });

    test('export 会包含业务内容分类表数据', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.all
            .mockResolvedValueOnce([
                { id: 1, gjsjsf: '1', flbm: 'A01', flmc: '购房类' },
            ])
            .mockResolvedValueOnce([
                { id: 10, ywblbz: '标准A', zdybm: 'STD_A', ywblfl: '1' },
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        const response = await request(app)
            .get('/export')
            .query({ jgbh: '1001' });

        expect(response.status).toBe(200);
        expect(adapter.all).toHaveBeenNthCalledWith(1, 'SELECT * FROM gjj_ywnrfl');
        const content = fs.readFileSync(exportFilePath, 'utf8');
        expect(content).toContain('DELETE FROM gjj_ywnrfl;');
        expect(content).toContain('INSERT INTO gjj_ywnrfl (id, gjsjsf, flbm, flmc)');
        expect(content).toContain("'A01'");
    });

    test('import 会执行业务内容分类表 SQL', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        const sql = [
            '-- 业务标准全量导入',
            'DELETE FROM gjj_ywnrfl;',
            "INSERT INTO gjj_ywnrfl (id, gjsjsf, flbm, flmc) VALUES (1, '1', 'A01', '购房类');",
            "INSERT INTO gjj_ywbzk (id, ywblbz, gjsjsf, ywnrfl, ywblfl) VALUES (10, '标准A', '1', 'A01', '1');",
        ].join('\n');

        const response = await request(app)
            .post('/import')
            .field('jgbh', '1001')
            .attach('file', Buffer.from(`\ufeff${sql}`, 'utf8'), 'ywbzk_import.csv');

        expect(response.status).toBe(200);
        expect(adapter.exec).toHaveBeenCalledWith('DELETE FROM gjj_ywnrfl');
        expect(adapter.exec).toHaveBeenCalledWith(
            "INSERT INTO gjj_ywnrfl (id, gjsjsf, flbm, flmc) VALUES (1, '1', 'A01', '购房类')"
        );
    });

    test('delete 会用两个绑定值清理互斥关系，兼容 Oracle 重复占位符限制', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.run.mockResolvedValue({ rowsAffected: 1 });

        const response = await request(app)
            .post('/delete')
            .send({
                id: 15,
                jgbh: '1001',
            });

        expect(response.status).toBe(200);
        expect(adapter.run).toHaveBeenNthCalledWith(
            1,
            'DELETE FROM gjj_ywbzkhc WHERE mbid = :1 OR hcmbid = :2',
            [15, 15]
        );
    });

    test('export - Oracle 模式下的长短文本及极端超长文本导出', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);

        // 设置为 Oracle 模式
        adapter.isOracle = true;

        const shortText = '短文本';
        const longText = '长文本'.repeat(1000); // 3000字符
        const extremeText = '超长文本'.repeat(10000); // 40000字符，超过 32k 限制
        const chinese1334 = '中'.repeat(1334); // 1334字符，由于 1334*3 = 4002 字节 > 3000 字节，应该进入 CLOB 分段
        const emojiText = '😀'.repeat(1005); // 1005个emoji，字节数 4020 > 3000 字节，应该进入 CLOB 分段，且第二段 writeappend 长度是 5

        adapter.all
            .mockResolvedValueOnce([]) // gjj_ywnrfl
            .mockResolvedValueOnce([
                { id: 201, ywblbz: shortText, zdybm: 'STD_S', ywbzjg: shortText },
                { id: 202, ywblbz: shortText, zdybm: 'STD_L', ywbzjg: longText },
                { id: 203, ywblbz: shortText, zdybm: 'STD_E', ywbzjg: extremeText },
                { id: 204, ywblbz: shortText, zdybm: 'STD_C', ywbzjg: chinese1334 },
                { id: 205, ywblbz: shortText, zdybm: 'STD_MJ', ywbzjg: emojiText },
            ]) // gjj_ywbzk
            .mockResolvedValueOnce([]) // gjj_ywbzksx
            .mockResolvedValueOnce([]); // gjj_ywbzkhc

        const response = await request(app)
            .get('/export')
            .query({ jgbh: '1001' });

        expect(response.status).toBe(200);
        const content = fs.readFileSync(exportFilePath, 'utf8');

        // 1. 短文本记录验证：应该是普通 INSERT
        expect(content).toContain("INSERT INTO gjj_ywbzk (id, ywblbz, zdybm, ywbzjg) VALUES (201, '短文本', 'STD_S', '短文本');");

        // 2. 长文本（3000字符）验证：应该是 PL/SQL + dbms_lob.writeappend 拼接 3 段
        expect(content).toContain("DECLARE\n    v_clob_1 CLOB;");
        expect(content).toContain("v_clob_1 := '长文本"); // 第一段初始化
        expect(content).toContain("dbms_lob.writeappend(v_clob_1, 1000"); // 追加写入验证
        expect(content).toContain("INSERT INTO gjj_ywbzk (id, ywblbz, zdybm, ywbzjg) VALUES (202, '短文本', 'STD_L', v_clob_1);");

        // 3. 极端超长文本（40000字符）验证：应该拼接 40 段
        expect(content).toContain("v_clob_1 := '超长文本");

        // 4. 1334 个中文字符的字节边界验证
        expect(content).toContain("DECLARE\n    v_clob_1 CLOB;");
        // 应该分段：第一段 1000 个字，第二段 334 个字
        expect(content).toContain("dbms_lob.writeappend(v_clob_1, 334, '" + '中'.repeat(334) + "');");
        expect(content).toContain("INSERT INTO gjj_ywbzk (id, ywblbz, zdybm, ywbzjg) VALUES (204, '短文本', 'STD_C', v_clob_1);");

        // 5. Emoji 边界和精确字符个数（Unicode 代理对）验证
        // 应该分段：第一段 1000 个 emoji，第二段 5 个 emoji，writeappend 的长度必须是 5 而不是其 UTF-16 长度 10
        expect(content).toContain("dbms_lob.writeappend(v_clob_1, 5, '" + '😀'.repeat(5) + "');");
        expect(content).toContain("INSERT INTO gjj_ywbzk (id, ywblbz, zdybm, ywbzjg) VALUES (205, '短文本', 'STD_MJ', v_clob_1);");

        // 计算 writeappend 的总出现次数，验证分切份数是否正确
        const writeappendMatches = content.match(/dbms_lob\.writeappend/g) || [];
        // 长文本 3000 字符：分 3 段，writeappend 2 次
        // 极端文本 40000 字符：分 40 段，writeappend 39 次
        // 1334 汉字：分 2 段，writeappend 1 次
        // 1005 emoji：分 2 段，writeappend 1 次
        // 总数应该是 2 + 39 + 1 + 1 = 43 次
        expect(writeappendMatches.length).toBe(43);
    });

    test('export - PG/Kingbase 模式下的长文本导出', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);

        // 设置为非 Oracle 模式
        adapter.isOracle = false;

        const longText = 'PG长文本'.repeat(1000); // 5000字符

        adapter.all
            .mockResolvedValueOnce([]) // gjj_ywnrfl
            .mockResolvedValueOnce([
                { id: 301, ywblbz: 'PG标准', zdybm: 'STD_PG', ywbzjg: longText },
            ]) // gjj_ywbzk
            .mockResolvedValueOnce([]) // gjj_ywbzksx
            .mockResolvedValueOnce([]); // gjj_ywbzkhc

        const response = await request(app)
            .get('/export')
            .query({ jgbh: '1001' });

        expect(response.status).toBe(200);
        const content = fs.readFileSync(exportFilePath, 'utf8');

        // 验证非 Oracle 模式下长文本仍生成常规 INSERT 语句，且内容完整
        expect(content).toContain("INSERT INTO gjj_ywbzk (id, ywblbz, zdybm, ywbzjg)");
        expect(content).toContain("PG长文本");
        expect(content).not.toContain("DECLARE");
        expect(content).not.toContain("dbms_lob.writeappend");
    });

    test('splitSqlStatements 算法：PL/SQL 块与普通语句混合隔离切分测试', () => {
        const mixedSql = [
            "DELETE FROM test_table;",
            "DECLARE",
            "    v_clob CLOB;",
            "BEGIN",
            "    v_clob := 'part1';",
            "    dbms_lob.writeappend(v_clob, 5, 'part2');",
            "    INSERT INTO test_table VALUES (v_clob);",
            "END;",
            "/",
            "INSERT INTO test_table VALUES ('normal');"
        ].join('\n');

        const statements = SqlHelper.splitSqlStatements(mixedSql);

        expect(statements.length).toBe(3);
        expect(statements[0]).toBe("DELETE FROM test_table");
        expect(statements[1]).toContain("DECLARE");
        expect(statements[1]).toContain("dbms_lob.writeappend");
        expect(statements[1]).toContain("INSERT INTO test_table VALUES (v_clob);");
        expect(statements[1]).toContain("END;");
        expect(statements[1]).not.toContain("/"); // 验证斜杠被成功剥离
        expect(statements[2]).toBe("INSERT INTO test_table VALUES ('normal')");
    });
});
