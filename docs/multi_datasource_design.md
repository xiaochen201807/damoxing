# 达梦数据库与 Oracle 多数据源动态路由支持方案

根据您的进一步反馈，我们需要支持**多个不同配置的数据源**，也就是同一个应用能够挂载多个配置（可能是多个不同配置的 Oracle，也可能是多个不同配置的达梦），并且根据客户端请求的 `jgbh`（机构编号）自动路由到正确对应的数据库实例。

## 面临的挑战
目前项目中 `db_oracle.js` 采用的是单例模式（内部维护了一个全局唯一的 `pool`）。为了支持多数据源，我们需要将它重构为**工厂模式**（可以创建多个池子实例），且为达梦 (`dmdb`) 增加与之接口一致的工程类。

## 方案设计

### 1. 配置文件设计
在 `server` 目录下新增一个独立的数据源配置文件 `config/datasources.json`，用来配置所有的数据库连接。这样相比纯写在 `.env` 中具有更好的扩展性。
```json
{
  "default_datasource": "oracle_main",
  "strict_routing": false, 
  "datasources": [
    {
      "id": "oracle_main",
      "type": "oracle",
      "jgbh_list": ["1001", "1002"],
      "config": {
        "user": "sysdba",
        "password": "pwd",
        "connectString": "192.168.1.100:1521/ORCL",
        "poolMin": 2,
        "poolMax": 10
      }
    },
    {
      "id": "dm_branch_1",
      "type": "dm",
      "jgbh_list": ["2001"],
      "config": {
        "user": "dm_user",
        "password": "pwd",
        "connectString": "192.168.1.101:5236",
        "poolMin": 2,
        "poolMax": 5
      }
    }
  ]
}
```
*注：`strict_routing` 若为 true，匹配不到 JGBH 即报错；若为 false，则走 `default_datasource`。*

### 2. 重构数据库适配器为工厂模式
- [MODIFY] `server/db_oracle.js`：将原有的 `initialize` 修改为导出一个工厂类/函数：
  ```javascript
  class OracleAdapter {
      constructor(config) { /* ... */ }
      async initialize() { /* 建立自己的 pool */ }
      async all(sql, params) { /* 使用自己的 pool */ }
      // ... 其他方法
  }
  module.exports = OracleAdapter;
  ```
- [NEW] `server/db_dm.js`：参考 `OracleAdapter` 编写达梦数据库适配器。
  ```javascript
  const dmdb = require('dmdb');
  class DmAdapter {
      constructor(config) { /* ... */ }
      async initialize() { /* 建立达梦池 */ }
      // ... 实现与 Oracle 相同的 all, get, run, transaction 等接口
  }
  module.exports = DmAdapter;
  ```

### 3. 数据层核心路由 `server/db.js` (核心改动)
重写其内部逻辑：
- **初始化阶段**：读取 JSON，并行实例化所有 Adapter 并执行并行的 `initialize()`。使用 `try-catch` 包裹单个实例的初始化，**即使部分库宕机也不阻断其它库初始化**。
- **构建 O(1) 路由表**：遍历 `jgbh_list`，建立 `Map<"1001", oracle_main_adapter>` 等快速映射。
- **暴露路由接口**：
  ```javascript
  db.getByJgbh = function(jgbh) {
      if (!jgbh) return defaultAdapter; // 兜底策略
      const adapter = routingMap.get(String(jgbh));
      if (adapter) return adapter;
      // 严格模式阻断，非严格模式回退默认库
      if (strictRouting) throw new Error(`未找到该机构[${jgbh}]对应的数据源配置`);
      return defaultAdapter;
  }
  ```
- **暴露统一关闭接口**：`db.closeAll()` 循环关闭所有 Adapter 的 Pool。在 `server/index.js` 等入口点监听进程退出信号，调用该方法平滑关闭连接。

### 4. 业务无侵入改造 (`ywbz.js` 及其他)
- 将文件全局检索 `db.oracle.` 批量替换为 `db.getByJgbh(jgbh).`。因为所有的 Adapter (Oracle/Dm) 返回的方法签名完全一致，所以：
- 分页、SQL 拼接、参数绑定等**全部有效**。
- `ywbz.js` 中那些复杂的事务 (`db.oracle.transaction`) 也可以直接由按需加载的达梦或 Oracle 事务代理接管。
