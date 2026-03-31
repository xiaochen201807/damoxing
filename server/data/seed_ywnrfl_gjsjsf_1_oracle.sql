-- 旧业务内容分类结果转 gjj_ywnrfl 导入脚本（Oracle/达梦）
-- 生成时间: 2026-03-31T02:42:18.075Z
-- 数据量: 27

MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '1' AS flbm, '购买住房' AS flmc, 1 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '2' AS flbm, '建造、翻建、大修住房' AS flmc, 2 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '3' AS flbm, '偿还购房贷款本息' AS flmc, 3 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '4' AS flbm, '既有住宅加装电梯' AS flmc, 4 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '5' AS flbm, '租赁住房' AS flmc, 5 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '6' AS flbm, '大病医疗' AS flmc, 6 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '7' AS flbm, '物业费' AS flmc, 7 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '8' AS flbm, '其他（部分）' AS flmc, 8 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '9' AS flbm, '重大灾害' AS flmc, 9 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '10' AS flbm, '家庭生活困难' AS flmc, 10 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '11' AS flbm, '司法扣划' AS flmc, 11 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '12' AS flbm, '离休、退休' AS flmc, 12 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '13' AS flbm, '完全丧失劳动能力，并与单位终止劳动关系' AS flmc, 13 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '14' AS flbm, '出境定居' AS flmc, 14 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '15' AS flbm, '死亡或宣告死亡' AS flmc, 15 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '16' AS flbm, '其他（销户）' AS flmc, 16 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '17' AS flbm, '灵活就业人员自由提取' AS flmc, 17 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '18' AS flbm, '封存满半年未再缴存' AS flmc, 18 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '19' AS flbm, '异地转移转出' AS flmc, 19 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '20' AS flbm, '灵活就业人员退出' AS flmc, 20 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '21' AS flbm, '其他住房消费' AS flmc, 21 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '22' AS flbm, '其他非住房消费' AS flmc, 22 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '23' AS flbm, '宣告失踪' AS flmc, 23 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '24' AS flbm, '缴纳房屋维修基金' AS flmc, 24 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '25' AS flbm, '车位费提取' AS flmc, 25 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '26' AS flbm, '休眠账户上缴' AS flmc, 26 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
MERGE INTO gjj_ywnrfl t
USING (SELECT '1' AS gjsjsf, '27' AS flbm, '购房税费提取' AS flmc, 27 AS pxh, 1 AS sfqy FROM dual) s
ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)
WHEN MATCHED THEN
    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);
