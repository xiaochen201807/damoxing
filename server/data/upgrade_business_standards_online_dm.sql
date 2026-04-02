-- ============================================
-- 业务标准升级投产脚本（达梦）
-- 适用改造点：1-5、8-9
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

COMMIT;

-- 可选校验：
-- SELECT table_name FROM user_tables
--  WHERE table_name IN ('GJJ_YWNRFL', 'GJJ_YWBZKHC', 'GJJ_YWBZ_DEBUG_CASE');
--
-- SELECT column_name FROM user_tab_columns
--  WHERE table_name = 'GJJ_YWBZK'
--    AND column_name IN ('ZDYBM', 'YWBLFL');
--
-- SELECT column_name FROM user_tab_columns
--  WHERE table_name = 'GJJ_YWBZ'
--    AND column_name = 'YWBZZ';
