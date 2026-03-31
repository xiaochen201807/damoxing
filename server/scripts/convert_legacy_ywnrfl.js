const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
    const args = {};

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token.startsWith('--')) {
            continue;
        }

        const eqIndex = token.indexOf('=');
        if (eqIndex > -1) {
            args[token.slice(2, eqIndex)] = token.slice(eqIndex + 1);
            continue;
        }

        const key = token.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
            args[key] = true;
            continue;
        }

        args[key] = next;
        i += 1;
    }

    return args;
}

function readUtf8File(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function readStdin() {
    return new Promise((resolve, reject) => {
        let content = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => {
            content += chunk;
        });
        process.stdin.on('end', () => resolve(content));
        process.stdin.on('error', reject);
    });
}

function parseJsonInput(rawText) {
    const text = String(rawText || '').trim();
    if (!text) {
        throw new Error('输入内容不能为空');
    }

    return JSON.parse(text);
}

function normalizeStatus(value) {
    if (value === undefined || value === null || value === '') {
        return 1;
    }

    if (value === 0 || value === '0' || value === false || value === 'false') {
        return 0;
    }

    return 1;
}

function normalizeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLegacyRows(payload, gjsjsf) {
    const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.rows)
                ? payload.rows
                : [];

    if (!rows.length) {
        throw new Error('未从输入中解析到业务内容分类列表');
    }

    const normalized = [];
    const seen = new Set();

    rows.forEach((row, index) => {
        const flbm = String(
            row?.value ?? row?.coding ?? row?.flbm ?? row?.code ?? ''
        ).trim();
        const flmc = String(
            row?.label ?? row?.name ?? row?.flmc ?? row?.text ?? ''
        ).trim();

        if (!flbm || !flmc) {
            return;
        }

        if (seen.has(flbm)) {
            return;
        }

        seen.add(flbm);
        normalized.push({
            gjsjsf: String(gjsjsf).trim(),
            flbm,
            flmc,
            pxh: normalizeNumber(row?.sequenceNumber ?? row?.sort ?? row?.pxh, index + 1),
            sfqy: normalizeStatus(row?.sfqy ?? row?.enabled ?? row?.isShow),
        });
    });

    if (!normalized.length) {
        throw new Error('转换后没有有效的业务内容分类数据');
    }

    return normalized;
}

function escapeSqlLiteral(value) {
    return String(value).replace(/'/g, "''");
}

function buildOracleMergeSql(rows) {
    const statements = rows.map(row => {
        const gjsjsf = escapeSqlLiteral(row.gjsjsf);
        const flbm = escapeSqlLiteral(row.flbm);
        const flmc = escapeSqlLiteral(row.flmc);

        return [
            'MERGE INTO gjj_ywnrfl t',
            `USING (SELECT '${gjsjsf}' AS gjsjsf, '${flbm}' AS flbm, '${flmc}' AS flmc, ${row.pxh} AS pxh, ${row.sfqy} AS sfqy FROM dual) s`,
            'ON (t.gjsjsf = s.gjsjsf AND t.flbm = s.flbm)',
            'WHEN MATCHED THEN',
            `    UPDATE SET t.flmc = s.flmc, t.pxh = s.pxh, t.sfqy = s.sfqy, t.gxsj = SYSTIMESTAMP`,
            'WHEN NOT MATCHED THEN',
            '    INSERT (gjsjsf, flbm, flmc, pxh, sfqy, cjsj, gxsj)',
            '    VALUES (s.gjsjsf, s.flbm, s.flmc, s.pxh, s.sfqy, SYSTIMESTAMP, SYSTIMESTAMP);',
        ].join('\n');
    });

    return [
        '-- 旧业务内容分类结果转 gjj_ywnrfl 导入脚本（Oracle/达梦）',
        `-- 生成时间: ${new Date().toISOString()}`,
        `-- 数据量: ${rows.length}`,
        '',
        ...statements,
        '',
    ].join('\n');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const gjsjsf = String(args.gjsjsf || '').trim();
    const inputPath = args.input ? path.resolve(args.input) : '';
    const outputPath = args.output ? path.resolve(args.output) : '';
    const dialect = String(args.dialect || 'oracle').trim().toLowerCase();

    if (!gjsjsf) {
        throw new Error('请通过 --gjsjsf 指定关键数据算法编码');
    }

    if (!['oracle', 'dm'].includes(dialect)) {
        throw new Error(`当前仅支持 --dialect oracle|dm，收到: ${dialect}`);
    }

    const rawText = inputPath ? readUtf8File(inputPath) : await readStdin();
    const payload = parseJsonInput(rawText);
    const rows = normalizeLegacyRows(payload, gjsjsf);
    const sql = buildOracleMergeSql(rows);

    if (outputPath) {
        fs.writeFileSync(outputPath, sql, 'utf8');
        console.log(`已生成 ${rows.length} 条数据到 ${outputPath}`);
        return;
    }

    process.stdout.write(sql);
}

if (require.main === module) {
    main().catch(err => {
        console.error(err.message);
        process.exit(1);
    });
}

module.exports = {
    parseArgs,
    parseJsonInput,
    normalizeLegacyRows,
    normalizeStatus,
    buildOracleMergeSql,
    escapeSqlLiteral,
};
