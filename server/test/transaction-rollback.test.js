const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const request = require('supertest');

function createTempDbFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'damoxing-test-'));
  return path.join(dir, 'test.sqlite');
}

function openDb(dbPath) {
  return new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
}

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function close(db) {
  return new Promise((resolve) => db.close(() => resolve()));
}

describe('事务回滚：子表失败不残留主表', () => {
  test('db.transaction：子表插入失败会回滚主表', async () => {
    const dbPath = createTempDbFile();
    const raw = openDb(dbPath);
    await exec(
      raw,
      `
      CREATE TABLE gjj_ywbz (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mbid INTEGER,
        gzmc TEXT,
        ywsf TEXT,
        gzljsm TEXT,
        yxj INTEGER,
        sfqy INTEGER,
        gxsj TEXT
      );

      CREATE TABLE gjj_ywbzsx (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ywid INTEGER NOT NULL,
        row_index INTEGER NOT NULL,
        result TEXT,
        k1 TEXT NOT NULL,
        v1 TEXT,
        k2 TEXT, v2 TEXT, k3 TEXT, v3 TEXT, k4 TEXT, v4 TEXT, k5 TEXT, v5 TEXT,
        k6 TEXT, v6 TEXT, k7 TEXT, v7 TEXT, k8 TEXT, v8 TEXT, k9 TEXT, v9 TEXT, k10 TEXT, v10 TEXT
      );
      `
    );
    await close(raw);

    process.env.DB_PATH = dbPath;
    process.env.SQLITE_READONLY = 'false';
    process.env.ORACLE_ENABLE = 'false';

    jest.resetModules();
    const db = require('../db');

    await expect(
      db.transaction(async (tx) => {
        const insMain = await tx.run(
          'INSERT INTO gjj_ywbz (mbid, gzmc, ywsf, gzljsm, yxj, sfqy) VALUES (?, ?, ?, ?, ?, ?)',
          [1, 't', 's', 'd', 1, 1]
        );
        const mainId = insMain.lastID;
        await tx.run(
          'INSERT INTO gjj_ywbzsx (ywid, row_index, result, k1, v1) VALUES (?, ?, ?, ?, ?)',
          [mainId, 0, '', null, 'x']
        );
      })
    ).rejects.toBeTruthy();

    const verify = openDb(dbPath);
    const row = await get(verify, 'SELECT COUNT(*) as c FROM gjj_ywbz', []);
    await close(verify);
    expect(row.c).toBe(0);
  });

  test('ywbz /save：子表插入失败会回滚主表', async () => {
    const dbPath = createTempDbFile();
    const raw = openDb(dbPath);
    await exec(
      raw,
      `
      CREATE TABLE gjj_ywbz (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mbid INTEGER,
        gzmc TEXT,
        ywsf TEXT,
        gzljsm TEXT,
        yxj INTEGER,
        sfqy INTEGER,
        gxsj TEXT
      );

      CREATE TABLE gjj_ywbzsx (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ywid INTEGER NOT NULL,
        row_index INTEGER NOT NULL,
        result TEXT,
        k1 TEXT NOT NULL,
        v1 TEXT,
        k2 TEXT, v2 TEXT, k3 TEXT, v3 TEXT, k4 TEXT, v4 TEXT, k5 TEXT, v5 TEXT,
        k6 TEXT, v6 TEXT, k7 TEXT, v7 TEXT, k8 TEXT, v8 TEXT, k9 TEXT, v9 TEXT, k10 TEXT, v10 TEXT
      );
      `
    );
    await close(raw);

    process.env.DB_PATH = dbPath;
    process.env.SQLITE_READONLY = 'false';
    process.env.ORACLE_ENABLE = 'false';

    jest.resetModules();
    const ywbzRouter = require('../routes/http/ywbz');

    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/ywbz', ywbzRouter);

    await request(app)
      .post('/ywbz/save')
      .send({
        mbid: 1,
        gzmc: 't',
        ywsf: 's',
        gzljsm: 'd',
        yxj: 1,
        sfqy: 1,
        rule_params: {}
      })
      .expect(500);

    const verify = openDb(dbPath);
    const row = await get(verify, 'SELECT COUNT(*) as c FROM gjj_ywbz', []);
    await close(verify);
    expect(row.c).toBe(0);
  });
});
