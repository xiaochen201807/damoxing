-- 业务标准库全量备份脚本
-- 生成时间: 2/7/2026, 7:44:34 AM

BEGIN TRANSACTION;

DELETE FROM gjj_ywbzkhc;
DELETE FROM gjj_ywbzksx;
DELETE FROM gjj_ywbzk;

-- 插入业务标准主表
INSERT INTO gjj_ywbzk (id, pxh, ywblbz, zdybm, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, ywblfl, bzfl, cjsj, gxsj) VALUES (1, 1, '职工类型为A,最高可贷额度为X元', 'STD_KDK_001', '——', '', '按职工类型A的规则设定额度上限', 'kdkje', '工具接口', '1', '——', '2026-02-06 08:52:45', '2026-02-06 08:52:45');
INSERT INTO gjj_ywbzk (id, pxh, ywblbz, zdybm, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, ywblfl, bzfl, cjsj, gxsj) VALUES (2, 2, '职工类型为A,且子女数量为B,最高可贷额度为X元', 'STD_KDK_002', '——', '', '结合职工类型与子女数量设定额度', 'kdkje', '工具接口', '1', '——', '2026-02-06 08:52:45', '2026-02-06 08:52:45');
INSERT INTO gjj_ywbzk (id, pxh, ywblbz, zdybm, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, ywblfl, bzfl, cjsj, gxsj) VALUES (3, 6, '提取金额为缴存人实时账户余额', 'STD_KTQ_001', '——', '', '缴存人业务账户实时余额', 'ktqje', '工具接口', '1', '——', '2026-02-06 08:52:45', '2026-02-06 08:52:45');
INSERT INTO gjj_ywbzk (id, pxh, ywblbz, zdybm, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, ywblfl, bzfl, cjsj, gxsj) VALUES (4, 8, '提取精度:个位、十位、百位、两位小数', 'STD_KTQ_002', '百位', '', '计算结果精度控制', 'ktqje', '工具接口', '1', '——', '2026-02-06 08:52:45', '2026-02-06 08:52:45');
INSERT INTO gjj_ywbzk (id, pxh, ywblbz, zdybm, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, ywblfl, bzfl, cjsj, gxsj) VALUES (5, 6, '提取金额为缴存人实时账户余额', 'STD_KTQ_003', '——', '', '缴存人业务账户实时余额', 'ktqje', '工具接口', '1', '——', '2026-02-06 09:41:22', '2026-02-06 09:41:22');
INSERT INTO gjj_ywbzk (id, pxh, ywblbz, zdybm, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, ywblfl, bzfl, cjsj, gxsj) VALUES (6, 6, '提取金额为缴存人实时账户余额', 'STD_KTQ_004', '——', '', '缴存人业务账户实时余额', 'ktqje', '工具接口', '1', '——', '2026-02-06 09:41:41', '2026-02-06 09:41:41');

-- 插入业务标准属性表
INSERT INTO gjj_ywbzksx (id, mbid, ywblbzdx, fwdxbq, ywblbzsx, sxly, ywblbzyg, cjsj, gxsj) VALUES (8, 1, 'depositor', '缴存人', '职工类型', 'page', '', '2026-02-06 08:52:45', '2026-02-06 08:52:45');
INSERT INTO gjj_ywbzksx (id, mbid, ywblbzdx, fwdxbq, ywblbzsx, sxly, ywblbzyg, cjsj, gxsj) VALUES (9, 1, 'depositor', '缴存人', '最高可贷额度', 'page', '', '2026-02-06 08:52:45', '2026-02-06 08:52:45');
INSERT INTO gjj_ywbzksx (id, mbid, ywblbzdx, fwdxbq, ywblbzsx, sxly, ywblbzyg, cjsj, gxsj) VALUES (10, 2, 'depositor', '缴存人', '职工类型', 'page', '', '2026-02-06 08:52:45', '2026-02-06 08:52:45');
INSERT INTO gjj_ywbzksx (id, mbid, ywblbzdx, fwdxbq, ywblbzsx, sxly, ywblbzyg, cjsj, gxsj) VALUES (11, 2, 'depositor', '缴存人', '子女数量', 'page', '', '2026-02-06 08:52:45', '2026-02-06 08:52:45');
INSERT INTO gjj_ywbzksx (id, mbid, ywblbzdx, fwdxbq, ywblbzsx, sxly, ywblbzyg, cjsj, gxsj) VALUES (12, 2, 'depositor', '缴存人', '最高可贷额度', 'page', '', '2026-02-06 08:52:45', '2026-02-06 08:52:45');
INSERT INTO gjj_ywbzksx (id, mbid, ywblbzdx, fwdxbq, ywblbzsx, sxly, ywblbzyg, cjsj, gxsj) VALUES (13, 5, '缴存人', '缴存人', '最高可贷额度', 'page', '', '2026-02-06 09:41:22', '2026-02-06 09:41:22');
INSERT INTO gjj_ywbzksx (id, mbid, ywblbzdx, fwdxbq, ywblbzsx, sxly, ywblbzyg, cjsj, gxsj) VALUES (14, 6, '缴存人', '缴存人', '职工类型', 'page', '', '2026-02-06 09:41:41', '2026-02-06 09:41:41');

COMMIT;
