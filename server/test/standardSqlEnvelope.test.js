const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    getPublicKeyInfo,
    decryptStandardSqlEnvelope,
    createAttributeBinding,
    restoreStandardSqlFields
} = require('../utils/standardSqlEnvelope');

function createEnvelope(payload, overrides = {}) {
    const keyInfo = getPublicKeyInfo();
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const issuedAt = Date.now();
    const aad = Buffer.from(`${keyInfo.version}.${keyInfo.keyId}.${issuedAt}`, 'utf8');
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    cipher.setAAD(aad);
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
        ciphertext: encrypted.toString('base64'),
        ...overrides
    };
}

describe('standardSqlEnvelope', () => {
    test('能够解密并恢复主 SQL 和属性 SQL', () => {
        const attributeRow = { sxly: 'sql', sxbm: '测试属性' };
        const payload = {
            ywbzjg_dialects: {
                default: 'SELECT 姓名 FROM 业务表 WHERE id = :id',
                oracle: 'SELECT XM FROM YWB WHERE ID = :id'
            },
            attributes: [{
                index: 0,
                binding: createAttributeBinding(attributeRow),
                ywblbzyg_dialects: { default: 'SELECT value FROM source_table' }
            }]
        };

        const decrypted = decryptStandardSqlEnvelope(createEnvelope(payload));
        const restored = restoreStandardSqlFields({
            ywblbz: '测试标准',
            sqlEnvelope: {},
            ywblbzsxz: [attributeRow]
        }, decrypted);

        expect(restored.sqlEnvelope).toBeUndefined();
        expect(restored.ywbzjg_dialects).toEqual(payload.ywbzjg_dialects);
        expect(restored.ywblbzsxz[0].ywblbzyg_dialects).toEqual(
            payload.attributes[0].ywblbzyg_dialects
        );
    });

    test('篡改密文后会拒绝解密', () => {
        const envelope = createEnvelope({ attributes: [] });
        const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
        ciphertext[0] ^= 0xff;
        envelope.ciphertext = ciphertext.toString('base64');

        expect(() => decryptStandardSqlEnvelope(envelope)).toThrow();
    });

    test('拒绝越界的属性 SQL 索引', () => {
        expect(() => restoreStandardSqlFields(
            { ywblbzsxz: [], sqlEnvelope: {} },
            { attributes: [{ index: 1, binding: {}, ywblbzyg: 'SELECT 1' }] }
        )).toThrow('SQL 属性加密项索引无效');
    });

    test('拒绝属性明文元数据与密文绑定不一致', () => {
        const originalRow = { sxly: 'sql', sxbm: '原属性', ywblbzsx: 'fieldA' };
        expect(() => restoreStandardSqlFields(
            { ywblbzsxz: [{ ...originalRow, sxbm: '被篡改属性' }], sqlEnvelope: {} },
            {
                attributes: [{
                    index: 0,
                    binding: createAttributeBinding(originalRow),
                    ywblbzyg: 'SELECT 1'
                }]
            }
        )).toThrow('SQL 属性元数据不一致: sxbm');
    });

    test('公钥信息包含服务端时间', () => {
        expect(Number.isInteger(getPublicKeyInfo().serverTime)).toBe(true);
    });

    test('生产环境缺少共享私钥时拒绝初始化', () => {
        const env = { ...process.env, NODE_ENV: 'production' };
        delete env.STANDARD_SQL_PRIVATE_KEY;
        delete env.STANDARD_SQL_PRIVATE_KEY_FILE;

        const result = spawnSync(process.execPath, [
            '-e',
            "require('./utils/standardSqlEnvelope').initializeStandardSqlEncryption()"
        ], {
            cwd: path.join(__dirname, '..'),
            env,
            encoding: 'utf8'
        });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('生产环境必须配置 STANDARD_SQL_PRIVATE_KEY');
    });
});
