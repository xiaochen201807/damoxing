# 多数据源动态路由与可插拔数据库适配方案

## 1. 背景与目标

当前系统的业务库访问以 `Oracle` 单例连接池为核心，业务代码中大量直接调用 `db.oracle.*`。现需要支持：

- 同一应用同时挂载多个业务数据源
- 使用 `jgbh` 作为**唯一**路由键，将请求稳定路由到指定业务库
- 当前落地支持 `Oracle` 与 `达梦`，后续可继续扩展 `PostgreSQL` 及其他国产数据库
- 尽量降低后续新增数据库类型的改造成本

本次方案的核心目标不是“给 Oracle 再加一个达梦分支”，而是建立一套**可插拔的业务数据库访问框架**。

---

## 2. 设计原则

### 2.1 系统库与业务库分离

- `SQLite` 继续作为系统库，承载系统配置、模板配置、用户信息等本地数据
- 多数据源能力仅作用于**业务库访问层**
- 避免将系统库逻辑与业务库动态路由混在一起，降低复杂度

### 2.2 路由键唯一且可信

- `jgbh` 为唯一数据源映射键
- 运行时优先使用 JWT 中的机构信息
- 若业务仍传入请求头 `jgbh`，应校验其与 JWT 中值一致，防止越权路由

### 2.3 驱动适配与 SQL 方言分层

必须区分两类问题：

1. **连接/事务/执行能力差异**：由 Adapter 负责
2. **分页/绑定/函数兼容差异**：由 Dialect 负责

后续新增 `PostgreSQL` 时，优先复用统一框架，只新增对应 Adapter 与 Dialect。

### 2.4 生产优先保证可观测与可回滚

- 每次请求都应能明确知道命中了哪个 datasource
- 初始化失败不能影响其他已可用数据源
- 错误日志必须包含 `jgbh`、`datasourceId`、`dbType`
- 保留单库回退能力，便于灰度切换

---

## 3. 总体架构

建议引入以下模块：

### 3.1 `DatasourceRegistry`

职责：

- 读取多数据源配置
- 创建并持有所有 Adapter 实例
- 建立 `Map<jgbh, datasourceId>` 路由表
- 提供 `getByJgbh(jgbh)` 能力
- 提供统一初始化、健康检查、关闭接口

### 3.2 `BaseAdapter`

定义统一能力接口：

```js
class BaseAdapter {
  async initialize() {}
  async close() {}
  async all(sql, params = []) {}
  async get(sql, params = []) {}
  async run(sql, params = []) {}
  async exec(sql) {}
  async transaction(work) {}
  async healthCheck() {}
}
```

### 3.3 `Dialect`

每种数据库方言提供统一能力：

- 参数绑定转换
- 分页 SQL 生成
- 常用函数映射
- 标识符处理策略

例如：

- `OracleDialect`
- `DmDialect`
- `PostgresDialect`

### 3.4 统一业务库入口

在 `server/db.js` 中保留系统库能力，并新增业务库路由入口：

```js
const db = {
  system: { ...sqliteMethods },
  async initBizDatasources() {},
  async closeBizDatasources() {},
  getBizDb(jgbh) {}
};
```

业务代码不再长期依赖 `db.oracle.*`，而统一改为：

```js
const bizDb = db.getBizDb(jgbh);
await bizDb.all(sql, params);
```

---

## 4. 配置方案

建议新增：`server/config/datasources.json`

```json
{
  "default_datasource": "oracle_main",
  "strict_routing": true,
  "datasources": [
    {
      "id": "oracle_main",
      "type": "oracle",
      "enabled": true,
      "jgbh_list": ["1001", "1002"],
      "config_ref": "DS_ORACLE_MAIN"
    },
    {
      "id": "dm_branch_1",
      "type": "dm",
      "enabled": true,
      "jgbh_list": ["2001"],
      "config_ref": "DS_DM_BRANCH_1"
    }
  ]
}
```

对应连接信息建议放环境变量，而不是直接写入 JSON：

```env
DS_ORACLE_MAIN_USER=...
DS_ORACLE_MAIN_PASSWORD=...
DS_ORACLE_MAIN_CONNECT_STRING=...
DS_DM_BRANCH_1_USER=...
DS_DM_BRANCH_1_PASSWORD=...
DS_DM_BRANCH_1_CONNECT_STRING=...
```

这样可以同时兼顾：

- 路由配置可读性
- 凭据安全性
- 后续多环境部署灵活性

### 4.1 配置校验规则

启动时必须校验：

- `datasource.id` 唯一
- `jgbh` 不能重复映射到多个 datasource
- `default_datasource` 必须存在
- `type` 必须在已注册适配器列表中
- 缺少环境变量时标记该 datasource 初始化失败

---

## 5. 数据库适配器设计

### 5.1 OracleAdapter

基于现有 `server/db_oracle.js` 重构为实例化模式：

- 每个实例持有自己的连接池
- 每个实例绑定自己的 `OracleDialect`
- 保留现有 `all/get/run/transaction` 行为
- 将现有单例 `pool` 改为实例字段

### 5.2 DmAdapter

新增 `server/db_dm.js`：

- 使用 `dmdb` 驱动
- 统一返回小写字段名
- 实现与 OracleAdapter 一致的方法签名
- 事务接口对齐 `transaction(work)` 风格

### 5.3 未来扩展：PostgresAdapter

虽然当前先不落地 PostgreSQL，但架构上应直接预留注册入口：

- `registerAdapter('postgres', PostgresAdapter)`
- `registerDialect('postgres', PostgresDialect)`

这样后续新增数据库时，无需再调整 `Registry` 主体逻辑。

---

## 6. 方言层设计

文档原方案中“分页、SQL 拼接、参数绑定全部有效”的结论过于乐观。实际必须引入方言层统一处理。

### 6.1 统一方言接口

```js
class BaseDialect {
  bindParams(sql, params) {}
  paginate(sql, params, limit, offset) {}
  nullFn(expr, fallback) {}
}
```

### 6.2 重点兼容点

- **参数绑定**
  - Oracle：`? -> :1/:2/...`
  - 达梦：需按驱动实际绑定规则适配
  - PostgreSQL：通常为 `$1/$2/...`
- **分页**
  - 不同数据库分页语法不完全一致
- **空值函数**
  - Oracle 常用 `NVL`
  - 其他库可能支持 `COALESCE`
- **日期/字符串函数**
  - 后续复杂 SQL 中是高风险点

建议现有 `SqlHelper` 后续逐步升级为**方言感知的 SQL Helper**，而不是只服务 Oracle。

---

## 7. 业务层改造策略

### 7.1 改造原则

不是全量替换所有数据库调用，而是按模块分批迁移。

### 7.2 推荐顺序

1. `cxgzkz.js`
2. `ywbzk.js`
3. `ywbz.js`
4. 其他业务路由

原因：

- `cxgzkz` 结构相对单一，适合作为第一批验证多库路由
- `ywbz` 事务和联表逻辑更复杂，适合在框架稳定后迁移

### 7.3 迁移方式

现有代码：

```js
await db.oracle.all(sql, params)
```

调整为：

```js
const bizDb = db.getBizDb(jgbh)
await bizDb.all(sql, params)
```

事务同理：

```js
await bizDb.transaction(async (tx) => {
  ...
})
```

### 7.4 请求级数据源获取

建议统一封装：

```js
function getBizDbFromReq(req) {
  const jgbh = req.user?.jgbh || req.headers['jgbh'] || req.headers['zzbs'];
  return db.getBizDb(jgbh);
}
```

并补充一致性校验：

- 若 JWT 有 `jgbh`，且 header 中也传了 `jgbh`
- 两者不一致时直接拒绝请求

---

## 8. 初始化、降级与关闭策略

### 8.1 初始化策略

启动时：

- 读取配置
- 对每个 datasource 创建 Adapter 并执行 `initialize()`
- 单个 datasource 初始化失败时只记录错误，不阻断其他 datasource 启动
- 最终输出初始化汇总日志

### 8.2 严格路由策略

建议生产环境默认：

```json
"strict_routing": true
```

行为如下：

- 找到 `jgbh` 映射：正常访问
- 找不到映射：直接报错
- 映射存在但 datasource 未初始化成功：直接报错

不建议生产环境静默回退默认库，否则存在误写错库风险。

### 8.3 服务关闭策略

在进程退出时统一执行：

```js
await db.closeBizDatasources()
```

平滑关闭所有池，避免连接泄漏。

---

## 9. 日志与可观测性

每次业务库访问建议统一打印以下维度：

- `jgbh`
- `datasourceId`
- `dbType`
- `sqlId`
- `duration`
- `rowsAffected / resultCount`

初始化阶段建议输出：

- 成功 datasource 列表
- 失败 datasource 列表
- 重复 `jgbh` 映射检查结果
- 默认 datasource 校验结果

这样多库排障时能快速定位问题属于：

- 路由错误
- 连接失败
- SQL 方言问题
- 单库宕机

---

## 10. 主要风险与应对

### 10.1 SQL 方言兼容风险

风险最高，尤其是：

- 分页
- 绑定参数
- `NVL/COALESCE`
- 日期函数
- 字符串函数

应对：

- 先挑 `cxgzkz`、`ywbzk` 中的真实 SQL 做 Oracle/达梦双库验证
- 通过后再推进复杂模块

### 10.2 事务语义差异风险

不同驱动的自动提交、回滚、异常行为可能不同。

应对：

- 为 Adapter 编写统一事务测试
- 明确 `transaction(work)` 的提交/回滚契约

### 10.3 连接池资源风险

数据源数量增多后，启动连接数和内存占用会升高。

应对：

- 为每个 datasource 设置合理 `poolMin/poolMax`
- 必要时支持延迟初始化或按需预热

### 10.4 错库风险

如果路由策略不严格，可能发生请求写入错误业务库。

应对：

- `strict_routing=true`
- JWT 与 header 的 `jgbh` 一致性校验
- 日志中强制记录命中 datasource

### 10.5 主键回填风险

当前部分业务仍存在 `INSERT` 后 `SELECT MAX(id)` 的模式，在并发环境不稳。

应对：

- 后续逐步替换为数据库原生返回主键能力或序列方案
- 至少在重构过程中识别并重点验证相关逻辑

---

## 11. 分阶段实施计划

### 阶段一：基础框架

- 新增 `DatasourceRegistry`
- 抽象 `BaseAdapter` / `BaseDialect`
- 重构 `OracleAdapter`
- 新增 `DmAdapter`
- 改造 `server/db.js` 为“系统库 + 业务库路由”双入口

### 阶段二：小范围试点

- 优先改造 `cxgzkz`
- 使用真实 `Oracle + 达梦` 环境联调
- 验证查询、保存、删除、导入、导出、事务行为

### 阶段三：扩展迁移

- 改造 `ywbzk`
- 改造 `ywbz`
- 迁移剩余直接依赖 `db.oracle.*` 的模块

### 阶段四：平台化收口

- 清理旧的 `db.oracle.*` 直接访问入口
- 补充健康检查、监控、故障告警
- 为 PostgreSQL 等后续数据库预留接入模板

---

## 12. 最终建议

建议采用本方案，并按以下原则推进：

- 现在就按**长期可扩展架构**设计，不做 Oracle/达梦特例分支
- 明确 `jgbh` 为唯一数据源路由键
- 将“连接适配”和“SQL 方言兼容”拆开设计
- 生产环境默认启用严格路由
- 优先在 `cxgzkz` 做第一批试点验证

该方案能满足当前 `Oracle + 达梦` 的需求，也能为后续 `PostgreSQL` 与其他国产数据库接入预留稳定扩展点。
