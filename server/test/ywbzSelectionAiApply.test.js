jest.mock('axios', () => ({
    post: jest.fn(),
}));

jest.mock('../db', () => ({
    get: jest.fn(),
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
const axios = require('axios');
const db = require('../db');
const ywbzRouter = require('../routes/http/ywbz');

describe('ywbz selection_ai_apply', () => {
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
        db.get.mockResolvedValue({
            api_url: 'https://dify.example.com/v1',
            api_key: 'test-dify-key',
            workflow_name: '业务规则政策分析'
        });
    });

    function createApp() {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        return app;
    }

    test('selection_ai_apply 会根据 AI 返回结果自动同步业务规则', async () => {
        const app = createApp();
        adapter.all
            .mockResolvedValueOnce([
                { id: 1, ywblbz: '标准A', ywblbzsm: '描述A' },
                { id: 2, ywblbz: '标准B', ywblbzsm: '描述B' },
            ])
            .mockResolvedValueOnce([
                { mbid: 1 },
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { id: 1, ywblbz: '标准A', ywblbzsm: '描述A' },
                { id: 2, ywblbz: '标准B', ywblbzsm: '描述B' },
            ])
            .mockResolvedValueOnce([
                { id: 11, mbid: 1 },
            ])
            .mockResolvedValueOnce([
                { id: 2, ywblbz: '标准B', gjsjsf: '1', ywnrfl: 'A01', ywbzz: null },
            ]);

        axios.post.mockResolvedValue({
            data: {
                data: {
                    status: 'succeeded',
                    outputs: {
                        text: JSON.stringify({
                            selectedIds: [2],
                            summary: 'AI 建议保留标准B'
                        })
                    }
                }
            }
        });

        const response = await request(app)
            .post('/selection_ai_apply')
            .send({
                page_key: 'business_rule_demo',
                workflow_type: 'ai_analysis',
                policy_text: '购买住房提取时，优先匹配标准B。',
                ywsf: '1',
                ywnrfl: 'A01',
                jgbh: '1001',
                zjgbh: '2001'
            });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe(0);
        expect(response.body.msg).toBe('AI 分析完成，已自动勾选当前页命中结果并同步 1 条业务办理标准。建议先将每页显示条数设置为最大后，再重新进行分析。');
        expect(response.body.data.selectedIds).toEqual([2]);
        expect(response.body.data.summary).toBe('AI 建议保留标准B');
        expect(db.get).toHaveBeenCalledWith(
            'SELECT * FROM sys_dify_config WHERE page_key = ? AND workflow_type = ? AND enabled = 1',
            ['business_rule_demo', 'ai_analysis']
        );
        expect(axios.post).toHaveBeenCalledWith(
            'https://dify.example.com/v1/workflows/run',
            expect.objectContaining({
                inputs: expect.objectContaining({
                    text: '购买住房提取时，优先匹配标准B。',
                    data: expect.stringContaining('"ywblbz": "标准A"')
                })
            }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-dify-key'
                })
            })
        );
        expect(adapter.run).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM gjj_ywbz WHERE id IN'),
            [11, '1001', '2001']
        );
        expect(adapter.transaction).toHaveBeenCalledTimes(1);
    });
});
