#!/usr/bin/env node
/**
 * 将 Oracle 风格的业务标准/业务规则导出文件整理为 PG-family 可执行脚本，
 * 并可直接导入 PostgreSQL / openGauss / Kingbase 本地验证环境。
 *
 * 用法:
 *   node server/scripts/import_pg_family_exports.js --write
 *   node server/scripts/import_pg_family_exports.js --targets=pg,gauss,kingbase
 *   node server/scripts/import_pg_family_exports.js --write --targets=pg
 */

const fs = require('fs');
const path = require('path');
const { PgAdapter, GaussAdapter, KingbaseAdapter } = require('../db_pg');

const EXPORT_FILES = [
    path.resolve(__dirname, '../exports/ywbzk_full_export.csv'),
    path.resolve(__dirname, '../exports/ywbz_full_export.csv')
];

const OUTPUT_FILE = path.resolve(__dirname, '../exports/pg_family_full_import.sql');

const TABLE_ORDER = [
    'gjj_ywbzk',
    'gjj_ywbzksx',
    'gjj_ywbz',
    'gjj_ywbzsx'
];

const TARGETS = {
    pg: {
        label: 'PostgreSQL',
        AdapterClass: PgAdapter,
        config: {
            host: process.env.PG_IMPORT_HOST || '127.0.0.1',
            port: Number(process.env.PG_IMPORT_PORT || 55432),
            database: process.env.PG_IMPORT_DATABASE || 'damoxing',
            user: process.env.PG_IMPORT_USER || 'damoxing',
            password: process.env.PG_IMPORT_PASSWORD || 'Damoxing123!',
            poolMin: 1,
            poolMax: 3
        }
    },
    gauss: {
        label: 'openGauss',
        AdapterClass: GaussAdapter,
        config: {
            host: process.env.GAUSS_IMPORT_HOST || '127.0.0.1',
            port: Number(process.env.GAUSS_IMPORT_PORT || 55433),
            database: process.env.GAUSS_IMPORT_DATABASE || 'damoxing',
            user: process.env.GAUSS_IMPORT_USER || 'gaussdb',
            password: process.env.GAUSS_IMPORT_PASSWORD || 'Damoxing123!',
            poolMin: 1,
            poolMax: 3
        }
    },
    kingbase: {
        label: 'Kingbase',
        AdapterClass: KingbaseAdapter,
        config: {
            host: process.env.KINGBASE_IMPORT_HOST || '127.0.0.1',
            port: Number(process.env.KINGBASE_IMPORT_PORT || 55434),
            database: process.env.KINGBASE_IMPORT_DATABASE || 'test',
            user: process.env.KINGBASE_IMPORT_USER || 'system',
            password: process.env.KINGBASE_IMPORT_PASSWORD || 'Damoxing123!',
            poolMin: 1,
            poolMax: 3
        }
    }
};

function parseArgs(argv) {
    const result = {
        write: false,
        targets: []
    };

    argv.forEach(arg => {
        if (arg === '--write') {
            result.write = true;
            return;
        }
        if (arg.startsWith('--targets=')) {
            result.targets = arg
                .slice('--targets='.length)
                .split(',')
                .map(item => item.trim())
                .filter(Boolean);
        }
    });

    return result;
}

function removeBom(text) {
    return text.replace(/^\uFEFF/, '');
}

function splitSqlStatements(text) {
    const statements = [];
    let current = '';
    let inQuote = false;
    let inLineComment = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inLineComment) {
            if (char === '\n') {
                inLineComment = false;
            }
            continue;
        }

        if (!inQuote && char === '-' && next === '-') {
            inLineComment = true;
            i++;
            continue;
        }

        if (char === '\'') {
            current += char;
            if (next === '\'') {
                current += next;
                i++;
            } else {
                inQuote = !inQuote;
            }
            continue;
        }

        if (char === ';' && !inQuote) {
            const statement = current.trim();
            if (statement) {
                statements.push(statement);
            }
            current = '';
            continue;
        }

        current += char;
    }

    const tail = current.trim();
    if (tail) {
        statements.push(tail);
    }

    return statements;
}

function replaceOutsideQuotes(input, replacer) {
    let result = '';
    let inQuote = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        const next = input[i + 1];

        if (char === '\'') {
            result += char;
            if (next === '\'') {
                result += next;
                i++;
            } else {
                inQuote = !inQuote;
            }
            continue;
        }

        if (!inQuote) {
            const replaced = replacer(input, i);
            if (replaced) {
                result += replaced.text;
                i = replaced.endIndex;
                continue;
            }
        }

        result += char;
    }

    return result;
}

function convertOracleOuterSyntaxToPg(statement) {
    return replaceOutsideQuotes(statement, (source, index) => {
        if (/^TO_DATE\s*\(/i.test(source.slice(index))) {
            const match = source.slice(index).match(/^TO_DATE(\s*\()/i);
            if (match) {
                return {
                    text: `TO_TIMESTAMP${match[1]}`,
                    endIndex: index + 'TO_DATE'.length + match[1].length - 1
                };
            }
        }
        return null;
    });
}

function collectStatements() {
    const grouped = {
        gjj_ywbzk: [],
        gjj_ywbzksx: [],
        gjj_ywbz: [],
        gjj_ywbzsx: []
    };

    for (const filePath of EXPORT_FILES) {
        const raw = removeBom(fs.readFileSync(filePath, 'utf8'));
        const statements = splitSqlStatements(raw);

        for (const statement of statements) {
            const normalized = statement.replace(/\s+/g, ' ').trim();
            const match = normalized.match(/^INSERT INTO (gjj_ywbzk|gjj_ywbzksx|gjj_ywbz|gjj_ywbzsx)\b/i);
            if (!match) {
                continue;
            }

            const table = match[1].toLowerCase();
            grouped[table].push(convertOracleOuterSyntaxToPg(statement).trim() + ';');
        }
    }

    return grouped;
}

function buildOutputSql(grouped) {
    const lines = [];
    lines.push('-- PG-family full import generated from Oracle exports');
    lines.push(`-- Generated at: ${new Date().toISOString()}`);
    lines.push('BEGIN;');
    lines.push('');
    lines.push('DELETE FROM gjj_ywbzsx;');
    lines.push('DELETE FROM gjj_ywbz;');
    lines.push('DELETE FROM gjj_ywbzksx;');
    lines.push('DELETE FROM gjj_ywbzk;');
    lines.push('');

    for (const table of TABLE_ORDER) {
        lines.push(`-- ${table}`);
        grouped[table].forEach(statement => {
            lines.push(statement);
        });
        lines.push('');
    }

    lines.push('COMMIT;');
    lines.push('');
    return lines.join('\n');
}

function printStats(grouped) {
    console.log('\n导出汇总:');
    TABLE_ORDER.forEach(table => {
        console.log(`  ${table}: ${grouped[table].length}`);
    });
}

async function resetIdentitySequence(adapter, table, column = 'id') {
    const seqRow = await adapter.get(`SELECT pg_get_serial_sequence('${table}', '${column}') AS seq_name`);
    const seqName = seqRow?.seq_name;

    if (!seqName) {
        return null;
    }

    await adapter.get(`
        SELECT setval(
            '${seqName}',
            COALESCE((SELECT MAX(${column}) FROM ${table}), 1),
            true
        ) AS current_value
    `);

    return seqName;
}

async function importToTarget(targetKey, grouped) {
    const target = TARGETS[targetKey];
    if (!target) {
        throw new Error(`不支持的目标库: ${targetKey}`);
    }

    const adapter = new target.AdapterClass(target.config, `import_${targetKey}`);
    await adapter.initialize();

    try {
        await adapter.transaction(async (tx) => {
            await tx.exec('DELETE FROM gjj_ywbzsx');
            await tx.exec('DELETE FROM gjj_ywbz');
            await tx.exec('DELETE FROM gjj_ywbzksx');
            await tx.exec('DELETE FROM gjj_ywbzk');

            for (const table of TABLE_ORDER) {
                for (const statement of grouped[table]) {
                    await tx.exec(statement);
                }
            }
        });

        const counts = {};
        for (const table of TABLE_ORDER) {
            const row = await adapter.get(`SELECT COUNT(*) AS total FROM ${table}`);
            counts[table] = Number(row?.total || 0);
        }

        const relationChecks = {
            missingRuleTemplate: await adapter.get(`
                SELECT COUNT(*) AS total
                FROM gjj_ywbz t
                WHERE t.mbid IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM gjj_ywbzk z WHERE z.id = t.mbid)
            `),
            missingStdAttrTemplate: await adapter.get(`
                SELECT COUNT(*) AS total
                FROM gjj_ywbzksx t
                WHERE t.mbid IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM gjj_ywbzk z WHERE z.id = t.mbid)
            `),
            missingRuleAttrOwner: await adapter.get(`
                SELECT COUNT(*) AS total
                FROM gjj_ywbzsx t
                WHERE t.ywid IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM gjj_ywbz z WHERE z.id = t.ywid)
            `)
        };

        const missingRuleTemplateRows = Number(relationChecks.missingRuleTemplate.total) > 0
            ? await adapter.all(`
                SELECT id, mbid, gzmc, jgbh, zjgbh
                FROM gjj_ywbz t
                WHERE t.mbid IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM gjj_ywbzk z WHERE z.id = t.mbid)
                ORDER BY id
                LIMIT 20
            `)
            : [];

        const sequenceResetResults = {};
        for (const table of TABLE_ORDER) {
            sequenceResetResults[table] = await resetIdentitySequence(adapter, table);
        }

        console.log(`\n[${target.label}] 导入完成`);
        TABLE_ORDER.forEach(table => {
            console.log(`  ${table}: ${counts[table]}`);
        });
        console.log(`  missingRuleTemplate: ${relationChecks.missingRuleTemplate.total}`);
        console.log(`  missingStdAttrTemplate: ${relationChecks.missingStdAttrTemplate.total}`);
        console.log(`  missingRuleAttrOwner: ${relationChecks.missingRuleAttrOwner.total}`);
        Object.entries(sequenceResetResults).forEach(([table, seqName]) => {
            if (seqName) {
                console.log(`  resetSequence(${table}): ${seqName}`);
            }
        });
        if (missingRuleTemplateRows.length > 0) {
            console.log('  missingRuleTemplateRows:');
            missingRuleTemplateRows.forEach(row => {
                console.log(`    id=${row.id}, mbid=${row.mbid}, gzmc=${row.gzmc}, jgbh=${row.jgbh}, zjgbh=${row.zjgbh}`);
            });
        }
    } finally {
        await adapter.close();
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const grouped = collectStatements();

    printStats(grouped);

    if (args.write) {
        const outputSql = buildOutputSql(grouped);
        fs.writeFileSync(OUTPUT_FILE, outputSql, 'utf8');
        console.log(`\n已生成: ${OUTPUT_FILE}`);
    }

    for (const targetKey of args.targets) {
        await importToTarget(targetKey, grouped);
    }

    if (!args.write && args.targets.length === 0) {
        console.log('\n未指定 --write 或 --targets，仅完成解析统计。');
    }
}

main().catch(err => {
    console.error('\n导入失败:', err.message);
    process.exit(1);
});
