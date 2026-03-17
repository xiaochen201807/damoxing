/**
 * 验证 PgAdapter / GaussAdapter / KingbaseAdapter 连接本地 Docker 数据库
 * 
 * 使用方式: node scripts/test_pg_adapters.js
 */

const { PgAdapter, GaussAdapter, KingbaseAdapter } = require('../db_pg');
const logger = require('../utils/logger');

async function testAdapter(AdapterClass, label, config) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试 ${label}`);
    console.log(`${'='.repeat(60)}`);

    const adapter = new AdapterClass(config, `test_${label}`);

    try {
        // 1. 初始化连接
        console.log(`[${label}] 正在初始化连接池...`);
        await adapter.initialize();
        console.log(`[${label}] ✅ 连接池初始化成功`);

        // 2. 简单查询
        console.log(`[${label}] 执行 SELECT 1 AS val...`);
        const row = await adapter.get('SELECT 1 AS val');
        console.log(`[${label}] ✅ 查询成功:`, row);

        // 3. 查询版本
        console.log(`[${label}] 执行 SELECT version()...`);
        const vRow = await adapter.get('SELECT version() AS ver');
        console.log(`[${label}] ✅ 数据库版本: ${(vRow.ver || '').substring(0, 80)}...`);

        // 4. ? 占位符测试
        console.log(`[${label}] 测试 ? 占位符...`);
        const pRow = await adapter.get('SELECT ? AS a, ? AS b', [42, 'hello']);
        console.log(`[${label}] ✅ 占位符测试:`, pRow);

        // 5. :n 占位符测试
        console.log(`[${label}] 测试 :n 占位符...`);
        const nRow = await adapter.get('SELECT :1 AS x, :2 AS y', [100, 'world']);
        console.log(`[${label}] ✅ :n 占位符测试:`, nRow);

        // 6. 建表 + 插入 + 查询 + 删表（事务测试）
        console.log(`[${label}] 测试事务...`);
        const txResult = await adapter.transaction(async (tx) => {
            await tx.exec('CREATE TABLE IF NOT EXISTS _adapter_test (id INT, name VARCHAR(50))');
            await tx.run('INSERT INTO _adapter_test (id, name) VALUES (?, ?)', [1, 'test_row']);
            const rows = await tx.all('SELECT * FROM _adapter_test WHERE id = ?', [1]);
            await tx.exec('DROP TABLE IF EXISTS _adapter_test');
            return rows;
        });
        console.log(`[${label}] ✅ 事务测试成功, 查到 ${txResult.length} 行:`, txResult);

        // 7. isOracle 检查
        console.log(`[${label}] isOracle = ${adapter.isOracle} (应为 false)`);
        console.log(`[${label}] ✅ 全部测试通过`);

    } catch (err) {
        console.error(`[${label}] ❌ 测试失败:`, err.message);
    } finally {
        await adapter.close();
    }
}

async function main() {
    console.log('开始验证 PG 系适配器...\n');

    // PostgreSQL
    await testAdapter(PgAdapter, 'PostgreSQL', {
        host: '127.0.0.1',
        port: 55432,
        database: 'damoxing',
        user: 'damoxing',
        password: 'Damoxing123!',
        poolMin: 1,
        poolMax: 3
    });

    // openGauss
    await testAdapter(GaussAdapter, 'openGauss', {
        host: '127.0.0.1',
        port: 55433,
        database: 'damoxing',
        user: 'damoxing',
        password: 'Damoxing123!',
        poolMin: 1,
        poolMax: 3
    });

    // Kingbase
    await testAdapter(KingbaseAdapter, 'Kingbase', {
        host: '127.0.0.1',
        port: 55434,
        database: 'test',
        user: 'system',
        password: 'Damoxing123!',
        poolMin: 1,
        poolMax: 3
    });

    console.log('\n\n验证完毕。');
}

main().catch(err => {
    console.error('验证脚本异常:', err);
    process.exit(1);
});
