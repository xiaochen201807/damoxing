DELETE FROM public.gjj_ywbzsx;
DELETE FROM public.gjj_ywbzksx;
DELETE FROM public.gjj_ywbz WHERE id = 990001;
DELETE FROM public.gjj_ywbzk WHERE id = 990001;
DELETE FROM public.pt_dx_ggcs_mx WHERE id IN (900001, 900002);
DELETE FROM public.pt_dx_ggcs WHERE ggcs_wybs IN ('TEST_BZ', 'TEST_BZ_CHILD');
DELETE FROM public.pt_dxsl_1305282028_01 WHERE dx_01_dxbh = 'ZJG001';

INSERT INTO public.gjj_ywbzk (
    id, pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl, cjsj, gxsj
) VALUES (
    990001, 0, '验证标准值编码解析', 'TEST_BZ', NULL, '验证子机构参数优先于机构参数', '1', NULL, '1',
    '2026-03-17 00:19:01.145618', '2026-03-17 00:19:01.145618'
);

INSERT INTO public.gjj_ywbz (
    id, mbid, ywsf, ywnrfl, gzmc, gzljsm, yxj, sfqy, cjsj, gxsj, jgbh, zjgbh, ywbzz
) VALUES (
    990001, 990001, '3', NULL, '验证标准值编码解析', '验证标准值编码转实际值', 1, 1,
    '2026-03-17 00:19:01.15555', '2026-03-17 00:19:01.15555', '1305282028', 'ZJG001', NULL
);

INSERT INTO public.pt_dx_ggcs (ggcs_wybs, jgbh) VALUES ('TEST_BZ', '1305282028');
INSERT INTO public.pt_dx_ggcs (ggcs_wybs, jgbh) VALUES ('TEST_BZ_CHILD', '1305282028');

INSERT INTO public.pt_dx_ggcs_mx (id, ggcs_wybs, jgbh, cs, jgbs, csz)
VALUES (900001, 'TEST_BZ', '1305282028', 'cs1', NULL, '12');

INSERT INTO public.pt_dx_ggcs_mx (id, ggcs_wybs, jgbh, cs, jgbs, csz)
VALUES (900002, 'TEST_BZ_CHILD', '1305282028-01', 'cs1', '100', '18');

INSERT INTO public.pt_dxsl_1305282028_01 (dx_01_dxbh, dx_01_zjbzxbm)
VALUES ('ZJG001', 'A100');
