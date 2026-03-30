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
const { gatewayRequest } = require('../services/gatewayService');

describe('ywbz debug template and case support', () => {
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

    test('debug_template 会按当前算法和分类生成模板', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);

        adapter.all.mockResolvedValueOnce([
            { ywblbzsx: 'dkje' },
            { ywblbzsx: 'fwzj' },
            { ywblbzsx: 'dkje' },
        ]);

        const response = await request(app)
            .post('/debug_template')
            .send({
                ywsf: '1',
                ywnrfl: 'A01',
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.template).toEqual({
            ywsf: '1',
            ywnrfl: 'A01',
            jgbh: '1001',
            zjgbh: '2001',
            dkje: '',
            fwzj: '',
        });
        expect(response.body.data.ywsf).toBe('1');
        expect(response.body.data.ywnrfl).toBe('A01');
        expect(response.body.data.fieldCount).toBe(2);
        expect(response.body.data.debugInput).toContain('"dkje": ""');
        expect(response.body.data.debugDispatchTip).toContain('统一入口');
        expect(response.body.data.dispatchMeta).toEqual(
            expect.objectContaining({
                algorithmCode: '1',
                algorithmLabel: '最大可提取额',
                entryProcedure: 'p_gjj_get_mxywsfz',
            })
        );
        expect(adapter.all).toHaveBeenCalledWith(
            expect.stringContaining('FROM gjj_ywbz r'),
            ['1001', '2001', '1', 'A01']
        );
    });

    test('debug_case/save 会保存格式化后的请求 JSON', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        adapter.run.mockResolvedValueOnce({ lastID: 88 });

        const response = await request(app)
            .post('/debug_case/save')
            .send({
                ywsf: '1',
                ywnrfl: 'A01',
                case_name: '购房提取成功案例',
                request_json: '{"ywsf":"1","dkje":"500000"}',
                result_summary: '调试成功，结果=500000',
                jgbh: '1001',
                zjgbh: '2001',
                creator_name: '测试用户',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(88);
        expect(adapter.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO gjj_ywbz_debug_case'),
            expect.arrayContaining([
                '1',
                'A01',
                '购房提取成功案例',
                expect.stringContaining('"dkje": "500000"'),
                '调试成功，结果=500000',
                '测试用户',
                '1001',
                '2001',
            ])
        );
    });

    test('debug_case/save 遇到非法 JSON 时返回 400', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);

        const response = await request(app)
            .post('/debug_case/save')
            .send({
                ywsf: '1',
                ywnrfl: 'A01',
                case_name: '非法案例',
                request_json: '{"ywsf":"1"',
                result_summary: '调试成功，结果=500000',
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(400);
        expect(adapter.run).not.toHaveBeenCalled();
    });

    test('debug_case/list 返回可直接用于下拉的案例选项', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        adapter.all.mockResolvedValueOnce([
            {
                id: 9,
                case_name: '案例A',
                ywsf: '1',
                ywnrfl: 'A01',
                result_summary: '结果=100',
                creator_name: '张三',
                cjsj: '2026-03-30 10:00:00',
            },
        ]);

        const response = await request(app)
            .post('/debug_case/list')
            .send({
                ywsf: '1',
                ywnrfl: 'A01',
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([
            expect.objectContaining({
                value: '9',
                label: '案例A | 算法=1 | 分类=A01 | 结果=100 | 张三 | 2026-03-30 10:00:00',
            }),
        ]);
    });

    test('debug_case/get 会解析并返回案例 JSON', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        adapter.get.mockResolvedValueOnce({
            id: 9,
            case_name: '案例A',
            request_json: '{"ywsf":"1","dkje":"500000"}',
            jgbh: '1001',
            zjgbh: '2001',
        });

        const response = await request(app)
            .post('/debug_case/get')
            .send({
                id: 9,
                jgbh: '1001',
                zjgbh: '2001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.request_json).toEqual({
            ywsf: '1',
            dkje: '500000',
        });
        expect(response.body.data.debugInput).toContain('"dkje": "500000"');
    });

    test('debug 遇到非法 JSON 时返回 400 且不调用网关', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);

        const response = await request(app)
            .post('/debug')
            .send({
                debugInput: '{"ywsf":"1"'
            });

        expect(response.status).toBe(400);
        expect(gatewayRequest).not.toHaveBeenCalled();
    });

    test('debug_log 会在首行返回算法分发说明', async () => {
        const app = express();
        app.use(express.json());
        app.use('/', ywbzRouter);
        adapter.all.mockResolvedValueOnce([
            {
                pcid: 'pc-1',
                content: 'select 1',
                result: '1',
                time: '2026-03-30 11:00:00',
                type: '1',
            },
        ]);

        const response = await request(app)
            .post('/debug_log')
            .send({
                pcid: 'pc-1',
                ywsf: '2',
                jgbh: '1001',
            });

        expect(response.status).toBe(200);
        expect(response.body.data.rows[0]).toEqual(
            expect.objectContaining({
                step: '分发信息',
                type: '算法分支',
                content: expect.stringContaining('最高可贷金额'),
                result: '规划子过程：p_gjj_get_mxywsfz_ywsf_2',
            })
        );
        expect(response.body.data.rows[1]).toEqual(
            expect.objectContaining({
                step: '步骤 1',
                result: '1',
            })
        );
    });
});
