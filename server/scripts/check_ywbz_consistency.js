#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
    DmAdapter,
    OracleAdapter,
} = require('@damoxing/datasource-manager');

function parseArgs(argv) {
    const args = {};
    for (const item of argv) {
        if (!item.startsWith('--')) {
            continue;
        }

        const index = item.indexOf('=');
        if (index === -1) {
            args[item.slice(2)] = true;
            continue;
        }

        args[item.slice(2, index)] = item.slice(index + 1);
    }
    return args;
}

function getCountValue(row) {
    return Number(row?.total ?? row?.TOTAL ?? row?.count ?? row?.COUNT ?? 0) || 0;
}

function readDatasourcesConfig() {
    const configPath = path.join(__dirname, '../config/datasources.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(`datasources.json not found: ${configPath}`);
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function buildOracleConnectString(args) {
    if (args['connect-string']) {
        return args['connect-string'];
    }

    const host = args.host;
    const port = args.port || '1521';
    const service = args.service || args.sid;

    if (!host || !service) {
        throw new Error('Oracle 手工连接缺少必要参数：--host、--service');
    }

    return `${host}:${port}/${service}`;
}

function buildDmConnectString(args) {
    if (args['connect-string']) {
        return args['connect-string'];
    }

    const host = args.host;
    const port = args.port || '5236';
    if (!host) {
        throw new Error('达梦手工连接缺少必要参数：--host');
    }

    return `${host}:${port}`;
}

function buildManualDatasource(args) {
    const dbType = String(args['db-type'] || '').trim().toLowerCase();
    const user = args.user;
    const password = args.password;

    if (!dbType || !user || password === undefined) {
        throw new Error('手工连接至少需要提供：--db-type、--user、--password');
    }

    if (dbType === 'oracle') {
        return {
            id: 'manual_oracle',
            type: 'oracle',
            config: {
                user,
                password,
                connectString: buildOracleConnectString(args),
                poolMin: 1,
                poolMax: 2,
            }
        };
    }

    if (dbType === 'dm') {
        return {
            id: 'manual_dm',
            type: 'dm',
            config: {
                user,
                password,
                connectString: buildDmConnectString(args),
                loginEncrypt: String(args['login-encrypt'] || '').trim().toLowerCase() === 'true',
                poolMin: 1,
                poolMax: 2,
            }
        };
    }

    throw new Error(`Unsupported db type: ${dbType}`);
}

function resolveDatasource(args) {
    if (args.datasource) {
        const conf = readDatasourcesConfig();
        const datasourceId = args.datasource === 'default' ? conf.default_datasource : args.datasource;
        const datasource = (conf.datasources || []).find(item => item.id === datasourceId);
        if (!datasource) {
            throw new Error(`Datasource not found: ${datasourceId}`);
        }
        return datasource;
    }

    return buildManualDatasource(args);
}

async function createAdapter(datasource) {
    if (datasource.type === 'oracle') {
        const adapter = new OracleAdapter(datasource.config, datasource.id);
        await adapter.initialize();
        return adapter;
    }

    if (datasource.type === 'dm') {
        const adapter = new DmAdapter(datasource.config, datasource.id);
        await adapter.initialize();
        return adapter;
    }

    throw new Error(`Unsupported datasource type: ${datasource.type}`);
}

function buildScopeClause(args, alias = 't') {
    const clauses = [];
    const params = [];

    if (args.jgbh) {
        clauses.push(`NVL(${alias}.jgbh, '') = ?`);
        params.push(args.jgbh);
    }

    if (args.zjgbh) {
        clauses.push(`NVL(${alias}.zjgbh, '') = ?`);
        params.push(args.zjgbh);
    }

    return {
        where: clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '',
        params,
    };
}

async function runCheck(adapter, title, countSql, sampleSql, params) {
    const summary = await adapter.get(countSql, params);
    const total = getCountValue(summary);
    const sampleRows = total > 0 ? await adapter.all(sampleSql, params) : [];
    return { title, total, sampleRows };
}

async function runChecks(adapter, args) {
    const tScope = buildScopeClause(args, 't');
    const rScope = buildScopeClause(args, 'r');

    return [
        await runCheck(
            adapter,
            '启用规则缺少 mbid',
            `SELECT COUNT(*) AS total FROM gjj_ywbz t WHERE NVL(t.sfqy, 1) = 1 AND t.mbid IS NULL${tScope.where}`,
            `SELECT * FROM (SELECT t.id, t.gzmc, t.ywsf, t.jgbh, t.zjgbh FROM gjj_ywbz t WHERE NVL(t.sfqy, 1) = 1 AND t.mbid IS NULL${tScope.where} ORDER BY t.id) WHERE ROWNUM <= 20`,
            tScope.params,
        ),
        await runCheck(
            adapter,
            '规则表悬空 mbid',
            `SELECT COUNT(*) AS total FROM gjj_ywbz t WHERE t.mbid IS NOT NULL${tScope.where} AND NOT EXISTS (SELECT 1 FROM gjj_ywbzk z WHERE z.id = t.mbid)`,
            `SELECT * FROM (SELECT t.id, t.mbid, t.gzmc, t.jgbh, t.zjgbh FROM gjj_ywbz t WHERE t.mbid IS NOT NULL${tScope.where} AND NOT EXISTS (SELECT 1 FROM gjj_ywbzk z WHERE z.id = t.mbid) ORDER BY t.id) WHERE ROWNUM <= 20`,
            tScope.params,
        ),
        await runCheck(
            adapter,
            '标准库属性表悬空 mbid',
            `SELECT COUNT(*) AS total FROM gjj_ywbzksx t WHERE t.mbid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM gjj_ywbzk z WHERE z.id = t.mbid)`,
            `SELECT * FROM (SELECT t.id, t.mbid, t.ywblbzdx, t.ywblbzsx FROM gjj_ywbzksx t WHERE t.mbid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM gjj_ywbzk z WHERE z.id = t.mbid) ORDER BY t.id) WHERE ROWNUM <= 20`,
            [],
        ),
        await runCheck(
            adapter,
            '规则属性表悬空 ywid',
            `SELECT COUNT(*) AS total FROM gjj_ywbzsx t WHERE t.ywid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM gjj_ywbz z WHERE z.id = t.ywid)`,
            `SELECT * FROM (SELECT t.id, t.ywid, t.row_index FROM gjj_ywbzsx t WHERE t.ywid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM gjj_ywbz z WHERE z.id = t.ywid) ORDER BY t.id) WHERE ROWNUM <= 20`,
            [],
        ),
        await runCheck(
            adapter,
            '同机构同模板同规则名重复',
            `SELECT COUNT(*) AS total FROM (
                SELECT r.mbid, r.gzmc, NVL(r.jgbh, '') AS jgbh, NVL(r.zjgbh, '') AS zjgbh, COUNT(*) AS cnt
                FROM gjj_ywbz r
                WHERE r.mbid IS NOT NULL${rScope.where}
                GROUP BY r.mbid, r.gzmc, NVL(r.jgbh, ''), NVL(r.zjgbh, '')
                HAVING COUNT(*) > 1
            ) t`,
            `SELECT * FROM (
                SELECT r.mbid, r.gzmc, NVL(r.jgbh, '') AS jgbh, NVL(r.zjgbh, '') AS zjgbh, COUNT(*) AS cnt
                FROM gjj_ywbz r
                WHERE r.mbid IS NOT NULL${rScope.where}
                GROUP BY r.mbid, r.gzmc, NVL(r.jgbh, ''), NVL(r.zjgbh, '')
                HAVING COUNT(*) > 1
            ) t WHERE ROWNUM <= 20`,
            rScope.params,
        ),
    ];
}

function printReport(datasource, args, results) {
    const totalIssues = results.reduce((sum, item) => sum + item.total, 0);
    const scopeLabel = args.jgbh || args.zjgbh
        ? `jgbh=${args.jgbh || '*'}, zjgbh=${args.zjgbh || '*'}`
        : '全库';

    console.log('=== 业务标准一致性校验 ===');
    console.log(`时间: ${new Date().toISOString()}`);
    console.log(`数据源: ${datasource.id} (${datasource.type})`);
    console.log(`范围: ${scopeLabel}`);
    console.log(`异常总数: ${totalIssues}`);

    for (const item of results) {
        console.log(`\n[${item.title}]`);
        console.log(`数量: ${item.total}`);
        if (item.sampleRows.length > 0) {
            console.table(item.sampleRows);
        }
    }

    console.log(`\n结论: ${totalIssues === 0 ? '通过' : '不通过'}`);
    return totalIssues;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    let adapter = null;

    try {
        const datasource = resolveDatasource(args);
        adapter = await createAdapter(datasource);
        const results = await runChecks(adapter, args);
        const totalIssues = printReport(datasource, args, results);
        process.exitCode = totalIssues === 0 ? 0 : 1;
    } catch (err) {
        console.error(err && err.stack ? err.stack : err);
        process.exitCode = 2;
    } finally {
        if (adapter) {
            await adapter.close();
        }
    }
}

main();
