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

jest.mock('../utils/business-standard-access', () => ({
    isBusinessStandardMasterEnabled: jest.fn(() => true),
    getBusinessStandardWriteDeniedMessage: jest.fn(() => 'denied'),
    getBusinessStandardImportDisabledMessage: jest.fn(() => 'disabled'),
}));

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const db = require('../db');
const ywbzkRouter = require('../routes/http/ywbzk');
const { createAttributeBinding } = require('../utils/standardSqlEnvelope');

function createEnvelope(keyInfo, payload) {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const issuedAt = Date.now();
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    cipher.setAAD(Buffer.from(`${keyInfo.version}.${keyInfo.keyId}.${issuedAt}`, 'utf8'));
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload), 'utf8'),
        cipher.final(),
        cipher.getAuthTag()
    ]);
    const publicKey = crypto.createPublicKey({
        key: Buffer.from(keyInfo.publicKey, 'base64'),
        type: 'spki',
        format: 'der'
    });
    const wrappedKey = crypto.publicEncrypt({
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
    }, aesKey);

    return {
        version: keyInfo.version,
        algorithm: keyInfo.algorithm,
        keyId: keyInfo.keyId,
        issuedAt,
        iv: iv.toString('base64'),
        wrappedKey: wrappedKey.toString('base64'),
        ciphertext: encrypted.toString('base64')
    };
}

describe('ywbzk encrypted SQL save', () => {
    test('在同一个保存事务中恢复并写入主 SQL 和属性 SQL', async () => {
        const adapter = {
            isOracle: false,
            get: jest.fn(),
            all: jest.fn(),
            run: jest.fn().mockResolvedValue({ lastID: 20, rowsAffected: 1 }),
            transaction: jest.fn(async work => work({
                get: adapter.get,
                all: adapter.all,
                run: adapter.run,
            })),
        };
        db.getByJgbh.mockReturnValue(adapter);

        const app = express();
        app.use(express.json());
        app.use('/', ywbzkRouter);

        const keyResponse = await request(app).get('/sql-public-key');
        expect(keyResponse.status).toBe(200);

        const mainSql = 'SELECT id FROM source_a UNION SELECT id FROM source_b';
        const attributeSql = 'SELECT value FROM attribute_source';
        const attributeRow = {
            sfdxsx: '1',
            ywblbzdx: '03160',
            sxbm: '人才类型',
            ywblbzsx: 'rclx',
            sxly: 'sql'
        };
        const sqlEnvelope = createEnvelope(keyResponse.body.data, {
            ywbzjg_dialects: { default: mainSql },
            attributes: [{
                index: 0,
                binding: createAttributeBinding(attributeRow),
                ywblbzyg_dialects: { default: attributeSql }
            }]
        });

        const response = await request(app)
            .post('/save')
            .send({
                ywblbz: '加密标准',
                gjsjsf: '1',
                jgbh: '1001',
                sqlEnvelope,
                ywblbzsxz: [attributeRow]
            });

        expect(response.status).toBe(200);
        expect(adapter.transaction).toHaveBeenCalledTimes(1);
        expect(adapter.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO gjj_ywbzk'),
            expect.arrayContaining([mainSql])
        );
        expect(adapter.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO gjj_ywbzksx'),
            [20, '03160', null, '人才类型', 'rclx', 'sql', attributeSql]
        );
    });
});
