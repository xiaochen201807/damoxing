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

jest.mock('../services/gatewayService', () => ({
    fetchPublicParamValue: jest.fn(),
    gatewayRequest: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
    authenticateToken: (req, res, next) => next(),
}));

const express = require('express');
const request = require('supertest');
const db = require('../db');
const ywbzRouter = require('../routes/http/ywbz');

describe('ywbz config_form value reflection', () => {
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

    test('config_form 会在没有明细时带出当前业务标准值', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);

        adapter.get.mockResolvedValueOnce({
            id: 1,
            mbid: 10,
            gzmc: '规则A',
            ywbzz: '36',
            template_name: '模板A',
        });
        adapter.all
            .mockResolvedValueOnce([
                { sxbm: '贷款情况', ywblbzsx: 'loanStatus', fwdxbq: '缴存人', ywblbzdx: 'DX001' },
            ])
            .mockResolvedValueOnce([]);

        const response = await request(app)
            .post('/config_form')
            .send({
                id: 1,
                mbid: 999,
                jgbh: '1001',
            });

        expect(response.status).toBe(200);
        expect(adapter.all).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('FROM gjj_ywbzksx WHERE mbid = ?'),
            [10]
        );

        expect(response.body.data.body.some(item => item.type === 'grid')).toBe(false);
        expect(response.body.data.body.some(item => item.type === 'alert')).toBe(false);
        const combo = response.body.data.body.find(item => item.type === 'combo');
        expect(combo.value).toEqual([{ result: '36' }]);
    });

    test('config_form 会保留结果和参数中的 0 值', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);

        adapter.get.mockResolvedValueOnce({
            id: 1,
            mbid: 10,
            gzmc: '规则A',
            ywbzz: 0,
            template_name: '模板A',
        });
        adapter.all
            .mockResolvedValueOnce([
                { sxbm: '贷款情况', ywblbzsx: 'loanStatus', fwdxbq: '缴存人', ywblbzdx: 'DX001' },
            ])
            .mockResolvedValueOnce([
                { id: 99, result: 0, k1: 'loanStatus', v1: 0 },
            ]);

        const response = await request(app)
            .post('/config_form')
            .send({
                id: 1,
                mbid: 10,
                jgbh: '1001',
            });

        expect(response.status).toBe(200);

        const combo = response.body.data.body.find(item => item.type === 'combo');
        expect(combo.value).toEqual([
            expect.objectContaining({
                id: 99,
                loanStatus: 0,
                result: 0,
            }),
        ]);
    });

    test('config_form 会将自定义属性渲染为文本输入框', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);

        adapter.get.mockResolvedValueOnce({
            id: 1,
            mbid: 10,
            gzmc: '规则A',
            ywbzz: '36',
            template_name: '模板A',
        });
        adapter.all
            .mockResolvedValueOnce([
                { sxbm: '贷款情况', ywblbzsx: 'loanStatus', fwdxbq: '缴存人', ywblbzdx: 'DX001' },
                { sxbm: '提示金额', ywblbzsx: 'tipAmount', fwdxbq: null, ywblbzdx: null },
            ])
            .mockResolvedValueOnce([]);

        const response = await request(app)
            .post('/config_form')
            .send({
                id: 1,
                mbid: 10,
                jgbh: '1001',
            });

        expect(response.status).toBe(200);

        const combo = response.body.data.body.find(item => item.type === 'combo');
        const loanStatusField = combo.items.find(item => item.name === 'loanStatus');
        const tipAmountField = combo.items.find(item => item.name === 'tipAmount');

        expect(loanStatusField).toMatchObject({
            type: 'select',
            label: '缴存人-贷款情况'
        });
        expect(tipAmountField).toMatchObject({
            type: 'input-text',
            label: '提示金额'
        });
    });

    test('save_params 会保留结果和参数中的 0 值', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);

        adapter.get.mockResolvedValueOnce({ mbid: 10 });
        adapter.all.mockResolvedValueOnce([
            { ywblbzsx: 'loanStatus' },
        ]);

        const response = await request(app)
            .post('/save_params')
            .send({
                id: 1,
                jgbh: '1001',
                rules: [
                    {
                        loanStatus: 0,
                        result: 0,
                    },
                ],
            });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe(0);
        expect(adapter.run).toHaveBeenCalledTimes(2);

        const insertParams = adapter.run.mock.calls[1][1];
        expect(insertParams[0]).toBe(1);
        expect(insertParams[1]).toBe(0);
        expect(insertParams[2]).toBe(0);
        expect(insertParams[3]).toBe('loanStatus');
        expect(insertParams[4]).toBe(0);
    });

    test('GET /:id 会保留结果和参数中的 0 值', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);

        adapter.get.mockResolvedValueOnce({
            id: 1,
            gzmc: '规则A',
        });
        adapter.all.mockResolvedValueOnce([
            { id: 99, result: 0, k1: 'loanStatus', v1: 0 },
        ]);

        const response = await request(app)
            .get('/1')
            .query({ jgbh: '1001' });

        expect(response.status).toBe(200);
        expect(response.body.data.rule_params).toEqual({
            loanStatus: 0,
            result: 0,
        });
    });
});
