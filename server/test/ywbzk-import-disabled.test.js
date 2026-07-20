const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

describe('业务标准库全量导入接口禁用', () => {
    test('POST /api/ywbzk/import 返回 403', async () => {
        process.env.JWT_SECRET = 't';
        process.env.ORACLE_ENABLE = 'false';

        jest.resetModules();
        const ywbzkRouter = require('../routes/http/ywbzk');

        const app = express();
        app.use('/api/ywbzk', ywbzkRouter);

        const token = jwt.sign({ id: 1, username: 'u', role: 'admin' }, process.env.JWT_SECRET);
        const res = await request(app)
            .post('/api/ywbzk/import')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', Buffer.from('INSERT INTO gjj_ywbzk (id) VALUES (1);', 'utf8'), 'test.sql')
            .expect(403);

        expect(res.body).toMatchObject({
            status: 403
        });
        expect(res.body.msg).toMatch(/已永久关闭|已禁用|数据库客户端/);
    });
});
