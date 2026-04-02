-- ============================================
-- 业务标准升级投产脚本（达梦）
-- 适用改造点：1-5、8-10
-- 对应文档：docs/业务标准升级方案.md
-- ============================================
--
-- 执行前建议：
-- 1. 先完整备份目标库。
-- 2. 确认旧库已存在基础表：gjj_ywbzk / gjj_ywbz / gjj_ywbzksx / gjj_ywbzsx。
-- 3. 若 gjj_ywbzk.zdybm 已存在重复非空值，唯一索引会创建失败，请先清理后执行。
--
-- 说明：
-- - 改造点 1 仅涉及本地 JSON 配置，不涉及数据库 DDL。
-- - 本脚本按“对象不存在则创建、字段不存在则新增”的原则编写。
-- - 如现场已手工建过同名对象但结构不一致，请人工核对后再执行。

-- [改造点 2] 业务内容分类表 gjj_ywnrfl
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_tables
     WHERE table_name = 'GJJ_YWNRFL';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE gjj_ywnrfl (
                id BIGINT AUTO_INCREMENT NOT NULL,
                gjsjsf VARCHAR2(100 CHAR) NOT NULL,
                flbm VARCHAR2(50 CHAR) NOT NULL,
                flmc VARCHAR2(200 CHAR) NOT NULL,
                pxh NUMBER DEFAULT 0,
                sfqy NUMBER(1) DEFAULT 1,
                cjsj TIMESTAMP DEFAULT SYSTIMESTAMP,
                gxsj TIMESTAMP DEFAULT SYSTIMESTAMP,
                CONSTRAINT pk_ywnrfl PRIMARY KEY (id),
                CONSTRAINT uq_ywnrfl_code UNIQUE (gjsjsf, flbm)
            )';
    END IF;
END;
/

DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_indexes
     WHERE index_name = 'IDX_GJJ_YWNRFL_SF';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'CREATE INDEX idx_gjj_ywnrfl_sf ON gjj_ywnrfl (gjsjsf, sfqy)';
    END IF;
END;
/

-- [改造点 3] gjj_ywbzk 新增 zdybm
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_tab_columns
     WHERE table_name = 'GJJ_YWBZK'
       AND column_name = 'ZDYBM';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE gjj_ywbzk ADD zdybm VARCHAR2(100 CHAR)';
    END IF;
END;
/

DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_indexes
     WHERE index_name = 'IDX_GJJ_YWBZK_ZDYBM';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX idx_gjj_ywbzk_zdybm ON gjj_ywbzk (zdybm)';
    END IF;
END;
/

-- [改造点 4] gjj_ywbzk 新增 ywblfl，并补默认值
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_tab_columns
     WHERE table_name = 'GJJ_YWBZK'
       AND column_name = 'YWBLFL';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE gjj_ywbzk ADD ywblfl VARCHAR2(10 CHAR) DEFAULT ''1''';
    END IF;
END;
/

UPDATE gjj_ywbzk
   SET ywblfl = '1'
 WHERE ywblfl IS NULL;

-- [改造点 5] 互斥关系表 gjj_ywbzkhc
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_tables
     WHERE table_name = 'GJJ_YWBZKHC';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE gjj_ywbzkhc (
                id BIGINT AUTO_INCREMENT NOT NULL,
                mbid BIGINT NOT NULL,
                hcmbid BIGINT NOT NULL,
                cjsj TIMESTAMP DEFAULT SYSTIMESTAMP,
                gxsj TIMESTAMP DEFAULT SYSTIMESTAMP,
                CONSTRAINT pk_ywbzkhc PRIMARY KEY (id),
                CONSTRAINT uq_ywbzkhc_pair UNIQUE (mbid, hcmbid),
                CONSTRAINT fk_ywbzkhc_mbid FOREIGN KEY (mbid) REFERENCES gjj_ywbzk (id) ON DELETE CASCADE,
                CONSTRAINT fk_ywbzkhc_hcmbid FOREIGN KEY (hcmbid) REFERENCES gjj_ywbzk (id) ON DELETE CASCADE
            )';
    END IF;
END;
/

DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_indexes
     WHERE index_name = 'IDX_GJJ_YWBZKHC_MBID';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'CREATE INDEX idx_gjj_ywbzkhc_mbid ON gjj_ywbzkhc (mbid)';
    END IF;
END;
/

-- [改造点 8] gjj_ywbz 新增 ywbzz
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_tab_columns
     WHERE table_name = 'GJJ_YWBZ'
       AND column_name = 'YWBZZ';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE gjj_ywbz ADD ywbzz VARCHAR2(100 CHAR)';
    END IF;
END;
/

-- [改造点 10] gjj_ywbzk 新增提示语属性字段
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_tab_columns
     WHERE table_name = 'GJJ_YWBZK'
       AND column_name = 'TSYSXMC';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE gjj_ywbzk ADD tsysxmc VARCHAR2(200 CHAR)';
    END IF;
END;
/

DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_tab_columns
     WHERE table_name = 'GJJ_YWBZK'
       AND column_name = 'TSYSXDW';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE gjj_ywbzk ADD tsysxdw VARCHAR2(100 CHAR)';
    END IF;
END;
/

-- [改造点 9] 调试成功案例表 gjj_ywbz_debug_case
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_tables
     WHERE table_name = 'GJJ_YWBZ_DEBUG_CASE';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE gjj_ywbz_debug_case (
                id BIGINT AUTO_INCREMENT NOT NULL,
                ywsf VARCHAR2(50 CHAR),
                ywnrfl VARCHAR2(50 CHAR),
                case_name VARCHAR2(200 CHAR) NOT NULL,
                request_json CLOB NOT NULL,
                result_summary CLOB NOT NULL,
                creator_name VARCHAR2(100 CHAR),
                jgbh VARCHAR2(50 CHAR),
                zjgbh VARCHAR2(50 CHAR),
                cjsj TIMESTAMP DEFAULT SYSTIMESTAMP,
                gxsj TIMESTAMP DEFAULT SYSTIMESTAMP,
                CONSTRAINT pk_ywbz_debug_case PRIMARY KEY (id)
            )';
    END IF;
END;
/

DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_indexes
     WHERE index_name = 'IDX_GJJ_YWBZ_DEBUG_CASE_SCOPE';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'CREATE INDEX idx_gjj_ywbz_debug_case_scope ON gjj_ywbz_debug_case (jgbh, zjgbh, ywsf, ywnrfl)';
    END IF;
END;
/

-- 表及列注释
COMMENT ON TABLE gjj_ywnrfl IS '业务内容分类基础表';
COMMENT ON COLUMN gjj_ywnrfl.id IS '主键ID';
COMMENT ON COLUMN gjj_ywnrfl.gjsjsf IS '关键数据算法编码';
COMMENT ON COLUMN gjj_ywnrfl.flbm IS '业务内容分类编码';
COMMENT ON COLUMN gjj_ywnrfl.flmc IS '业务内容分类名称';
COMMENT ON COLUMN gjj_ywnrfl.pxh IS '排序号';
COMMENT ON COLUMN gjj_ywnrfl.sfqy IS '是否启用';
COMMENT ON COLUMN gjj_ywnrfl.cjsj IS '创建时间';
COMMENT ON COLUMN gjj_ywnrfl.gxsj IS '更新时间';

COMMENT ON TABLE gjj_ywbzk IS '业务标准库模板主表';
COMMENT ON COLUMN gjj_ywbzk.id IS '主键ID';
COMMENT ON COLUMN gjj_ywbzk.pxh IS '排序号';
COMMENT ON COLUMN gjj_ywbzk.ywblbz IS '业务办理标准';
COMMENT ON COLUMN gjj_ywbzk.tsysxmc IS '提示语属性名称';
COMMENT ON COLUMN gjj_ywbzk.tsysxdw IS '提示语属性单位';
COMMENT ON COLUMN gjj_ywbzk.zdybm IS '自定义编码';
COMMENT ON COLUMN gjj_ywbzk.ywbzz IS '业务标准值';
COMMENT ON COLUMN gjj_ywbzk.ywbzjg IS '业务标准结果执行语句';
COMMENT ON COLUMN gjj_ywbzk.ywblbzsm IS '业务办理标准说明';
COMMENT ON COLUMN gjj_ywbzk.gjsjsf IS '关键数据算法编码';
COMMENT ON COLUMN gjj_ywbzk.ywnrfl IS '业务内容分类编码';
COMMENT ON COLUMN gjj_ywbzk.ywblfl IS '业务办理分类(1标准 2条件)';
COMMENT ON COLUMN gjj_ywbzk.bzfl IS '业务办理标准分类';
COMMENT ON COLUMN gjj_ywbzk.cjsj IS '创建时间';
COMMENT ON COLUMN gjj_ywbzk.gxsj IS '更新时间';

COMMENT ON TABLE gjj_ywbzkhc IS '业务标准互斥关系表';
COMMENT ON COLUMN gjj_ywbzkhc.id IS '主键ID';
COMMENT ON COLUMN gjj_ywbzkhc.mbid IS '当前业务标准模板ID';
COMMENT ON COLUMN gjj_ywbzkhc.hcmbid IS '互斥业务标准模板ID';
COMMENT ON COLUMN gjj_ywbzkhc.cjsj IS '创建时间';
COMMENT ON COLUMN gjj_ywbzkhc.gxsj IS '更新时间';

COMMENT ON TABLE gjj_ywbzksx IS '业务标准库属性定义表';
COMMENT ON COLUMN gjj_ywbzksx.id IS '主键ID';
COMMENT ON COLUMN gjj_ywbzksx.mbid IS '所属业务标准模板ID';
COMMENT ON COLUMN gjj_ywbzksx.ywblbzdx IS '业务办理标准属性所属对象编码';
COMMENT ON COLUMN gjj_ywbzksx.fwdxbq IS '服务对象标签';
COMMENT ON COLUMN gjj_ywbzksx.sxbm IS '属性名称/展示名称';
COMMENT ON COLUMN gjj_ywbzksx.ywblbzsx IS '属性编码/程序化标识';
COMMENT ON COLUMN gjj_ywbzksx.sxly IS '属性来源(page/sql)';
COMMENT ON COLUMN gjj_ywbzksx.ywblbzyg IS '属性来源执行语句';
COMMENT ON COLUMN gjj_ywbzksx.cjsj IS '创建时间';
COMMENT ON COLUMN gjj_ywbzksx.gxsj IS '更新时间';

COMMENT ON TABLE gjj_ywbz IS '业务规则配置主表';
COMMENT ON COLUMN gjj_ywbz.id IS '主键ID';
COMMENT ON COLUMN gjj_ywbz.mbid IS '关联业务标准模板ID';
COMMENT ON COLUMN gjj_ywbz.ywsf IS '业务算法编码';
COMMENT ON COLUMN gjj_ywbz.ywnrfl IS '业务内容分类编码';
COMMENT ON COLUMN gjj_ywbz.gzmc IS '规则名称';
COMMENT ON COLUMN gjj_ywbz.gzljsm IS '规则逻辑说明';
COMMENT ON COLUMN gjj_ywbz.yxj IS '优先级';
COMMENT ON COLUMN gjj_ywbz.sfqy IS '是否启用';
COMMENT ON COLUMN gjj_ywbz.cjsj IS '创建时间';
COMMENT ON COLUMN gjj_ywbz.gxsj IS '更新时间';
COMMENT ON COLUMN gjj_ywbz.jgbh IS '机构编号';
COMMENT ON COLUMN gjj_ywbz.zjgbh IS '子机构编号';
COMMENT ON COLUMN gjj_ywbz.ywbzz IS '业务标准值';

COMMENT ON TABLE gjj_ywbzsx IS '业务规则参数明细表';
COMMENT ON COLUMN gjj_ywbzsx.id IS '主键ID';
COMMENT ON COLUMN gjj_ywbzsx.ywid IS '所属业务规则ID';
COMMENT ON COLUMN gjj_ywbzsx.row_index IS '明细行序号';
COMMENT ON COLUMN gjj_ywbzsx.k1 IS '参数编码1';
COMMENT ON COLUMN gjj_ywbzsx.v1 IS '参数值1';
COMMENT ON COLUMN gjj_ywbzsx.k2 IS '参数编码2';
COMMENT ON COLUMN gjj_ywbzsx.v2 IS '参数值2';
COMMENT ON COLUMN gjj_ywbzsx.k3 IS '参数编码3';
COMMENT ON COLUMN gjj_ywbzsx.v3 IS '参数值3';
COMMENT ON COLUMN gjj_ywbzsx.k4 IS '参数编码4';
COMMENT ON COLUMN gjj_ywbzsx.v4 IS '参数值4';
COMMENT ON COLUMN gjj_ywbzsx.k5 IS '参数编码5';
COMMENT ON COLUMN gjj_ywbzsx.v5 IS '参数值5';
COMMENT ON COLUMN gjj_ywbzsx.k6 IS '参数编码6';
COMMENT ON COLUMN gjj_ywbzsx.v6 IS '参数值6';
COMMENT ON COLUMN gjj_ywbzsx.k7 IS '参数编码7';
COMMENT ON COLUMN gjj_ywbzsx.v7 IS '参数值7';
COMMENT ON COLUMN gjj_ywbzsx.k8 IS '参数编码8';
COMMENT ON COLUMN gjj_ywbzsx.v8 IS '参数值8';
COMMENT ON COLUMN gjj_ywbzsx.k9 IS '参数编码9';
COMMENT ON COLUMN gjj_ywbzsx.v9 IS '参数值9';
COMMENT ON COLUMN gjj_ywbzsx.k10 IS '参数编码10';
COMMENT ON COLUMN gjj_ywbzsx.v10 IS '参数值10';
COMMENT ON COLUMN gjj_ywbzsx.result IS '结果值';
COMMENT ON COLUMN gjj_ywbzsx.cjsj IS '创建时间';
COMMENT ON COLUMN gjj_ywbzsx.gxsj IS '更新时间';

COMMENT ON TABLE gjj_ywbz_debug_case IS '业务规则调试成功案例表';
COMMENT ON COLUMN gjj_ywbz_debug_case.id IS '主键ID';
COMMENT ON COLUMN gjj_ywbz_debug_case.ywsf IS '业务算法编码';
COMMENT ON COLUMN gjj_ywbz_debug_case.ywnrfl IS '业务内容分类编码';
COMMENT ON COLUMN gjj_ywbz_debug_case.case_name IS '案例名称';
COMMENT ON COLUMN gjj_ywbz_debug_case.request_json IS '调试请求报文';
COMMENT ON COLUMN gjj_ywbz_debug_case.result_summary IS '调试结果摘要';
COMMENT ON COLUMN gjj_ywbz_debug_case.creator_name IS '创建人';
COMMENT ON COLUMN gjj_ywbz_debug_case.jgbh IS '机构编号';
COMMENT ON COLUMN gjj_ywbz_debug_case.zjgbh IS '子机构编号';
COMMENT ON COLUMN gjj_ywbz_debug_case.cjsj IS '创建时间';
COMMENT ON COLUMN gjj_ywbz_debug_case.gxsj IS '更新时间';

COMMIT;

-- 可选校验：
-- SELECT table_name FROM user_tables
--  WHERE table_name IN ('GJJ_YWNRFL', 'GJJ_YWBZKHC', 'GJJ_YWBZ_DEBUG_CASE');
--
-- SELECT column_name FROM user_tab_columns
--  WHERE table_name = 'GJJ_YWBZK'
--    AND column_name IN ('ZDYBM', 'YWBLFL', 'TSYSXMC', 'TSYSXDW');
--
-- SELECT column_name FROM user_tab_columns
--  WHERE table_name = 'GJJ_YWBZ'
--    AND column_name = 'YWBZZ';
