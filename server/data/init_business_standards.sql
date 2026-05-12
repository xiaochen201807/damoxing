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
DROP TABLE IF EXISTS gjj_ywbzkhc;
DROP TABLE IF EXISTS gjj_ywbz_debug_case;
DROP TABLE IF EXISTS gjj_ywnrfl;

CREATE TABLE gjj_ywnrfl (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
    gjsjsf VARCHAR(100) NOT NULL, -- 关键数据算法编码
    flbm VARCHAR(50) NOT NULL, -- 业务内容分类编码
    flmc VARCHAR(200) NOT NULL, -- 业务内容分类名称
    quanzhong INTEGER, -- 权重值
    pxh INTEGER DEFAULT 0, -- 排序号
    sfqy BOOLEAN DEFAULT 1, -- 是否启用
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 更新时间
);

-- 1. 业务标准库主表 (规则模板定义)
CREATE TABLE gjj_ywbzk (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
    pxh INTEGER DEFAULT 0, -- 排序号
    ywblbz VARCHAR(200) NOT NULL, -- 业务办理标准
    tsysxmc VARCHAR(200), -- 提示语属性名称
    tsysxdw VARCHAR(100), -- 提示语属性单位
    zdybm VARCHAR(100), -- 自定义编码
    ywbzz VARCHAR(100), -- 业务标准值
    ywbzjg TEXT, -- 业务标准结果执行语句
    fenzhi INTEGER, -- 风险分值
    ywblbzsm TEXT, -- 业务办理标准说明
    gjsjsf VARCHAR(100), -- 关键数据算法编码
    ywnrfl VARCHAR(50), -- 业务内容分类编码
    ywblfl VARCHAR(10) DEFAULT '1', -- 业务办理分类: 1标准 2条件 3风险
    bzfl VARCHAR(50), -- 业务办理标准分类
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 更新时间
);

CREATE TABLE gjj_ywbzkhc (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
    mbid INTEGER NOT NULL, -- 当前业务标准模板ID
    hcmbid INTEGER NOT NULL, -- 互斥业务标准模板ID
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 更新时间
    FOREIGN KEY (mbid) REFERENCES gjj_ywbzk (id) ON DELETE CASCADE,
    FOREIGN KEY (hcmbid) REFERENCES gjj_ywbzk (id) ON DELETE CASCADE
);

-- 2. 业务标准库属性表 (规则模板绑定的要素属性)
CREATE TABLE gjj_ywbzksx (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
    mbid INTEGER NOT NULL, -- 关联业务标准库的ID
    ywblbzdx VARCHAR(100), -- 业务办理标准属性所属对象编码
    fwdxbq VARCHAR(100), -- 服务对象标签
    sxbm VARCHAR(50), -- 属性名称/展示名称
    ywblbzsx VARCHAR(100), -- 属性编码/程序化标识
    sxly VARCHAR(20), -- 属性来源 (page/sql)
    ywblbzyg TEXT, -- 属性来源执行语句
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 更新时间
    FOREIGN KEY (mbid) REFERENCES gjj_ywbzk (id) ON DELETE CASCADE
);

-- 3. 业务标准主表 (业务规则实例配置)
CREATE TABLE gjj_ywbz (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
    mbid INTEGER, -- 关联业务标准库的模板ID
    ywsf VARCHAR(50) NOT NULL, -- 业务算法编码
    ywnrfl VARCHAR(50), -- 业务内容分类编码
    gzmc VARCHAR(200) NOT NULL, -- 规则名称
    gzljsm TEXT, -- 规则逻辑说明
    yxj INTEGER DEFAULT 0, -- 优先级
    sfqy BOOLEAN DEFAULT 1, -- 是否启用
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 更新时间
);

-- 4. 业务标准属性表 (业务规则实例具体的参数/属性值)
CREATE TABLE gjj_ywbzsx (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
    ywid INTEGER NOT NULL, -- 关联业务标准主表的ID
    sxmc VARCHAR(100) NOT NULL, -- 属性名称
    sxz TEXT, -- 属性值
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 更新时间
    FOREIGN KEY (ywid) REFERENCES gjj_ywbz (id) ON DELETE CASCADE
);

CREATE TABLE gjj_ywbz_debug_case (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
    ywsf VARCHAR(50), -- 业务算法编码
    ywnrfl VARCHAR(50), -- 业务内容分类编码
    case_name VARCHAR(200) NOT NULL, -- 案例名称
    request_json TEXT NOT NULL, -- 调试请求报文
    result_summary TEXT NOT NULL, -- 调试结果摘要
    creator_name VARCHAR(100), -- 创建人
    jgbh VARCHAR(50), -- 机构编号
    zjgbh VARCHAR(50), -- 子机构编号
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 更新时间
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
        gjsjsf,
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
        ywblbzdx,
        fwdxbq,
        ywblbzsx,
        sxbm,
        sxly
    )
VALUES (
        1,
        'depositor',
        '缴存人',
        '职工类型',
        'zglx',
        'page'
    ),
    (
        1,
        'depositor',
        '缴存人',
        '最高可贷额度',
        'zgkded',
        'page'
    ),
    (
        2,
        'depositor',
        '缴存人',
        '职工类型',
        'zglx',
        'page'
    ),
    (
        2,
        'depositor',
        '缴存人',
        '子女数量',
        'znsl',
        'page'
    ),
    (
        2,
        'depositor',
        '缴存人',
        '最高可贷额度',
        'zgkded',
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
INSERT INTO
    gjj_ywbzsx (ywid, sxmc, sxz)
VALUES (1, '职工类型', '正式员工'),
    (1, '最高可贷额度', '500000'),
    (2, '职工类型', '正式员工'),
    (2, '子女数量', '2'),
    (2, '最高可贷额度', '800000');

-- ============================================
-- 创建索引
-- ============================================

-- 库表索引
CREATE INDEX IF NOT EXISTS idx_gjj_ywbzk_pxh ON gjj_ywbzk (pxh);

CREATE INDEX IF NOT EXISTS idx_gjj_ywbzk_sf ON gjj_ywbzk (gjsjsf);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gjj_ywbzk_zdybm ON gjj_ywbzk (zdybm);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gjj_ywbzkhc_pair ON gjj_ywbzkhc (mbid, hcmbid);
CREATE INDEX IF NOT EXISTS idx_gjj_ywbzkhc_mbid ON gjj_ywbzkhc (mbid);

CREATE INDEX IF NOT EXISTS idx_gjj_ywnrfl_sf ON gjj_ywnrfl (gjsjsf, sfqy);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gjj_ywnrfl_code ON gjj_ywnrfl (gjsjsf, flbm);

-- 库属性表索引
CREATE INDEX IF NOT EXISTS idx_gjj_ywbzksx_mb ON gjj_ywbzksx (mbid);

-- 业务配置表索引
CREATE INDEX IF NOT EXISTS idx_gjj_ywbz_mb ON gjj_ywbz (mbid);

CREATE INDEX IF NOT EXISTS idx_gjj_ywbz_yxj ON gjj_ywbz (yxj);

-- 业务属性表索引
CREATE INDEX IF NOT EXISTS idx_gjj_ywbzsx_yw ON gjj_ywbzsx (ywid);

CREATE INDEX IF NOT EXISTS idx_gjj_ywbzsx_mc ON gjj_ywbzsx (sxmc);
CREATE INDEX IF NOT EXISTS idx_gjj_ywbz_debug_case_scope ON gjj_ywbz_debug_case (jgbh, zjgbh, ywsf, ywnrfl);

-- [业务分类同步] 为算法 20 同步算法 1 的分类数据
INSERT INTO gjj_ywnrfl (gjsjsf, flbm, flmc, quanzhong, pxh, sfqy)
SELECT '20', flbm, flmc, quanzhong, pxh, sfqy
FROM gjj_ywnrfl
WHERE gjsjsf = '1'
  AND NOT EXISTS (
      SELECT 1 FROM gjj_ywnrfl t2 
      WHERE t2.gjsjsf = '20' AND t2.flbm = gjj_ywnrfl.flbm
  );
