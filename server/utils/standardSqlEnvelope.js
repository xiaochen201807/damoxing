const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const ENVELOPE_VERSION = 2;
const ENVELOPE_ALGORITHM = 'RSA-OAEP-256+A256GCM';
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_MAX_PLAINTEXT_BYTES = 512 * 1024;
const ATTRIBUTE_BINDING_FIELDS = [
    'sfdxsx',
    'ywblbzdx',
    'fwdxbq',
    'sxbm',
    'ywblbzsx',
    'sxly',
    'zdsxmc',
    'zdsxbm'
];

let keyMaterial;

function normalizePrivateKey(value) {
    return String(value || '').replace(/\\n/g, '\n').trim();
}

function loadConfiguredPrivateKey() {
    const inlineKey = normalizePrivateKey(process.env.STANDARD_SQL_PRIVATE_KEY);
    if (inlineKey) {
        return inlineKey;
    }

    const configuredPath = String(process.env.STANDARD_SQL_PRIVATE_KEY_FILE || '').trim();
    if (!configuredPath) {
        return null;
    }

    const resolvedPath = path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(__dirname, '..', configuredPath);

    return fs.readFileSync(resolvedPath, 'utf8').trim();
}

function getKeyMaterial() {
    if (keyMaterial) {
        return keyMaterial;
    }

    let privateKeyPem = loadConfiguredPrivateKey();
    if (!privateKeyPem) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('生产环境必须配置 STANDARD_SQL_PRIVATE_KEY 或 STANDARD_SQL_PRIVATE_KEY_FILE');
        }

        const generated = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        privateKeyPem = generated.privateKey;
        logger.warn('STANDARD_SQL_PRIVATE_KEY 未配置，当前使用进程级临时密钥；多实例和生产环境必须配置共享私钥');
    }

    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const publicKey = crypto.createPublicKey(privateKey);
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    const keyId = String(process.env.STANDARD_SQL_KEY_ID || '').trim()
        || crypto.createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 16);

    keyMaterial = {
        privateKey,
        keyId,
        publicKey: publicKeyDer.toString('base64')
    };

    return keyMaterial;
}

function initializeStandardSqlEncryption() {
    getKeyMaterial();
}

function getPublicKeyInfo() {
    const material = getKeyMaterial();
    return {
        version: ENVELOPE_VERSION,
        algorithm: ENVELOPE_ALGORITHM,
        keyId: material.keyId,
        publicKey: material.publicKey,
        serverTime: Date.now()
    };
}

function decodeBase64(value, fieldName) {
    if (typeof value !== 'string' || value.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        throw new Error(`${fieldName} 不是合法的 Base64 内容`);
    }
    return Buffer.from(value, 'base64');
}

function getPositiveIntegerEnv(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

function validateEnvelopeMetadata(envelope, material) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
        throw new Error('SQL 加密信封不能为空');
    }
    if (envelope.version !== ENVELOPE_VERSION || envelope.algorithm !== ENVELOPE_ALGORITHM) {
        throw new Error('SQL 加密信封版本或算法不受支持');
    }
    if (envelope.keyId !== material.keyId) {
        throw new Error('SQL 加密密钥已更新，请刷新页面后重试');
    }
    if (!Number.isInteger(envelope.issuedAt)) {
        throw new Error('SQL 加密信封缺少有效时间');
    }

    const maxAgeMs = getPositiveIntegerEnv('STANDARD_SQL_ENVELOPE_MAX_AGE_MS', DEFAULT_MAX_AGE_MS);
    const ageMs = Date.now() - envelope.issuedAt;
    if (ageMs < -60 * 1000 || ageMs > maxAgeMs) {
        throw new Error('SQL 加密信封已过期，请重新保存');
    }
}

function validateDecryptedPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('SQL 加密内容格式不正确');
    }

    const allowedKeys = new Set(['ywbzjg', 'ywbzjg_dialects', 'attributes']);
    const unknownKeys = Object.keys(payload).filter(key => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
        throw new Error(`SQL 加密内容包含未知字段: ${unknownKeys.join(', ')}`);
    }
    if (payload.attributes !== undefined && !Array.isArray(payload.attributes)) {
        throw new Error('SQL 属性加密内容必须是数组');
    }

    return payload;
}

function normalizeBindingValue(value) {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return JSON.stringify(value) ?? String(value);
}

function createAttributeBinding(row) {
    const binding = {};
    for (const field of ATTRIBUTE_BINDING_FIELDS) {
        binding[field] = normalizeBindingValue(row?.[field]);
    }
    return binding;
}

function validateAttributeBinding(binding, row) {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
        throw new Error('SQL 属性加密项缺少元数据绑定');
    }

    const unknownKeys = Object.keys(binding).filter(key => !ATTRIBUTE_BINDING_FIELDS.includes(key));
    if (unknownKeys.length > 0) {
        throw new Error(`SQL 属性元数据绑定包含未知字段: ${unknownKeys.join(', ')}`);
    }

    const expected = createAttributeBinding(row);
    for (const field of ATTRIBUTE_BINDING_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(binding, field) || binding[field] !== expected[field]) {
            throw new Error(`SQL 属性元数据不一致: ${field}`);
        }
    }
}

function decryptStandardSqlEnvelope(envelope) {
    const material = getKeyMaterial();
    validateEnvelopeMetadata(envelope, material);

    const iv = decodeBase64(envelope.iv, 'iv');
    const wrappedKey = decodeBase64(envelope.wrappedKey, 'wrappedKey');
    const encrypted = decodeBase64(envelope.ciphertext, 'ciphertext');
    if (iv.length !== 12 || encrypted.length <= 16) {
        throw new Error('SQL 加密信封参数长度不正确');
    }

    const maxPlaintextBytes = getPositiveIntegerEnv(
        'STANDARD_SQL_ENVELOPE_MAX_BYTES',
        DEFAULT_MAX_PLAINTEXT_BYTES
    );
    if (encrypted.length > maxPlaintextBytes + 16) {
        throw new Error('SQL 加密内容超过允许大小');
    }

    const aesKey = crypto.privateDecrypt({
        key: material.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
    }, wrappedKey);
    if (aesKey.length !== 32) {
        throw new Error('SQL 加密密钥长度不正确');
    }

    const authTag = encrypted.subarray(encrypted.length - 16);
    const ciphertext = encrypted.subarray(0, encrypted.length - 16);
    const aad = Buffer.from(`${envelope.version}.${envelope.keyId}.${envelope.issuedAt}`, 'utf8');
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (plaintext.length > maxPlaintextBytes) {
        throw new Error('SQL 加密内容超过允许大小');
    }

    let payload;
    try {
        payload = JSON.parse(plaintext.toString('utf8'));
    } catch (_error) {
        throw new Error('SQL 加密内容不是合法 JSON');
    }

    return validateDecryptedPayload(payload);
}

function restoreStandardSqlFields(body, payload) {
    const restored = { ...body };
    delete restored.sqlEnvelope;

    if (Object.prototype.hasOwnProperty.call(payload, 'ywbzjg')) {
        restored.ywbzjg = payload.ywbzjg;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'ywbzjg_dialects')) {
        restored.ywbzjg_dialects = payload.ywbzjg_dialects;
    }

    const rows = Array.isArray(restored.ywblbzsxz)
        ? restored.ywblbzsxz.map(row => ({ ...row }))
        : [];
    const seenIndexes = new Set();

    for (const item of payload.attributes || []) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error('SQL 属性加密项格式不正确');
        }

        const allowedKeys = new Set(['index', 'binding', 'ywblbzyg', 'ywblbzyg_dialects']);
        const unknownKeys = Object.keys(item).filter(key => !allowedKeys.has(key));
        if (unknownKeys.length > 0) {
            throw new Error(`SQL 属性加密项包含未知字段: ${unknownKeys.join(', ')}`);
        }
        if (!Number.isInteger(item.index) || item.index < 0 || item.index >= rows.length || seenIndexes.has(item.index)) {
            throw new Error('SQL 属性加密项索引无效');
        }

        seenIndexes.add(item.index);
        validateAttributeBinding(item.binding, rows[item.index]);
        if (Object.prototype.hasOwnProperty.call(item, 'ywblbzyg')) {
            rows[item.index].ywblbzyg = item.ywblbzyg;
        }
        if (Object.prototype.hasOwnProperty.call(item, 'ywblbzyg_dialects')) {
            rows[item.index].ywblbzyg_dialects = item.ywblbzyg_dialects;
        }
    }

    restored.ywblbzsxz = rows;
    return restored;
}

module.exports = {
    ENVELOPE_VERSION,
    ENVELOPE_ALGORITHM,
    initializeStandardSqlEncryption,
    getPublicKeyInfo,
    decryptStandardSqlEnvelope,
    createAttributeBinding,
    restoreStandardSqlFields
};
