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
    getAlgorithmMap: jest.fn(() => ({
        '1': '最大可提取额',
        '2': '最高可贷金额',
        '3': '最高可贷年限',
        '4': '借款人最大可对冲支取金额',
    })),
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

describe('ywbz route variable regressions', () => {
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

    test('POST /get 在未传 ywsf 时不会因变量未定义报错', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        adapter.get.mockResolvedValueOnce(null);

        const response = await request(app)
            .post('/get')
            .send({
                id: 1,
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(404);
        expect(db.getByJgbh).toHaveBeenCalledWith('1001');
    });

    test('GET /options/categories 会按请求中的 jgbh 选择适配器', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        adapter.all.mockResolvedValueOnce([]);

        const response = await request(app)
            .get('/options/categories')
            .set('jgbh', 'JG-OPT');

        expect(response.status).toBe(200);
        expect(db.getByJgbh).toHaveBeenCalledWith('JG-OPT');
    });

    test('POST /partial_export 会按请求中的 jgbh 选择适配器', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        adapter.all.mockRejectedValueOnce(new Error('mock export stop'));

        const response = await request(app)
            .post('/partial_export')
            .set('jgbh', 'JG-EXPORT')
            .send({
                ids: '1,2'
            });

        expect(response.status).toBe(500);
        expect(db.getByJgbh).toHaveBeenCalledWith('JG-EXPORT');
    });
});
