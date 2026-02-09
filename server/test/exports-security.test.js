const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'damoxing-exports-'));
}

describe('下载安全：路径穿越与权限二次校验', () => {
  test('exports 路由：非 admin 禁止下载', async () => {
    const dir = mkTmpDir();
    process.env.EXPORTS_DIR = dir;
    process.env.EXPORTS_ALLOWLIST = 'ywbz_full_export.csv';

    jest.resetModules();
    const exportsRouter = require('../routes/http/exports');

    const app = express();
    app.use('/exports', (req, _res, next) => {
      req.user = { username: 'u', role: 'user' };
      next();
    });
    app.use('/exports', exportsRouter);

    await request(app).get('/exports/ywbz_full_export.csv').expect(403);
  });

  test('exports 路由：admin 允许下载白名单文件', async () => {
    const dir = mkTmpDir();
    fs.writeFileSync(path.join(dir, 'ywbz_full_export.csv'), 'ok', 'utf8');
    process.env.EXPORTS_DIR = dir;
    process.env.EXPORTS_ALLOWLIST = 'ywbz_full_export.csv';

    jest.resetModules();
    const exportsRouter = require('../routes/http/exports');

    const app = express();
    app.use('/exports', (req, _res, next) => {
      req.user = { username: 'admin', role: 'admin' };
      next();
    });
    app.use('/exports', exportsRouter);

    const res = await request(app).get('/exports/ywbz_full_export.csv').expect(200);
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  test('exports 路由：白名单外文件拒绝', async () => {
    const dir = mkTmpDir();
    fs.writeFileSync(path.join(dir, 'other.csv'), 'ok', 'utf8');
    process.env.EXPORTS_DIR = dir;
    process.env.EXPORTS_ALLOWLIST = 'ywbz_full_export.csv';

    jest.resetModules();
    const exportsRouter = require('../routes/http/exports');

    const app = express();
    app.use('/exports', (req, _res, next) => {
      req.user = { username: 'admin', role: 'admin' };
      next();
    });
    app.use('/exports', exportsRouter);

    await request(app).get('/exports/other.csv').expect(404);
  });

  test.each([
    ['../secret.csv'],
    ['..\\secret.csv'],
    ['%2e%2e%5csecret.csv'],
    ['%252e%252e%255csecret.csv'],
    ['~secret.csv'],
    ['a%00.csv'],
    ['..%255c..%255csecret.csv'],
    ['..%2fsecret.csv'],
    ['..%252fsecret.csv'],
    ['%2e%2e%2fsecret.csv'],
  ])('exports 路由：拦截路径穿越/伪造文件名 (%s)', async (name) => {
    const dir = mkTmpDir();
    process.env.EXPORTS_DIR = dir;
    process.env.EXPORTS_ALLOWLIST = 'ywbz_full_export.csv';

    jest.resetModules();
    const exportsRouter = require('../routes/http/exports');

    const app = express();
    app.use('/exports', (req, _res, next) => {
      req.user = { username: 'admin', role: 'admin' };
      next();
    });
    app.use('/exports', exportsRouter);

    const res = await request(app).get(`/exports/${name}`);
    expect([400, 404]).toContain(res.status);
  });

  test('导出接口：非 admin 禁止导出/下载', async () => {
    process.env.JWT_SECRET = 't';
    process.env.ORACLE_ENABLE = 'false';

    jest.resetModules();
    const ywbzRouter = require('../routes/http/ywbz');

    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/ywbz', ywbzRouter);

    const token = jwt.sign({ id: 1, username: 'u', role: 'user' }, process.env.JWT_SECRET);
    await request(app)
      .get('/api/ywbz/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});

