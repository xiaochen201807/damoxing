jest.mock('../db', () => ({
    getByJgbh: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { rowsToTabular, getInitPackageData, TABLE_EXECUTION_ORDER } = require('../services/initPackageService');
const initPackageRouter = require('../routes/http/initPackage');

describe('initPackageService and Routes', () => {
    let mockAdapter;
    let validToken;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAdapter = {
            all: jest.fn(),
            get: jest.fn(),
            run: jest.fn(),
        };
        db.getByJgbh.mockReturnValue(mockAdapter);

        // 生成测试用 Token
        validToken = jwt.sign(
            { id: 1, username: 'test_admin', role: 'admin', jgbh: '', zjgbh: '' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
    });

    describe('rowsToTabular', () => {
        test('处理空数组或非法输入', () => {
            expect(rowsToTabular([])).toEqual({ columns: [], rows: [] });
            expect(rowsToTabular(null)).toEqual({ columns: [], rows: [] });
            expect(rowsToTabular(undefined)).toEqual({ columns: [], rows: [] });
        });

        test('正确转换为紧凑 Tabular 格式', () => {
            const input = [
                { id: 1, name: 'A', value: 100 },
                { id: 2, name: 'B', extra: 'X' }
            ];
            const result = rowsToTabular(input);
            expect(result.columns).toEqual(['id', 'name', 'value', 'extra']);
            expect(result.rows).toEqual([
                [1, 'A', 100, null],
                [2, 'B', null, 'X']
            ]);
        });
    });

    describe('getInitPackageData', () => {
        test('全量抽取并正确进行目标机构码替换', async () => {
            mockAdapter.all
                .mockResolvedValueOnce([{ id: 1, flbh: '01', flmc: '分类1' }]) // gjj_ywnrfl
                .mockResolvedValueOnce([{ id: 10, flbh: '01', bzbh: 'BZ01', bzmc: '标准1' }]) // gjj_ywbzk
                .mockResolvedValueOnce([{ id: 100, ywid: 10, sxbh: 'SX01', sxmc: '属性1' }]) // gjj_ywbzksx
                .mockResolvedValueOnce([{ id: 1000, ywid: 10, hcywid: 20 }]) // gjj_ywbzkhc
                .mockResolvedValueOnce([{ id: 20, jgbh: 'OLD_JG', zjgbh: 'OLD_ZJG', ywdm: 'YW01' }]) // gjj_ywbz
                .mockResolvedValueOnce([{ id: 200, ywid: 20, sxbh: 'SX02' }]) // gjj_ywbzsx
                .mockResolvedValueOnce([{ id: 30, jgbh: 'OLD_JG', zjgbh: 'OLD_ZJG', sxbh: '01', gzmc: '规则1' }]); // gjj_cxgzkz

            const res = await getInitPackageData({
                sourceJgbh: 'OLD_JG',
                sourceZjgbh: 'OLD_ZJG',
                targetJgbh: 'TARGET_JG',
                targetZjgbh: 'TARGET_ZJG'
            });

            expect(res.version).toBe('1.0.0');
            expect(res.executionOrder).toEqual(TABLE_EXECUTION_ORDER);
            expect(res.meta.targetJgbh).toBe('TARGET_JG');
            expect(res.meta.targetZjgbh).toBe('TARGET_ZJG');

            const ywbzColIdx = res.tables.gjj_ywbz.columns.indexOf('jgbh');
            const ywbzZjgbhColIdx = res.tables.gjj_ywbz.columns.indexOf('zjgbh');
            expect(res.tables.gjj_ywbz.rows[0][ywbzColIdx]).toBe('TARGET_JG');
            expect(res.tables.gjj_ywbz.rows[0][ywbzZjgbhColIdx]).toBe('TARGET_ZJG');

            const cxgzkzColIdx = res.tables.gjj_cxgzkz.columns.indexOf('jgbh');
            expect(res.tables.gjj_cxgzkz.rows[0][cxgzkzColIdx]).toBe('TARGET_JG');
        });

        test('支持按 modules 过滤抽取模块', async () => {
            mockAdapter.all
                .mockResolvedValueOnce([{ id: 1, flbh: '01' }])
                .mockResolvedValueOnce([{ id: 10, flbh: '01' }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const res = await getInitPackageData({
                modules: ['ywbzk']
            });

            expect(res.executionOrder).toEqual(['gjj_ywnrfl', 'gjj_ywbzk', 'gjj_ywbzksx', 'gjj_ywbzkhc']);
            expect(res.tables.gjj_ywbz).toBeUndefined();
            expect(res.tables.gjj_cxgzkz).toBeUndefined();
        });
    });

    describe('HTTP Endpoints', () => {
        let app;

        beforeEach(() => {
            app = express();
            app.use(express.json());
            app.use('/api/init-package', initPackageRouter);
        });

        test('GET /meta 返回元数据和执行顺序 (带有效Token)', async () => {
            const response = await request(app)
                .get('/api/init-package/meta')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(0);
            expect(response.body.data.tableExecutionOrder).toEqual(TABLE_EXECUTION_ORDER);
        });

        test('POST /data 正确获取并响应数据 (带有效Token及必输源机构)', async () => {
            mockAdapter.all.mockResolvedValue([]);

            const response = await request(app)
                .post('/api/init-package/data')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    sourceJgbh: '1305282025',
                    sourceZjgbh: '1305282025',
                    targetJgbh: '320100',
                    targetZjgbh: '32010001'
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(0);
            expect(response.body.msg).toContain('成功');
            expect(response.body.data.meta.targetJgbh).toBe('320100');
        });

        test('未提供 sourceJgbh 或 sourceZjgbh 必输参数时返回 400', async () => {
            const response = await request(app)
                .post('/api/init-package/data')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    targetJgbh: '320100'
                });

            expect(response.status).toBe(400);
            expect(response.body.status).toBe(1);
            expect(response.body.msg).toContain('缺少必输参数');
        });

        test('未提供 Token 访问 /data 返回 401', async () => {
            const response = await request(app)
                .post('/api/init-package/data')
                .send({
                    sourceJgbh: '1305282025',
                    sourceZjgbh: '1305282025'
                });

            expect(response.status).toBe(401);
        });

        test('POST /issue-token 本机调用成功颁发长期 Token', async () => {
            const response = await request(app)
                .post('/api/init-package/issue-token')
                .send({
                    username: 'java_init_service',
                    role: 'admin',
                    expiresIn: '3650d'
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(0);
            expect(response.body.msg).toBe('Token 颁发成功');
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.expiresIn).toBe('3650d');

            // 验证生成的 Token 能被验证
            const decoded = jwt.verify(response.body.data.token, JWT_SECRET);
            expect(decoded.username).toBe('java_init_service');
            expect(decoded.role).toBe('admin');
        });
    });
});
