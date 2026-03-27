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

jest.mock('../utils/sqlDialectHelper', () => ({
    parseDialectSql: jest.fn(() => ({})),
    buildDialectSql: jest.fn(() => '[]'),
    validateDialectSqlObject: jest.fn(),
    DIALECT_LIST: [],
}));

const express = require('express');
const request = require('supertest');
const db = require('../db');
const ywbzkRouter = require('../routes/http/ywbzk');

describe('ywbzk zdybm and ywblfl support', () => {
    let adapter;

    beforeEach(() => {
        jest.clearAllMocks();
        adapter = {
            isOracle: false,
            all: jest.fn(),
            get: jest.fn(),
            run: jest.fn(),
            transaction: jest.fn(async (work) => work({
                run: adapter.run,
                get: adapter.get,
                all: adapter.all,
            })),
        };
        db.getByJgbh.mockReturnValue(adapter);
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

    test('save 新增时会写入自定义编码', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get.mockResolvedValueOnce(null);
        adapter.run.mockResolvedValueOnce({ lastID: 10 });

        const response = await request(app)
            .post('/save')
            .send({
                ywblbz: '测试标准',
                zdybm: 'STD_002',
                gjsjsf: '1',
                jgbh: '1001',
                ywblbzsxz: [],
            });

        expect(response.status).toBe(200);
        expect(adapter.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO gjj_ywbzk'),
            expect.arrayContaining(['STD_002'])
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
});
