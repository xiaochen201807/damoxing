-- ============================================
-- 业务规则配置系统数据库初始化脚本 (达梦版)
-- ============================================

CREATE TABLE gjj_ywnrfl (
    id BIGINT AUTO_INCREMENT NOT NULL,
    gjsjsf VARCHAR2 (100 CHAR) NOT NULL,
    flbm VARCHAR2 (50 CHAR) NOT NULL,
    flmc VARCHAR2 (200 CHAR) NOT NULL,
    pxh NUMBER DEFAULT 0,
    sfqy NUMBER (1) DEFAULT 1,
    cjsj TIMESTAMP DEFAULT SYSTIMESTAMP,
    gxsj TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ywnrfl PRIMARY KEY (id),
    CONSTRAINT uq_ywnrfl_code UNIQUE (gjsjsf, flbm)
);

-- 1. 业务标准库主表 (规则模板定义)
CREATE TABLE gjj_ywbzk (
    id BIGINT AUTO_INCREMENT NOT NULL,
    pxh NUMBER DEFAULT 0, -- 排序号
    ywblbz VARCHAR2 (200 CHAR) NOT NULL, -- 业务办理标准
    zdybm VARCHAR2 (100 CHAR), -- 自定义编码
    ywbzz VARCHAR2 (100 CHAR), -- 业务标准值
    ywbzjg CLOB, -- 业务标准结果SQL
    ywblbzsm CLOB, -- 业务办理标准说明
    gjsjsf VARCHAR2 (100 CHAR), -- 关键数据算法
    ywnrfl VARCHAR2 (50 CHAR), -- 业务内容分类
    ywblfl VARCHAR2 (10 CHAR) DEFAULT '1', -- 业务办理分类: 1标准 2条件
    bzfl VARCHAR2 (50 CHAR), -- 标准分类
    cjsj TIMESTAMP DEFAULT SYSTIMESTAMP,
    gxsj TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ywbzk PRIMARY KEY (id)
);

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
);

-- 2. 业务标准库属性表 (规则模板绑定的要素属性)
CREATE TABLE gjj_ywbzksx (
    id BIGINT AUTO_INCREMENT NOT NULL,
    mbid BIGINT NOT NULL, -- 关联业务标准库的ID
    ywblbzdx VARCHAR2 (100 CHAR), -- 业务办理标准对象
    fwdxbq VARCHAR2 (100 CHAR), -- 服务对象标签 (Label)
    sxbm VARCHAR2 (50 CHAR), -- 属性编码
    ywblbzsx VARCHAR2 (100 CHAR), -- 业务办理标准属性 (如:贷款状态)
    sxly VARCHAR2 (20 CHAR), -- 属性来源 (page/sql)
    ywblbzyg CLOB, -- 业务办理标准语句 (当来源为sql时)
    cjsj TIMESTAMP DEFAULT SYSTIMESTAMP,
    gxsj TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ywbzksx PRIMARY KEY (id),
    CONSTRAINT fk_ywbzksx_mbid FOREIGN KEY (mbid) REFERENCES gjj_ywbzk (id) ON DELETE CASCADE
);

-- 3. 业务标准主表 (业务规则实例配置)
CREATE TABLE gjj_ywbz (
    id BIGINT AUTO_INCREMENT NOT NULL,
    mbid BIGINT, -- 关联业务标准库的模板ID
    ywsf VARCHAR2 (50 CHAR) NOT NULL, -- 业务算法
    ywnrfl VARCHAR2 (50 CHAR), -- 业务内容分类
    gzmc VARCHAR2 (200 CHAR) NOT NULL, -- 规则名称
    gzljsm CLOB, -- 规则逻辑说明
    yxj NUMBER DEFAULT 0, -- 优先级
    sfqy NUMBER (1) DEFAULT 1, -- 是否启用 (0/1)
    cjsj TIMESTAMP DEFAULT SYSTIMESTAMP,
    gxsj TIMESTAMP DEFAULT SYSTIMESTAMP,
    jgbh VARCHAR2 (50 CHAR), -- 机构编号 (新增支持多租户)
    zjgbh VARCHAR2 (50 CHAR), -- 子机构编号
    ywbzz VARCHAR2 (100 CHAR), -- 业务标准值 (从网关获取)
    CONSTRAINT pk_ywbz PRIMARY KEY (id)
);

-- 4. 业务标准属性表 (业务规则实例具体的参数/属性值)
CREATE TABLE gjj_ywbzsx (
    id BIGINT AUTO_INCREMENT NOT NULL,
    ywid BIGINT NOT NULL, -- 关联业务标准主表的ID
    row_index NUMBER DEFAULT 0, -- 行索引(排序)
    k1 VARCHAR2 (1000 CHAR),
    v1 VARCHAR2 (4000 CHAR),
    k2 VARCHAR2 (1000 CHAR),
    v2 VARCHAR2 (4000 CHAR),
    k3 VARCHAR2 (1000 CHAR),
    v3 VARCHAR2 (4000 CHAR),
    k4 VARCHAR2 (1000 CHAR),
    v4 VARCHAR2 (4000 CHAR),
    k5 VARCHAR2 (1000 CHAR),
    v5 VARCHAR2 (4000 CHAR),
    k6 VARCHAR2 (1000 CHAR),
    v6 VARCHAR2 (4000 CHAR),
    k7 VARCHAR2 (1000 CHAR),
    v7 VARCHAR2 (4000 CHAR),
    k8 VARCHAR2 (1000 CHAR),
    v8 VARCHAR2 (4000 CHAR),
    k9 VARCHAR2 (1000 CHAR),
    v9 VARCHAR2 (4000 CHAR),
    k10 VARCHAR2 (1000 CHAR),
    v10 VARCHAR2 (4000 CHAR),
    result CLOB, -- 结果列
    cjsj TIMESTAMP DEFAULT SYSTIMESTAMP,
    gxsj TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ywbzsx PRIMARY KEY (id),
    CONSTRAINT fk_ywbzsx_ywid FOREIGN KEY (ywid) REFERENCES gjj_ywbz (id) ON DELETE CASCADE
);

-- 5. 模型业务算法临时属性表
-- 结构按本地达梦库 `SP_TABLEDEF` / `DBMS_METADATA.GET_DDL` 导出结果整理
CREATE TABLE tmp_gjj_ywblsxz (
    pcid VARCHAR2(200) DEFAULT ' ' NOT NULL, -- 批次id
    key VARCHAR2(200) DEFAULT ' ' NOT NULL, -- 属性key
    value VARCHAR2(4000) -- 属性值
);

-- 6. 业务办理标准执行日志表
-- 结构按本地达梦库 `SP_TABLEDEF` / `DBMS_METADATA.GET_DDL` 导出结果整理
CREATE TABLE gjj_ywblbz_log (
    pcid VARCHAR2(200) DEFAULT ' ' NOT NULL, -- 批次id
    zxyj CLOB, -- 执行的sql语句
    cjsj TIMESTAMP(6) DEFAULT SYSTIMESTAMP, -- 插入时间
    yjlx VARCHAR2(10), -- 日志类型，1--sql语句，2--标准结果
    zxjg VARCHAR2(200) -- 执行结果
);

-- 7. 系统异常日志表
-- 结构按本地达梦库 `SP_TABLEDEF` / `DBMS_METADATA.GET_DDL` 导出结果整理
CREATE TABLE t_wa_sys_log_err (
    err_date DATE,
    name_proc VARCHAR2(200),
    err_code NUMBER,
    err_msg CLOB
);

-- ============================================
-- 创建索引
-- ============================================

-- 库表索引
CREATE INDEX idx_gjj_ywbzk_pxh ON gjj_ywbzk (pxh);
CREATE UNIQUE INDEX idx_gjj_ywbzk_zdybm ON gjj_ywbzk (zdybm);
CREATE INDEX idx_gjj_ywbzkhc_mbid ON gjj_ywbzkhc (mbid);
CREATE INDEX idx_gjj_ywnrfl_sf ON gjj_ywnrfl (gjsjsf, sfqy);

-- 库属性表索引
CREATE INDEX idx_gjj_ywbzksx_mb ON gjj_ywbzksx (mbid);

-- 业务配置表索引
CREATE INDEX idx_gjj_ywbz_mb ON gjj_ywbz (mbid);
CREATE INDEX idx_gjj_ywbz_yxj ON gjj_ywbz (yxj);
CREATE INDEX idx_gjj_ywbz_jg ON gjj_ywbz (jgbh, zjgbh);

-- 业务属性表索引
CREATE INDEX idx_gjj_ywbzsx_yw ON gjj_ywbzsx (ywid);
CREATE INDEX idx_gjj_ywbzsx_k1 ON gjj_ywbzsx (k1);
