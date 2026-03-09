# 业务标准单源维护方案

## 1. 背景

自 2026-03-09 起，业务标准相关数据调整为“单源维护、多环境全量接收”模式：

- 仅模型机构允许新增、编辑、删除业务标准库数据
- 其他环境不允许手工维护标准库，只允许接收全量导入
- 业务标准规则表 `gjj_ywbz` 继续通过 `mbid` 引用标准库表 `gjj_ywbzk.id`
- 不再为 `gjj_ywbz.mbid -> gjj_ywbzk.id` 保留数据库外键约束

该方案的目标是：

- 保留当前标准库全量导入逻辑，减少程序改动
- 避免在标准库全量导入时受到外键限制
- 通过环境级别的写入管控，替代数据库层的强约束

---

## 2. 设计结论

本方案采用以下原则：

1. `gjj_ywbzk.id` 继续作为标准模板的唯一标识
2. `gjj_ywbz.mbid` 继续作为规则表对标准库的关联字段
3. 不新增 `template_code` 等业务键字段
4. 取消 `gjj_ywbz.mbid -> gjj_ywbzk.id` 的数据库外键约束
5. 通过“仅模型机构可维护标准库”的规则保证数据一致性
6. 其他环境只允许通过全量导入覆盖标准库数据

适用前提：

- 标准库新增、删除、调整只发生在模型机构
- 其他环境不允许自行新增标准库数据
- 其他环境对标准库的更新方式只有“全量导入”
- 全量导入时需要保留原始 `id`

如果上述前提被打破，则该方案的数据一致性风险会明显升高。

---

## 3. 为什么不再保留数据库外键

原设计中，`gjj_ywbz.mbid -> gjj_ywbzk.id` 使用数据库外键约束。

问题在于当前标准库导入逻辑仍然包含以下过程：

1. 删除 `gjj_ywbzksx`
2. 删除 `gjj_ywbzk`
3. 再插入新的标准库数据

在存在 `gjj_ywbz` 数据引用 `gjj_ywbzk.id` 的情况下：

- 如果使用 `ON DELETE SET NULL`，会出现静默断链
- 如果改为 `RESTRICT/NO ACTION`，会导致标准库全量导入失败

由于当前系统仍然离不开标准库全量导入，因此最终选择：

- 去掉该外键约束
- 保留现有导入机制
- 将一致性保证责任上移到应用管理规则和运维流程

---

## 4. 数据模型约束

### 保留的关联关系

- `gjj_ywbzksx.mbid -> gjj_ywbzk.id`
- `gjj_ywbz.mbid -> gjj_ywbzk.id`（逻辑关联，非数据库外键）
- `gjj_ywbzsx.ywid -> gjj_ywbz.id`

### 调整后的含义

- `gjj_ywbz.mbid` 仍然必须写入有效模板 ID
- 但数据库不再自动校验该 ID 是否真实存在于 `gjj_ywbzk`
- 因此必须依赖源环境统一维护和全量导入保号机制，确保逻辑一致

---

## 5. 环境管理策略

当前系统已支持基于多数据源登录态中的 `mechanismMmodel` 判断机构运行环境，因此业务标准库的维护能力应优先按该字段判定。

判定规则：

- `mechanismMmodel = 1`：模型机构，对应当前方案中的“配置环境”
- 其他值或空值：非模型机构，对应当前方案中的“非配置环境”

判定说明：

- 所有页面与接口统一按登录态中的 `req.user.mechanismMmodel` 判定
- `mechanismMmodel = 1` 才允许维护业务标准库
- 不再保留额外环境变量兜底，避免与多数据源环境判断规则混用

### 模型机构允许的操作

- 新增标准库
- 编辑标准库
- 删除标准库
- 导出标准库
- 执行标准库全量导入

### 非模型机构允许的操作

- 查询标准库
- 导出标准库
- 执行标准库全量导入
- 查询业务标准规则
- 使用业务标准规则

### 非模型机构禁止的操作

- 新增标准库
- 编辑标准库
- 删除标准库

说明：

- 如果后续希望连“标准库导出”也只允许模型机构执行，可再进一步收紧
- 当前阶段优先控制“新增 / 编辑 / 删除”三个高风险入口

---

## 6. 程序改造范围

在该方案下，程序改造可以保持最小化。

### 必改项

1. 后端增加基于 `mechanismMmodel` 的机构环境判断逻辑
2. 在标准库接口中对以下写操作做环境限制：
   - `/ywbzk/save`
   - `/ywbzk/delete`
3. 前端页面根据开关隐藏以下入口：
   - 新增
   - 编辑
   - 删除

### 暂不改动项

1. 标准库导入/导出核心逻辑暂不重构
2. 规则表 `gjj_ywbz` 仍继续使用 `mbid`
3. 不引入新的稳定业务键字段
4. 不改当前全量导入 SQL 文件结构

### 已完成的结构调整

初始化脚本中已移除 `gjj_ywbz.mbid -> gjj_ywbzk.id` 的数据库外键定义，涉及：

- `server/data/init_business_standards.sql`
- `server/data/init_business_standards_dm.sql`
- `server/data/init_business_standards_oracle.sql`
- `server/init_business_standards.sql`

注意：

- 这只影响后续初始化
- 已有数据库如果已经存在该外键，还需要单独执行迁移脚本或手工删约束

### 现有数据库表调整 SQL

为了让已经运行中的数据库与当前方案保持一致，需要对现有库执行一次结构调整，移除 `gjj_ywbz.mbid -> gjj_ywbzk.id` 的数据库外键约束。

执行前建议：

1. 先备份数据库
2. 在维护窗口执行
3. 执行后立即跑一次一致性校验脚本

#### SQLite（重建 `gjj_ywbz` 表）

SQLite 不支持直接删除匿名外键约束，需要重建表：

```sql
PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

ALTER TABLE gjj_ywbz RENAME TO gjj_ywbz_old;

CREATE TABLE gjj_ywbz (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mbid INTEGER,
    ywsf VARCHAR(50) NOT NULL,
    ywnrfl VARCHAR(50),
    gzmc VARCHAR(200) NOT NULL,
    gzljsm TEXT,
    yxj INTEGER DEFAULT 0,
    sfqy BOOLEAN DEFAULT 1,
    cjsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    gxsj TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO gjj_ywbz (
    id, mbid, ywsf, ywnrfl, gzmc, gzljsm, yxj, sfqy, cjsj, gxsj
)
SELECT
    id, mbid, ywsf, ywnrfl, gzmc, gzljsm, yxj, sfqy, cjsj, gxsj
FROM gjj_ywbz_old;

DROP TABLE gjj_ywbz_old;

CREATE INDEX IF NOT EXISTS idx_gjj_ywbz_mb ON gjj_ywbz (mbid);
CREATE INDEX IF NOT EXISTS idx_gjj_ywbz_yxj ON gjj_ywbz (yxj);

COMMIT;

PRAGMA foreign_keys = ON;
```

#### 达梦（删除外键约束）

达梦库可直接删除命名约束：

```sql
ALTER TABLE gjj_ywbz DROP CONSTRAINT fk_ywbz_mbid;
```

#### Oracle（删除外键约束）

Oracle 库可直接删除命名约束：

```sql
ALTER TABLE gjj_ywbz DROP CONSTRAINT fk_ywbz_mbid;
```

#### 执行后校验 SQL

建议结构调整后先做一次基础校验：

```sql
SELECT COUNT(*) AS invalid_rule_mbid
FROM gjj_ywbz t
WHERE t.mbid IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM gjj_ywbzk z WHERE z.id = t.mbid
  );

SELECT COUNT(*) AS invalid_std_attr_mbid
FROM gjj_ywbzksx t
WHERE t.mbid IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM gjj_ywbzk z WHERE z.id = t.mbid
  );

SELECT COUNT(*) AS invalid_rule_attr_ywid
FROM gjj_ywbzsx t
WHERE t.ywid IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM gjj_ywbz z WHERE z.id = t.ywid
  );
```

如以上结果存在非 0 值，说明现有数据已经存在悬空引用，需要先修复数据，再继续后续导入或发布操作。

---

## 7. 数据一致性要求

由于数据库不再校验 `gjj_ywbz.mbid`，本方案对数据管理纪律要求更高，且机构环境判定应以 `mechanismMmodel` 为准。

必须遵守：

1. 非模型机构不能手工新增标准库数据
2. 非模型机构不能手工删除标准库数据
3. 非模型机构不能局部修改标准库模板 ID
4. 标准库全量导入必须保留原始 `id`
5. 模型机构导出的标准库数据必须与规则表使用的模板 ID 保持一致
6. 业务标准全量导入、部分导入、批量同步时不得随意改写模板 ID

否则可能出现：

- `gjj_ywbz.mbid` 指向不存在的模板
- 同一规则挂到错误模板
- 导入后业务规则逻辑错配

---

## 8. 校验脚本设计

由于数据库不再校验 `gjj_ywbz.mbid`，需要补充一个管理员可调用的数据校验脚本，用于在导入后或上线前检查业务标准相关数据是否一致。

建议新增脚本：

- `server/scripts/check_ywbz_consistency.js`

建议支持的调用方式：

- 使用当前系统动态数据源：`node server/scripts/check_ywbz_consistency.js --datasource=default`
- 指定机构执行：`node server/scripts/check_ywbz_consistency.js --datasource=default --jgbh=xxx --zjgbh=yyy`
- 手动传入数据库连接：`node server/scripts/check_ywbz_consistency.js --db-type=oracle --host=127.0.0.1 --port=1521 --service=ORCL --user=xxx --password=xxx`
- 手动传入达梦连接：`node server/scripts/check_ywbz_consistency.js --db-type=dm --host=127.0.0.1 --port=5236 --schema=xxx --user=xxx --password=xxx`
- 后续如有需要，可再封装管理员接口触发该脚本

### 数据源接入要求

由于当前系统支持动态数据源，校验脚本不能只依赖固定数据库配置，建议同时支持两种模式：

1. 动态数据源模式
   - 通过 `--datasource` 指定系统内已配置的数据源
   - 复用现有数据源加载逻辑和适配器初始化逻辑
   - 适合在正式环境、测试环境中直接复用系统配置执行检查

2. 手工连接模式
   - 通过命令行参数手动传入数据库类型、地址、端口、库标识、账号、密码
   - 不依赖系统当前已登记的数据源配置
   - 适合临时排查、脱离主程序配置的独立校验场景

建议优先级：

- 传入 `--datasource` 时，优先按动态数据源方式连接
- 未传 `--datasource` 时，如果提供了完整连接参数，则按手工连接方式执行
- 两者都未提供时，脚本直接报错并退出

建议支持的核心参数：

- `--datasource`
- `--db-type`：`oracle` / `dm`
- `--host`
- `--port`
- `--service` 或 `--schema`
- `--user`
- `--password`
- `--jgbh`
- `--zjgbh`

### 校验范围

脚本至少校验以下内容：

1. `gjj_ywbz.mbid` 是否为空但规则仍处于有效状态
2. `gjj_ywbz.mbid` 是否在 `gjj_ywbzk.id` 中存在
3. `gjj_ywbzksx.mbid` 是否在 `gjj_ywbzk.id` 中存在
4. `gjj_ywbzsx.ywid` 是否在 `gjj_ywbz.id` 中存在
5. 标准库、规则表中是否存在明显重复或异常引用

### 建议输出内容

脚本执行后输出：

- 校验时间
- 校验范围（全库 / 指定机构）
- 异常总数
- 每类异常的条数
- 异常明细样例（如前 20 条）
- 最终结论：通过 / 不通过

### 建议返回码

- 无异常：进程退出码 `0`
- 存在异常：进程退出码 `1`
- 执行失败：进程退出码 `2`

### 推荐执行时机

- 标准库全量导入完成后立即执行
- 业务标准规则批量导入后执行
- 正式发版前执行一次
- 管理员怀疑数据异常时手工执行

### 作用定位

该脚本不是替代数据库约束，而是在当前“去掉外键、保留全量导入”的方案下，作为一致性巡检工具使用。

建议将其纳入运维和发布流程，作为必选检查项。

---

## 9. 风险与取舍

### 优点

- 程序修改较小
- 不需要引入新字段和双轨兼容逻辑
- 能继续沿用现有标准库全量导入方式
- 对当前项目落地速度更友好

### 风险

- 失去数据库层的引用完整性保护
- 数据一致性更多依赖流程纪律
- 如果有人绕过应用直接改库，容易产生悬空 `mbid`
- 如果未来出现多源维护场景，该方案将不再适用

### 结论

这是一个“以流程治理换程序复杂度”的方案。

只要“单源维护、其他环境只全量导入”的前提长期成立，该方案是可接受的；
如果未来业务转向多环境并行维护，则需要重新评估是否引入稳定业务键或恢复更强的约束机制。

---

## 10. 后续实施建议

建议按以下顺序落地：

1. 保持当前移除外键的初始化脚本
2. 后端限制非模型机构的标准库新增、编辑、删除接口
3. 前端隐藏非模型机构的标准库写操作按钮
4. 为现有数据库补充“删除外键约束”的迁移脚本
5. 增加 `server/scripts/check_ywbz_consistency.js` 校验脚本
6. 将校验脚本纳入导入后、发版前的检查流程

---

## 11. 一句话方案

- 标准库只在模型机构维护
- 非模型机构只接收全量导入
- 继续使用 `id/mbid` 体系
- 去掉 `gjj_ywbz -> gjj_ywbzk` 的数据库外键
- 用机构环境判定和管理流程保证一致性




