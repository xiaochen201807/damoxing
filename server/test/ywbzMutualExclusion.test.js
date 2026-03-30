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
const ywbzRouter = require('../routes/http/ywbz');

describe('ywbz mutual exclusion support', () => {
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

    test('batch 会拦截互斥标准同时同步', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        adapter.all
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { mbid: 1, hcmbid: 2, mbid_label: '标准A', hcmbid_label: '标准B' },
            ]);

        const response = await request(app)
            .post('/batch')
            .send({
                ids: ['1', '2'],
                jgbh: '1001',
                zjgbh: '2001',
                ywsf: '1',
                ywnrfl: 'A01',
            });

        expect(response.status).toBe(400);
        expect(response.body.msg).toContain('标准A 与 标准B');
    });

    test('selection_list 返回互斥信息并标记已选冲突项', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        adapter.all
            .mockResolvedValueOnce([
                { id: 1, ywblbz: '标准A' },
                { id: 2, ywblbz: '标准B' },
            ])
            .mockResolvedValueOnce([
                { mbid: 1 },
            ])
            .mockResolvedValueOnce([
                { mbid: 2, hcmbid: 1, hc_label: '标准A' },
            ]);

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
                checked: true,
            }),
            expect.objectContaining({
                id: 2,
                mutualIds: [1],
                mutualLabels: ['标准A'],
                disabled: true,
            }),
        ]);
    });
});
