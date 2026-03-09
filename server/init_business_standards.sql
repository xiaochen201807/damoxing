-- ============================================
-- 业务规则配置系统数据库初始化脚本 (4表通用版)
-- ============================================

-- 先删除旧表以确保新架构生效 (开发环境适用)
DROP TABLE IF EXISTS gjj_ywbzsx;
-- 业务标准属性表
DROP TABLE IF EXISTS gjj_ywbz;
-- 业务标准主表
DROP TABLE IF EXISTS gjj_ywbzksx;
-- 业务标准库属性表
DROP TABLE IF EXISTS gjj_ywbzk;
-- 业务标准库主表

-- 1. 业务标准库主表 (规则模板定义)
CREATE TABLE gjj_ywbzk (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pxh INTEGER DEFAULT 0, -- 排序号
    ywblbz VARCHAR(200) NOT NULL, -- 业务办理标准
    ywbzz VARCHAR(100), -- 业务标准值
    ywbzjg TEXT, -- 业务标准结果SQL
    ywblbzsm TEXT, -- 业务办理标准说明
    ywsf VARCHAR(100), -- 业务算法
    bzfl VARCHAR(50), -- 标准分类
    ywnrfl VARCHAR(50), -- 业务内容分类
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 业务标准库属性表 (规则模板绑定的要素属性)
CREATE TABLE gjj_ywbzksx (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mbid INTEGER NOT NULL, -- 关联业务标准库的ID
    fwdx VARCHAR(100), -- 服务对象
    fwdxbq VARCHAR(100), -- 服务对象标签 (Label)
    sxmc VARCHAR(100), -- 属性名称 (如:贷款状态)
    sxly VARCHAR(20), -- 属性来源 (page/sql)
    sqlyj TEXT, -- SQL语句 (当来源为sql时)
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mbid) REFERENCES gjj_ywbzk (id) ON DELETE CASCADE
);

-- 3. 业务标准主表 (业务规则实例配置)
CREATE TABLE gjj_ywbz (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mbid INTEGER, -- 关联业务标准库的模板ID
    ywsf VARCHAR(50) NOT NULL, -- 业务算法
    ywnrfl VARCHAR(50), -- 业务内容分类
    gzmc VARCHAR(200) NOT NULL, -- 规则名称
    gzljsm TEXT, -- 规则逻辑说明
    yxj INTEGER DEFAULT 0, -- 优先级
    sfqy BOOLEAN DEFAULT 1, -- 是否启用
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 业务标准属性表 (业务规则实例具体的参数/属性值)
CREATE TABLE gjj_ywbzsx (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ywid INTEGER NOT NULL, -- 关联业务标准主表的ID
    row_index INTEGER DEFAULT 0, -- 行索引(排序)
    k1 TEXT,
    v1 TEXT,
    k2 TEXT,
    v2 TEXT,
    k3 TEXT,
    v3 TEXT,
    k4 TEXT,
    v4 TEXT,
    k5 TEXT,
    v5 TEXT,
    k6 TEXT,
    v6 TEXT,
    k7 TEXT,
    v7 TEXT,
    k8 TEXT,
    v8 TEXT,
    k9 TEXT,
    v9 TEXT,
    k10 TEXT,
    v10 TEXT,
    result TEXT, -- 结果列
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ywid) REFERENCES gjj_ywbz (id) ON DELETE CASCADE
);

-- ============================================
-- 插入示例数据
-- ============================================

-- 1. 业务标准库示例 (规则模板)
INSERT INTO
    gjj_ywbzk (
        pxh,
        ywblbz,
        ywbzz,
        ywblbzsm,
        ywsf,
        bzfl,
        ywnrfl
    )
VALUES (
        1,
        '职工类型为A,最高可贷额度为X元',
        '——',
        '按职工类型A的规则设定额度上限',
        '可贷款金额',
        '——',
        '工具接口'
    ),
    (
        2,
        '职工类型为A,且子女数量为B,最高可贷额度为X元',
        '——',
        '结合职工类型与子女数量设定额度',
        '可贷款金额',
        '——',
        '工具接口'
    ),
    (
        6,
        '提取金额为缴存人实时账户余额',
        '——',
        '缴存人业务账户实时余额',
        '可提取金额',
        '——',
        '工具接口'
    ),
    (
        8,
        '提取精度:个位、十位、百位、两位小数',
        '百位',
        '计算结果精度控制',
        '可提取金额',
        '——',
        '工具接口'
    );

-- 2. 业务标准库属性示例 (模板要素)
INSERT INTO
    gjj_ywbzksx (
        mbid,
        fwdx,
        fwdxbq,
        sxmc,
        sxly
    )
VALUES (
        1,
        'depositor',
        '缴存人',
        '职工类型',
        'page'
    ),
    (
        1,
        'depositor',
        '缴存人',
        '最高可贷额度',
        'page'
    ),
    (
        2,
        'depositor',
        '缴存人',
        '职工类型',
        'page'
    ),
    (
        2,
        'depositor',
        '缴存人',
        '子女数量',
        'page'
    ),
    (
        2,
        'depositor',
        '缴存人',
        '最高可贷额度',
        'page'
    );

-- 3. 业务标准配置示例 (规则实例)
INSERT INTO
    gjj_ywbz (
        id,
        mbid,
        ywsf,
        ywnrfl,
        gzmc,
        gzljsm,
        yxj,
        sfqy
    )
VALUES (
        1,
        1,
        '可贷款金额',
        NULL,
        '正式员工额度标准',
        '正式员工最高50万',
        1,
        1
    ),
    (
        2,
        2,
        '可贷款金额',
        NULL,
        '二孩家庭额度标准',
        '正式员工且二孩最高80万',
        2,
        1
    );

-- 4. 业务标准属性示例 (规则参数值 - 替代 JSON)
-- 4. 业务标准属性示例 (规则参数值 - 宽表结构)
INSERT INTO
    gjj_ywbzsx (
        ywid,
        row_index,
        k1,
        v1,
        k2,
        v2,
        k3,
        v3,
        result
    )
VALUES (
        1,
        0,
        '职工类型',
        '正式员工',
        '最高可贷额度',
        '500000',
        NULL,
        NULL,
        NULL
    ),
    (
        2,
        0,
        '职工类型',
        '正式员工',
        '子女数量',
        '2',
        '最高可贷额度',
        '800000',
        NULL
    );

-- ============================================
-- 创建索引
-- ============================================

-- 库表索引
CREATE INDEX IF NOT EXISTS idx_gjj_ywbzk_pxh ON gjj_ywbzk (pxh);

CREATE INDEX IF NOT EXISTS idx_gjj_ywbzk_sf ON gjj_ywbzk (ywsf);

-- 库属性表索引
CREATE INDEX IF NOT EXISTS idx_gjj_ywbzksx_mb ON gjj_ywbzksx (mbid);

-- 业务配置表索引
CREATE INDEX IF NOT EXISTS idx_gjj_ywbz_mb ON gjj_ywbz (mbid);

CREATE INDEX IF NOT EXISTS idx_gjj_ywbz_yxj ON gjj_ywbz (yxj);

-- 业务属性表索引
CREATE INDEX IF NOT EXISTS idx_gjj_ywbzsx_yw ON gjj_ywbzsx (ywid);

CREATE INDEX IF NOT EXISTS idx_gjj_ywbzsx_mc ON gjj_ywbzsx (k1);
