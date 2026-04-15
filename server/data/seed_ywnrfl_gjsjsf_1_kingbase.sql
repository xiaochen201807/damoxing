-- 旧业务内容分类结果转 gjj_ywnrfl 导入脚本（Kingbase）
-- 基于 Oracle 版本脚本自动转换生成
-- 生成时间: 2026-04-15T17:27:51
-- 数据量: 27

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '1', '购买住房', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '2', '建造、翻建、大修住房', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '3', '偿还购房贷款本息', 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '4', '既有住宅加装电梯', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '5', '租赁住房', 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '6', '大病医疗', 6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '7', '物业费', 7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '8', '其他（部分）', 8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '9', '重大灾害', 9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '10', '家庭生活困难', 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '11', '司法扣划', 11, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '12', '离休、退休', 12, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '13', '完全丧失劳动能力，并与单位终止劳动关系', 13, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '14', '出境定居', 14, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '15', '死亡或宣告死亡', 15, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '16', '其他（销户）', 16, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '17', '灵活就业人员自由提取', 17, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '18', '封存满半年未再缴存', 18, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '19', '异地转移转出', 19, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '20', '灵活就业人员退出', 20, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '21', '其他住房消费', 21, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '22', '其他非住房消费', 22, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '23', '宣告失踪', 23, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '24', '缴纳房屋维修基金', 24, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '25', '车位费提取', 25, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '26', '休眠账户上缴', 26, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;

INSERT INTO public.gjj_ywnrfl (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)
VALUES ('1', '27', '购房税费提取', 27, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (gjsjsf, flbm) DO UPDATE
SET flmc = EXCLUDED.flmc,
    pxh = EXCLUDED.pxh,
    sfqy = EXCLUDED.sfqy,
    gxsj = CURRENT_TIMESTAMP;
