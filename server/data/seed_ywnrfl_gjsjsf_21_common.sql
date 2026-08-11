-- 业务内容分类同步脚本 (算法ID: 21) - 通用 ANSI SQL (适用于 MySQL / SQLite / 达梦等)
-- 同步自“可提取金额算法” (算法ID: 1)

INSERT INTO gjj_ywnrfl (gjsjsf, flbm, flmc, quanzhong, pxh, sfqy, cjsj, gxsj)
SELECT '21', flbm, flmc, quanzhong, pxh, sfqy, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM gjj_ywnrfl t1
WHERE t1.gjsjsf = '1'
  AND NOT EXISTS (
      SELECT 1 FROM gjj_ywnrfl t2 
      WHERE t2.gjsjsf = '21' AND t2.flbm = t1.flbm
  );
