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
    getAlgorithms: jest.fn(() => []),
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

jest.mock('../services/gatewayService', () => ({
    fetchPublicParamValue: jest.fn(),
}));

jest.mock('axios', () => ({
    post: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const axios = require('axios');
const db = require('../db');
const toolsRouter = require('../routes/http/tools');
const ywnrflRouter = require('../routes/http/ywnrfl');
const ywbzkRouter = require('../routes/http/ywbzk');

describe('business content class upgrade', () => {
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

    test('tools/business-content-classes 从本地表按算法过滤启用分类', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', toolsRouter);
        adapter.all.mockResolvedValue([
            { value: 'A01', label: '购房', gjsjsf: '1', sfqy: 1 },
        ]);

        const response = await request(app)
            .post('/business-content-classes')
            .send({ gjsjsf: '1', jgbh: '1001' });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([
            expect.objectContaining({
                value: 'A01',
                label: '购房',
            }),
        ]);
        expect(adapter.all).toHaveBeenCalledWith(
            expect.stringContaining('FROM gjj_ywnrfl'),
            [1, '1']
        );
    });

    test('tools/business-content-class-options 保留网关属性选项能力', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', toolsRouter);
        axios.post.mockResolvedValue({
            status: 200,
            data: {
                results: [
                    { name: '贷款状态', coding: 'DKZT' },
                ],
            },
        });

        const response = await request(app)
            .post('/business-content-class-options')
            .set('login-token', 'token-1')
            .send({
                jgbh: '1001',
                syObjectNumber: '03124',
                fieldIdentification: 'loanStatus',
            });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([
            expect.objectContaining({
                label: '贷款状态',
                value: 'DKZT',
            }),
        ]);
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining('objectAttributeOptionScope'),
            expect.objectContaining({
                organizationNumber: '1001',
                syObjectNumber: '03124',
                fieldIdentification: 'loanStatus',
            }),
            expect.any(Object)
        );
    });

    test('ywnrfl/save 拒绝同算法下重复分类编码', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywnrflRouter);
        adapter.get.mockResolvedValueOnce({ id: 9 });

        const response = await request(app)
            .post('/save')
            .send({
                gjsjsf: '1',
                flbm: 'A01',
                flmc: '购房',
                jgbh: '1001',
            });

        expect(response.status).toBe(400);
        expect(response.body.msg).toContain('不能重复');
    });

    test('ywnrfl/delete 在被引用时阻止删除', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywnrflRouter);
        adapter.get
            .mockResolvedValueOnce({ id: 1, gjsjsf: '1', flbm: 'A01' })
            .mockResolvedValueOnce({ total: 1 })
            .mockResolvedValueOnce({ total: 0 });

        const response = await request(app)
            .post('/delete')
            .send({ id: 1, jgbh: '1001' });

        expect(response.status).toBe(400);
        expect(response.body.msg).toContain('已被标准库或业务规则引用');
    });

    test('ywbzk/save 校验业务内容分类必须存在', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);
        adapter.get.mockResolvedValueOnce(null);

        const response = await request(app)
            .post('/save')
            .send({
                ywblbz: '测试标准',
                gjsjsf: '1',
                ywnrfl: 'A01',
                jgbh: '1001',
            });

        expect(response.status).toBe(400);
        expect(response.body.msg).toContain('业务内容分类不存在');
    });
});
