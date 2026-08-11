-- 业务内容分类同步脚本 (算法ID: 21) - 适用于 Oracle / 达梦 (DM)
-- 同步自“可提取金额算法” (算法ID: 1)

MERGE INTO gjj_ywnrfl t
USING (SELECT '21' AS gjsjsf, flbm, flmc, quanzhong, pxh, sfqy FROM gjj_ywnrfl WHERE gjsjsf = '1') s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.quanzhong = s.quanzhong, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, quanzhong, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.quanzhong, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);

COMMIT;
