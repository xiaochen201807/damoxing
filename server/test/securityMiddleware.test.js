jest.mock('../utils/logger', () => ({
    warn: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { sqlInjectionProtection } = require('../middleware/security');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use(sqlInjectionProtection);
    app.post('*', (_req, res) => res.json({ status: 0 }));
    return app;
}

describe('sqlInjectionProtection', () => {
    test('标准库保存仅跳过加密信封字段', async () => {
        const response = await request(createApp())
            .post('/api/ywbzk/save')
            .send({
                ywblbz: '正常标准',
                sqlEnvelope: {
                    ciphertext: 'U0VMRUNUIElOU0VSVCBJTlRPIFRFU1Q='
                }
            });

        expect(response.status).toBe(200);
    });

    test('标准库保存的普通字段仍会拦截注入模式', async () => {
        const response = await request(createApp())
            .post('/api/ywbzk/save')
            .send({
                ywblbz: "x' UNION SELECT password FROM users --",
                sqlEnvelope: { ciphertext: 'encrypted' }
            });

        expect(response.status).toBe(400);
        expect(response.body.msg).toBe('请求包含可疑内容，已被安全系统拦截');
    });

    test('其他接口不会把同名信封字段当作例外', async () => {
        const response = await request(createApp())
            .post('/api/other/save')
            .send({
                sqlEnvelope: {
                    ciphertext: 'U0VMRUNUIElOU0VSVCBJTlRPIFRFU1Q='
                }
            });

        expect(response.status).toBe(400);
    });
});
