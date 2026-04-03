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

const express = require('express');
const request = require('supertest');
const db = require('../db');
const logger = require('../utils/logger');
const { fetchPublicParamValue } = require('../services/gatewayService');
const ywbzRouter = require('../routes/http/ywbz');

describe('ywbz selection_list display_ywblbz support', () => {
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

    function createApp() {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        return app;
    }

    test('selection_list 会用公共参数实际值替换全部 X', async () => {
        const app = createApp();
        adapter.all
            .mockResolvedValueOnce([
                { id: 1, ywblbz: '提取金额不得超过X', ywbzz: '1_bz_1762242182359' },
                { id: 2, ywblbz: 'X至X之间', ywbzz: '1_bz_1762242182359' },
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        fetchPublicParamValue.mockResolvedValue({ value: '10000' });

        const response = await request(app)
            .post('/selection_list')
            .send({
                gjsjsf: '1',
                ywnrfl: 'A01',
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.items).toEqual([
            expect.objectContaining({
                id: 1,
                display_ywblbz: '提取金额不得超过10000',
            }),
            expect.objectContaining({
                id: 2,
                display_ywblbz: '10000至10000之间',
            }),
        ]);
        expect(fetchPublicParamValue).toHaveBeenCalledTimes(1);
        expect(fetchPublicParamValue).toHaveBeenCalledWith(
            '1_bz_1762242182359',
            '1001',
            '2001',
            expect.objectContaining({
                channel: '',
                'login-token': '',
                zzbs: '',
                zzjgdmz: ''
            })
        );
    });

    test('selection_list 在无 X 或 ywbzz 为空时保持原文案且不查公共参数', async () => {
        const app = createApp();
        adapter.all
            .mockResolvedValueOnce([
                { id: 1, ywblbz: '标准A', ywbzz: '1_bz_1762242182359' },
                { id: 2, ywblbz: '提取金额不得超过X', ywbzz: '' },
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        const response = await request(app)
            .post('/selection_list')
            .send({
                gjsjsf: '1',
                ywnrfl: 'A01',
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.items).toEqual([
            expect.objectContaining({
                id: 1,
                display_ywblbz: '标准A',
            }),
            expect.objectContaining({
                id: 2,
                display_ywblbz: '提取金额不得超过X',
            }),
        ]);
        expect(fetchPublicParamValue).not.toHaveBeenCalled();
    });

    test('selection_list 在公共参数返回空值时回退原始文案', async () => {
        const app = createApp();
        adapter.all
            .mockResolvedValueOnce([
                { id: 1, ywblbz: '提取金额不得超过X', ywbzz: '1_bz_empty' },
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        fetchPublicParamValue.mockResolvedValue({});

        const response = await request(app)
            .post('/selection_list')
            .send({
                gjsjsf: '1',
                ywnrfl: 'A01',
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.items).toEqual([
            expect.objectContaining({
                id: 1,
                display_ywblbz: '提取金额不得超过X',
            }),
        ]);
    });

    test('selection_list 在公共参数查询异常时回退原始文案并继续返回列表', async () => {
        const app = createApp();
        adapter.all
            .mockResolvedValueOnce([
                { id: 1, ywblbz: '提取金额不得超过X', ywbzz: '1_bz_error' },
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        fetchPublicParamValue.mockRejectedValue(new Error('gateway unavailable'));

        const response = await request(app)
            .post('/selection_list')
            .send({
                gjsjsf: '1',
                ywnrfl: 'A01',
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.items).toEqual([
            expect.objectContaining({
                id: 1,
                display_ywblbz: '提取金额不得超过X',
            }),
        ]);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Failed to fetch value for 1_bz_error')
        );
    });

    test('list 会用规则当前值生成 display_ywblbz，且保留原 template_name', async () => {
        const app = createApp();
        adapter.get.mockResolvedValue({ total: 2 });
        adapter.all.mockResolvedValue([
            { id: 1, template_name: '提取金额不得超过X', ywbzz: '10000' },
            { id: 2, template_name: '标准A', ywbzz: '20000' },
        ]);

        const response = await request(app)
            .post('/list')
            .send({
                page: 1,
                perPage: 10,
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.items).toEqual([
            expect.objectContaining({
                id: 1,
                template_name: '提取金额不得超过X',
                display_ywblbz: '提取金额不得超过10000',
            }),
            expect.objectContaining({
                id: 2,
                template_name: '标准A',
                display_ywblbz: '标准A',
            }),
        ]);
        expect(fetchPublicParamValue).not.toHaveBeenCalled();
    });

    test('list 在规则当前值为空时回退原始 template_name', async () => {
        const app = createApp();
        adapter.get.mockResolvedValue({ total: 1 });
        adapter.all.mockResolvedValue([
            { id: 1, template_name: '提取金额不得超过X', ywbzz: '' },
        ]);

        const response = await request(app)
            .post('/list')
            .send({
                page: 1,
                perPage: 10,
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.items).toEqual([
            expect.objectContaining({
                id: 1,
                template_name: '提取金额不得超过X',
                display_ywblbz: '提取金额不得超过X',
            }),
        ]);
    });
});
