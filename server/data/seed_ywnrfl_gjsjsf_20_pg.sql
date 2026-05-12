-- 业务内容分类同步脚本 (算法ID: 20) - 适用于 PostgreSQL / 人大金仓 / OpenGauss
-- 同步自“可提取金额算法” (算法ID: 1)
-- 生成时间: 2026-05-12

INSERT INTO gjj_ywnrfl (gjsjsf, flbm, flmc, quanzhong, pxh, sfqy, cjsj, gxsj)
SELECT '20', flbm, flmc, quanzhong, pxh, sfqy, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM gjj_ywnrfl
WHERE gjsjsf = '1'
ON CONFLICT (gjsjsf, flbm) DO UPDATE SET
    flmc = EXCLUDED.flmc,
    quanzhong = EXCLUDED.quanzhong,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;
