-- ============================================
-- 达梦：四张核心表 IDENTITY -> AUTO_INCREMENT 迁移脚本
-- ============================================
--
-- 适用场景：
-- 1. 旧达梦库已按 IDENTITY(1,1) 建表
-- 2. 导入脚本需要显式写入 id，想避免反复执行 SET IDENTITY_INSERT ... ON
--
-- 执行前建议：
-- 1. 先完整备份目标库，或至少备份以下四张表
--    gjj_ywbzk / gjj_ywbzksx / gjj_ywbz / gjj_ywbzsx
-- 2. 确认 AUTO_INCREMENT_INCREMENT 参数仍为默认值 1
-- 3. 本脚本为一次性迁移脚本，已切换为 AUTO_INCREMENT 的库不要重复执行
--
-- 说明：
-- - 迁移语法参考达梦官方 FAQ“如何将 identity 自增列改为 auto_increment 自增列”
-- - 已在本地 DM8 实测：
--   ALTER TABLE ... DROP IDENTITY;
--   ALTER TABLE ... ADD id AUTO_INCREMENT;
--   迁移后既可自动生成 id，也可直接显式插入 id

-- 可选：先手工备份（请按需要调整备份表名）
-- CREATE TABLE gjj_ywbzk_bak_20260324 AS SELECT * FROM gjj_ywbzk;
-- CREATE TABLE gjj_ywbzksx_bak_20260324 AS SELECT * FROM gjj_ywbzksx;
-- CREATE TABLE gjj_ywbz_bak_20260324 AS SELECT * FROM gjj_ywbz;
-- CREATE TABLE gjj_ywbzsx_bak_20260324 AS SELECT * FROM gjj_ywbzsx;

-- 1. 业务标准库主表
ALTER TABLE gjj_ywbzk DROP IDENTITY;
ALTER TABLE gjj_ywbzk ADD id AUTO_INCREMENT;

-- 2. 业务标准库属性表
ALTER TABLE gjj_ywbzksx DROP IDENTITY;
ALTER TABLE gjj_ywbzksx ADD id AUTO_INCREMENT;

-- 3. 业务标准主表
ALTER TABLE gjj_ywbz DROP IDENTITY;
ALTER TABLE gjj_ywbz ADD id AUTO_INCREMENT;

-- 4. 业务标准属性表
ALTER TABLE gjj_ywbzsx DROP IDENTITY;
ALTER TABLE gjj_ywbzsx ADD id AUTO_INCREMENT;

-- 可选：迁移后校验建表定义
-- CALL SP_TABLEDEF('当前模式名', 'GJJ_YWBZK');
-- CALL SP_TABLEDEF('当前模式名', 'GJJ_YWBZKSX');
-- CALL SP_TABLEDEF('当前模式名', 'GJJ_YWBZ');
-- CALL SP_TABLEDEF('当前模式名', 'GJJ_YWBZSX');
