# ywbz.js 数据库连接问题修复方案

## 问题描述

在合并数据库连接方法后，`ywbz.js` 中部分代码无法保存到数据库。

### 根本原因

`ywbz.js` 文件中混用了 SQLite 和 Oracle 的数据库接口：

- **正确使用**: ywbzk 和 ywbz 的部分接口使用 `db.oracle.*`
- **错误使用**: 部分接口使用了 `db.*` (默认连接 SQLite)

由于以下表都存储在 **Oracle** 数据库中：
- `gjj_ywbz` (业务标准规则表)
- `gjj_ywbzsx` (业务标准属性表)
- `gjj_ywbzk` (业务标准库表)
- `gjj_ywbzksx` (业务标准库属性表)

使用 `db.*` 接口会导致：
1. **查询失败** - 在 SQLite 中找不到 Oracle 的表
2. **写入失败** - 数据无法保存到 Oracle

## 数据库架构说明

从 `db.js` 的设计：

```javascript
// SQLite (默认系统库)
db.all(sql, params)    // → SQLite
db.get(sql, params)    // → SQLite  
db.run(sql, params)    // → SQLite
db.transaction(work)   // → SQLite

// Oracle (业务数据库)
db.oracle.all(sql, params)    // → Oracle
db.oracle.get(sql, params)    // → Oracle
db.oracle.run(sql, params)    // → Oracle
db.oracle.transaction(work)   // → Oracle
```

## 需要修复的代码位置

### 文件: `/server/routes/http/ywbz.js`

#### 1. 配置表单协议 (config_form) - 第 142, 155 行

**当前代码：**
```javascript
// 第 142 行
const schemaRows = await db.all(sqlSchema, [mbid]);  // ❌ 错误

// 第 155 行
const valueRows = await db.all(sqlValues, [id]);     // ❌ 错误
```

**修复后：**
```javascript
// 第 142 行
const schemaRows = await db.oracle.all(sqlSchema, [mbid]);  // ✅ 正确

// 第 155 行
const valueRows = await db.oracle.all(sqlValues, [id]);     // ✅ 正确
```

---

#### 2. 获取详情 (GET /:id) - 第 308, 313 行

**当前代码：**
```javascript
// 第 308 行
const row = await db.get(sql, [id]);           // ❌ 错误

// 第 313 行
const sxRows = await db.all(sxSql, [id]);      // ❌ 错误
```

**修复后：**
```javascript
// 第 308 行
const row = await db.oracle.get(sql, [id]);           // ✅ 正确

// 第 313 行
const sxRows = await db.oracle.all(sxSql, [id]);      // ✅ 正确
```

---

#### 3. 保存 (POST /save) - 第 345 行

**当前代码：**
```javascript
// 第 345 行
const { id: savedId } = await db.transaction(async (tx) => {  // ❌ 错误
    // ... 事务内容
});
```

**修复后：**
```javascript
// 第 345 行
const { id: savedId } = await db.oracle.transaction(async (tx) => {  // ✅ 正确
    // ... 事务内容
});
```

---

#### 4. 更新 (PUT /:id) - 第 415 行

**当前代码：**
```javascript
// 第 415 行
await db.transaction(async (tx) => {  // ❌ 错误
    // ... 事务内容
});
```

**修复后：**
```javascript
// 第 415 行
await db.oracle.transaction(async (tx) => {  // ✅ 正确
    // ... 事务内容
});
```

---

#### 5. 批量同步 (POST /batch) - 第 486, 492, 504 行

**当前代码：**
```javascript
// 第 486 行
return db.all(`SELECT * FROM gjj_ywbzk WHERE id IN (${placeholders})`, ids);  // ❌ 错误

// 第 492 行
const deleteResult = await db.run(deleteSql, [jgbh, zjgbh]);  // ❌ 错误

// 第 504 行
await db.run(insertSql, [tpl.id, tpl.ywblbz, tpl.gjsjsf, tpl.ywblbzsm, jgbh, zjgbh]);  // ❌ 错误
```

**修复后：**
```javascript
// 第 486 行
return db.oracle.all(`SELECT * FROM gjj_ywbzk WHERE id IN (${placeholders})`, ids);  // ✅ 正确

// 第 492 行
const deleteResult = await db.oracle.run(deleteSql, [jgbh, zjgbh]);  // ✅ 正确

// 第 504 行
await db.oracle.run(insertSql, [tpl.id, tpl.ywblbz, tpl.gjsjsf, tpl.ywblbzsm, jgbh, zjgbh]);  // ✅ 正确
```

---

#### 6. 删除 (POST /delete) - 第 525 行

**当前代码：**
```javascript
// 第 525 行
await db.run("DELETE FROM gjj_ywbz WHERE id = ?", [id]);  // ❌ 错误
```

**修复后：**
```javascript
// 第 525 行
await db.oracle.run("DELETE FROM gjj_ywbz WHERE id = ?", [id]);  // ✅ 正确
```

---

#### 7. 删除 (DELETE /:id) - 第 538 行

**当前代码：**
```javascript
// 第 538 行
await db.run("DELETE FROM gjj_ywbz WHERE id = ?", [id]);  // ❌ 错误
```

**修复后：**
```javascript
// 第 538 行
await db.oracle.run("DELETE FROM gjj_ywbz WHERE id = ?", [id]);  // ✅ 正确
```

---

#### 8. 获取分类选项 (GET /options/categories) - 第 551 行

**当前代码：**
```javascript
// 第 551 行
const rows = await db.all(sql, []);  // ❌ 错误
```

**修复后：**
```javascript
// 第 551 行
const rows = await db.oracle.all(sql, []);  // ✅ 正确
```

---

#### 9. 导出 (GET /export) - 第 567, 568 行

**当前代码：**
```javascript
// 第 567 行
const rules = await db.all("SELECT * FROM gjj_ywbz");      // ❌ 错误

// 第 568 行
const attributes = await db.all("SELECT * FROM gjj_ywbzsx");  // ❌ 错误
```

**修复后：**
```javascript
// 第 567 行
const rules = await db.oracle.all("SELECT * FROM gjj_ywbz");      // ✅ 正确

// 第 568 行
const attributes = await db.oracle.all("SELECT * FROM gjj_ywbzsx");  // ✅ 正确
```

---

#### 10. 导入 (POST /import) - 第 649 行

**注意：这个需要特殊处理！**

**当前代码：**
```javascript
// 第 649 行
await new Promise((resolve, reject) => {
    db.exec(sqlContent, (err) => {  // ❌ 这里不能直接改
        if (err) reject(err);
        else resolve();
    });
});
```

**问题：**
`db.exec()` 执行批量 SQL，但 Oracle 不支持 `exec()` 这样的批量执行方式。

**修复方案：**
```javascript
// 第 649 行 - 需要重构
await new Promise((resolve, reject) => {
    // Oracle 不支持 exec，需要拆分 SQL 并逐条执行
    const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    (async () => {
        try {
            await db.oracle.transaction(async (tx) => {
                for (const stmt of statements) {
                    if (stmt.toUpperCase().startsWith('SELECT') || 
                        stmt.toUpperCase().startsWith('SHOW')) {
                        continue; // 跳过查询语句
                    }
                    await tx.run(stmt, []);
                }
            });
            resolve();
        } catch (err) {
            reject(err);
        }
    })();
});
```

---

#### 11. 选择清册 (POST /selection_list) - 第 719, 725, 732 行

**当前代码：**
```javascript
// 第 719 行
db.get(countSql, standardsParams, (err, countRow) => {  // ❌ 错误（回调方式）

// 第 725 行
db.all(standardsSql, standardsQueryParams, (err, standards) => {  // ❌ 错误（回调方式）

// 第 732 行
db.all(selectedSql, selectedParams, (err, selectedRows) => {  // ❌ 错误（回调方式）
```

**修复方案：改为 Promise 方式**
```javascript
router.post('/selection_list', async (req, res) => {  // 添加 async
    const { page = 1, perPage = 10, ywblbz, gjsjsf, ywnrfl, jgbh, zjgbh } = req.body;
    // ... 准备 SQL 的代码不变 ...

    try {
        // 第 719 行
        const countRow = await db.oracle.get(countSql, standardsParams);

        // 第 725 行
        const standards = await db.oracle.all(standardsSql, standardsQueryParams);

        // 第 732 行
        const selectedRows = await db.oracle.all(selectedSql, selectedParams);

        // 内存合并逻辑
        const selectedIds = new Set(selectedRows.map(row => Number(row.mbid)));
        logger.info(`[Selection Fix] Selected IDs: ${Array.from(selectedIds).join(',')}`);

        const items = standards.map(item => ({
            ...item,
            checked: selectedIds.has(Number(item.id))
        }));

        res.json({
            status: 0,
            msg: "ok",
            data: {
                items: items,
                selectedIds: Array.from(selectedIds),
                total: countRow ? countRow.total : 0
            }
        });
    } catch (err) {
        logger.error(`Failed to query selection_list: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});
```

---

## 修复总结

### 修改统计

| 类型 | 数量 |
|------|------|
| `db.all` → `db.oracle.all` | 10 处 |
| `db.get` → `db.oracle.get` | 3 处 |
| `db.run` → `db.oracle.run` | 5 处 |
| `db.transaction` → `db.oracle.transaction` | 2 处 |
| `db.exec` → 重构为事务 | 1 处 |
| 回调改 Promise | 3 处 |

**总计：24 处修改**

---

## 测试验证

修复后需要测试以下功能：

1. ✅ **配置规则参数** - 能够正常显示表单和保存
2. ✅ **查询规则详情** - 能够正确获取数据
3. ✅ **新增/修改规则** - 能够正常保存到 Oracle
4. ✅ **批量同步** - 从标准库同步到规则表
5. ✅ **删除规则** - 能够正常删除
6. ✅ **导出规则** - 能够导出 SQL 文件
7. ✅ **导入规则** - 能够导入 SQL 文件 (需要重构)
8. ✅ **选择清册** - checked 状态正确反显

---

## 注意事项

### 1. Oracle vs SQLite 的差异

修复时注意：
- **参数占位符**:
  - SQLite: `?`
  - Oracle: `:1, :2, :3...` (已在 `prepareOracleQuery` 中自动转换)
  
- **自增 ID**:
  - SQLite: `lastID` 自动返回
  - Oracle: 需要手动查询 `SELECT MAX(id) FROM table`

- **事务**:
  - SQLite: `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`
  - Oracle: `autoCommit: false` + `connection.commit()`

### 2. 性能考虑

- Oracle 的网络延迟比 SQLite 高
- 批量操作应该使用事务包裹，减少网络往返

### 3. 日志监控

修复后查看日志确认：
```bash
tail -f server/data/logs/combined-*.log | grep "\[Oracle\]"
```

应该看到类似：
```
[Oracle] [SQL-xyz] ==>  Preparing: SELECT * FROM gjj_ywbz WHERE id = :1
[Oracle] [SQL-xyz] ==> Parameters: [123]
[Oracle] [SQL-xyz] <==      Total: 1 (45ms)
```

---

## 修复脚本

为了方便批量修复，可以运行以下命令：

```bash
cd /Users/xiaochen/Downloads/damoxing/server/routes/http

# 备份原文件
cp ywbz.js ywbz.js.backup

# 使用 sed 批量替换 (macOS 需要加 '' 参数)
sed -i '' 's/await db\.all(/await db.oracle.all(/g' ywbz.js
sed -i '' 's/await db\.get(/await db.oracle.get(/g' ywbz.js
sed -i '' 's/await db\.run(/await db.oracle.run(/g' ywbz.js
sed -i '' 's/await db\.transaction(/await db.oracle.transaction(/g' ywbz.js
sed -i '' 's/return db\.all(/return db.oracle.all(/g' ywbz.js

# 回调方式的需要手动修改
```

**注意**: 自动替换可能会误改其他代码，建议手动逐个修改并测试。

---

## 相关文件

- `/server/db.js` - 数据库连接主文件
- `/server/db_oracle.js` - Oracle 连接实现
- `/server/db_sqlite.js` - SQLite 连接实现
- `/server/routes/http/ywbz.js` - 需要修复的文件
- `/server/routes/http/ywbzk.js` - 参考文件（已正确使用 Oracle）

---

## 更新记录

- **2025-02-11**: 识别并记录所有需要修复的数据库连接问题
