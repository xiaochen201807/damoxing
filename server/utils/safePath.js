const path = require('path');

function decodeRepeated(value, maxDepth = 2) {
  let current = String(value ?? '');
  for (let i = 0; i < maxDepth; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch (_e) {
      break;
    }
  }
  return current;
}

function isSafeFileName(fileName) {
  const decoded = decodeRepeated(fileName);
  if (!decoded) return false;
  if (decoded.includes('\0')) return false;
  if (decoded.includes('..')) return false;
  if (decoded.includes('~')) return false;
  if (decoded.includes('/') || decoded.includes('\\')) return false;
  return /^[a-zA-Z0-9._-]+$/.test(decoded);
}

function resolveWithin(baseDir, fileName) {
  const safeName = decodeRepeated(fileName);
  const base = path.resolve(baseDir);
  const full = path.resolve(base, safeName);
  const baseWithSep = base.endsWith(path.sep) ? base : base + path.sep;
  if (!full.startsWith(baseWithSep)) {
    return null;
  }
  return full;
}

module.exports = {
  isSafeFileName,
  resolveWithin,
};

