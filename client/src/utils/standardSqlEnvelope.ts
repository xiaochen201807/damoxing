import axios from 'axios';

interface PublicKeyInfo {
  version: number;
  algorithm: 'RSA-OAEP-256+A256GCM';
  keyId: string;
  publicKey: string;
  serverTime: number;
  serverTimeOffsetMs?: number;
}

interface PublicKeyResponse {
  status: number;
  msg: string;
  data: PublicKeyInfo;
}

interface SqlAttributePayload {
  index: number;
  binding: Record<string, string | null>;
  ywblbzyg?: unknown;
  ywblbzyg_dialects?: unknown;
}

interface SqlPayload {
  ywbzjg?: unknown;
  ywbzjg_dialects?: unknown;
  attributes: SqlAttributePayload[];
}

interface SqlEnvelope {
  version: number;
  algorithm: string;
  keyId: string;
  issuedAt: number;
  iv: string;
  wrappedKey: string;
  ciphertext: string;
}

const SQL_SAVE_PATH = /\/ywbzk\/save\/?$/;
const ATTRIBUTE_BINDING_FIELDS = [
  'sfdxsx',
  'ywblbzdx',
  'fwdxbq',
  'sxbm',
  'ywblbzsx',
  'sxly',
  'zdsxmc',
  'zdsxbm'
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const arrayBufferToBase64 = (value: ArrayBuffer): string => {
  const bytes = new Uint8Array(value);
  const chunkSize = 0x8000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return window.btoa(binary);
};

const base64ToArrayBuffer = (value: string): ArrayBuffer => {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

const getPublicKeyUrl = (saveUrl: string): string => (
  saveUrl.replace(SQL_SAVE_PATH, '/ywbzk/sql-public-key')
);

const normalizeBindingValue = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value) ?? String(value);
};

const createAttributeBinding = (row: Record<string, unknown>): Record<string, string | null> => {
  const binding: Record<string, string | null> = {};
  for (const field of ATTRIBUTE_BINDING_FIELDS) {
    binding[field] = normalizeBindingValue(row[field]);
  }
  return binding;
};

const loadPublicKey = (
  saveUrl: string,
  headers: Record<string, string>
): Promise<PublicKeyInfo> => {
  const publicKeyUrl = getPublicKeyUrl(saveUrl);
  const requestStartedAt = Date.now();
  return axios.get<PublicKeyResponse>(publicKeyUrl, {
    headers,
    withCredentials: true,
    timeout: 15000
  }).then(response => {
    if (response.data?.status !== 0 || !response.data.data?.publicKey || !Number.isInteger(response.data.data.serverTime)) {
      throw new Error(response.data?.msg || '无法获取标准库 SQL 加密公钥');
    }
    const requestFinishedAt = Date.now();
    const clientMidpoint = Math.round((requestStartedAt + requestFinishedAt) / 2);
    return {
      ...response.data.data,
      serverTimeOffsetMs: response.data.data.serverTime - clientMidpoint
    };
  });
};

const extractSqlPayload = (data: Record<string, unknown>): {
  requestData: Record<string, unknown>;
  sqlPayload: SqlPayload;
} => {
  const requestData = { ...data };
  const sqlPayload: SqlPayload = { attributes: [] };

  if (Object.prototype.hasOwnProperty.call(requestData, 'ywbzjg')) {
    sqlPayload.ywbzjg = requestData.ywbzjg;
    delete requestData.ywbzjg;
  }
  if (Object.prototype.hasOwnProperty.call(requestData, 'ywbzjg_dialects')) {
    sqlPayload.ywbzjg_dialects = requestData.ywbzjg_dialects;
    delete requestData.ywbzjg_dialects;
  }

  if (Array.isArray(requestData.ywblbzsxz)) {
    requestData.ywblbzsxz = requestData.ywblbzsxz.map((row, index) => {
      if (!isRecord(row)) {
        return row;
      }

      const restoredRow = { ...row };
      const attributePayload: SqlAttributePayload = {
        index,
        binding: createAttributeBinding(restoredRow)
      };
      let hasSqlContent = false;

      if (Object.prototype.hasOwnProperty.call(restoredRow, 'ywblbzyg')) {
        attributePayload.ywblbzyg = restoredRow.ywblbzyg;
        delete restoredRow.ywblbzyg;
        hasSqlContent = true;
      }
      if (Object.prototype.hasOwnProperty.call(restoredRow, 'ywblbzyg_dialects')) {
        attributePayload.ywblbzyg_dialects = restoredRow.ywblbzyg_dialects;
        delete restoredRow.ywblbzyg_dialects;
        hasSqlContent = true;
      }
      if (hasSqlContent) {
        sqlPayload.attributes.push(attributePayload);
      }

      return restoredRow;
    });
  }

  return { requestData, sqlPayload };
};

const encryptSqlPayload = async (
  payload: SqlPayload,
  keyInfo: PublicKeyInfo
): Promise<SqlEnvelope> => {
  if (!window.crypto?.subtle) {
    throw new Error('当前访问环境不支持标准库 SQL 安全传输，请使用 HTTPS 或升级浏览器');
  }

  const publicKey = await window.crypto.subtle.importKey(
    'spki',
    base64ToArrayBuffer(keyInfo.publicKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const issuedAt = Math.round(Date.now() + (keyInfo.serverTimeOffsetMs ?? 0));
  const aad = new TextEncoder().encode(`${keyInfo.version}.${keyInfo.keyId}.${issuedAt}`);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    aesKey,
    plaintext
  );
  const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
  const wrappedKey = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawAesKey
  );

  return {
    version: keyInfo.version,
    algorithm: keyInfo.algorithm,
    keyId: keyInfo.keyId,
    issuedAt,
    iv: arrayBufferToBase64(iv.buffer),
    wrappedKey: arrayBufferToBase64(wrappedKey),
    ciphertext: arrayBufferToBase64(ciphertext)
  };
};

export const isBusinessStandardSqlSaveUrl = (url: string): boolean => {
  try {
    return SQL_SAVE_PATH.test(new URL(url, window.location.origin).pathname);
  } catch (_error) {
    return false;
  }
};

export const protectBusinessStandardSql = async (
  data: unknown,
  saveUrl: string,
  headers: Record<string, string>
): Promise<unknown> => {
  if (!isRecord(data) || !isBusinessStandardSqlSaveUrl(saveUrl)) {
    return data;
  }

  const { requestData, sqlPayload } = extractSqlPayload(data);
  const publicKey = await loadPublicKey(saveUrl, headers);
  requestData.sqlEnvelope = await encryptSqlPayload(sqlPayload, publicKey);
  return requestData;
};
