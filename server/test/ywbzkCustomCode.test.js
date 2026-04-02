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
}));

jest.mock('../middleware/auth', () => ({
    authenticateToken: (req, res, next) => next(),
}));

jest.mock('../utils/sqlDialectHelper', () => ({
    parseDialectSql: jest.fn(() => ({})),
    buildDialectSql: jest.fn(() => '[]'),
    validateDialectSqlObject: jest.fn(),
    DIALECT_LIST: [],
}));

const express = require('express');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const db = require('../db');
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
});
