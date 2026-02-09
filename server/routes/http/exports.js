const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { isSafeFileName, resolveWithin } = require('../../utils/safePath');

const router = express.Router();

function getExportsDir() {
  return process.env.EXPORTS_DIR || path.join(__dirname, '../../exports');
}

function getAllowlist() {
  const fromEnv = process.env.EXPORTS_ALLOWLIST;
  if (fromEnv) {
    return new Set(
      fromEnv
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    );
  }
  return new Set(['ywbz_full_export.csv', 'ywbzk_full_export.csv']);
}

function canDownloadExports(req) {
  const role = req.user?.role;
  return role === 'admin';
}

router.get('/:fileName', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ status: 401, msg: '未登录' });
  }
  if (!canDownloadExports(req)) {
    return res.status(403).json({ status: 403, msg: '无下载权限' });
  }

  const { fileName } = req.params;
  if (!isSafeFileName(fileName)) {
    return res.status(400).json({ status: 400, msg: '非法文件名' });
  }

  const allowlist = getAllowlist();
  if (!allowlist.has(fileName)) {
    return res.status(404).json({ status: 404, msg: '文件不存在' });
  }

  const exportsDir = getExportsDir();
  const fullPath = resolveWithin(exportsDir, fileName);
  if (!fullPath) {
    return res.status(400).json({ status: 400, msg: '非法路径' });
  }

  try {
    await fs.promises.access(fullPath, fs.constants.R_OK);
  } catch (_e) {
    return res.status(404).json({ status: 404, msg: '文件不存在' });
  }

  logger.info(`[Exports] Download: ${fileName} by ${req.user.username}`);
  return res.download(fullPath, fileName);
});

module.exports = router;
