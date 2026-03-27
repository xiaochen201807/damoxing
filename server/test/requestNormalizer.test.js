jest.mock('../db', () => ({}));
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));
jest.mock('axios', () => ({
    post: jest.fn(),
}));
jest.mock('../services/gatewayService', () => ({
    fetchPublicParamValue: jest.fn(),
}));
jest.mock('../utils/business-algorithms', () => ({
    getAlgorithms: jest.fn(() => []),
}));

const express = require('express');
const request = require('supertest');
const axios = require('axios');
const { fetchPublicParamValue } = require('../services/gatewayService');
const {
    reconstructMalformedBody,
    normalizeMalformedBody,
} = require('../middleware/requestNormalizer');
const toolsRouter = require('../routes/http/tools');

describe('requestNormalizer', () => {
    test('reconstructMalformedBody 能重建数字键 JSON body', () => {
        const result = reconstructMalformedBody({
            0: '{',
            1: '"jgbh"',
            2: ':',
            3: '"1001"',
            4: ',',
            5: '"name"',
            6: ':',
            7: '"标准值"',
            8: '}',
            existing: 'keep',
        });

        expect(result.reconstructed).toBe(true);
        expect(result.body).toMatchObject({
            jgbh: '1001',
            name: '标准值',
            existing: 'keep',
        });
    });

    test('reconstructMalformedBody 在非法 JSON 时保持原 body', () => {
        const body = {
            0: '{',
            1: '"jgbh"',
            2: ':',
            3: '"1001"',
        };

        const result = reconstructMalformedBody(body);

        expect(result.reconstructed).toBe(false);
        expect(result.body).toBe(body);
        expect(result.error).toBeInstanceOf(Error);
    });

    test('reconstructMalformedBody 在超长内容时拒绝重建', () => {
        const body = {
            0: '{',
            1: '"name"',
            2: ':',
            3: `"${'a'.repeat(32)}"`,
            4: '}',
        };

        const result = reconstructMalformedBody(body, { maxJsonLength: 10 });

        expect(result.reconstructed).toBe(false);
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain('length exceeds limit');
    });

    test('normalizeMalformedBody 会在路由前写回 req.body', async () => {
        const app = express();

        app.use(express.json());
        app.post('/test', normalizeMalformedBody(), (req, res) => {
            res.json(req.body);
        });

        const response = await request(app)
            .post('/test')
            .send({
                0: '{',
                1: '"keyword"',
                2: ':',
                3: '"任务"',
                4: '}',
            });

        expect(response.status).toBe(200);
        expect(response.body.keyword).toBe('任务');
        expect(response.body['0']).toBe('{');
    });
});

describe('tools routes with requestNormalizer', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use('/', toolsRouter);
    });

    test('task-info 使用共享中间件重建 body 后再调用网关', async () => {
        axios.post.mockResolvedValue({
            data: {
                datas: [
                    {
                        sjrwmc: '任务A',
                        taskNumber: 'T001',
                    },
                ],
            },
        });

        const response = await request(app)
            .post('/task-info')
            .set('login-token', 'token-1')
            .send({
                0: '{',
                1: '"keyword"',
                2: ':',
                3: '"缴存"',
                4: ',',
                5: '"jgbh"',
                6: ':',
                7: '"1001"',
                8: '}',
            });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([
            expect.objectContaining({
                label: '任务A',
                value: 'T001',
            }),
        ]);
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining('/jobApi/jobinfo/getTaskInfo'),
            {
                sjrwmc: '缴存',
                organizationNumber: '1001',
            },
            expect.objectContaining({
                headers: expect.objectContaining({
                    'login-token': 'token-1',
                    'channel': 'zmd',
                }),
            })
        );
    });

    test('public-param-values 使用共享中间件重建 body 后调用服务层', async () => {
        fetchPublicParamValue.mockResolvedValue({
            status: 0,
            msg: 'ok',
            data: [{ value: 'A' }],
        });

        const response = await request(app)
            .post('/public-param-values')
            .set('login-token', 'token-2')
            .send({
                0: '{',
                1: '"publicParamId"',
                2: ':',
                3: '"param-1"',
                4: ',',
                5: '"jgbh"',
                6: ':',
                7: '"1002"',
                8: ',',
                9: '"zjgbh"',
                10: ':',
                11: '"2002"',
                12: '}',
            });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([{ value: 'A' }]);
        expect(fetchPublicParamValue).toHaveBeenCalledWith(
            'param-1',
            '1002',
            '2002',
            expect.objectContaining({
                'login-token': 'token-2',
                jgbh: '1002',
            })
        );
    });
});
