const sqlite3 = require('sqlite3').verbose();
const oracledb = require('oracledb');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const logger = console;

// SQLite Config
const SQLITE_DB_PATH = path.join(__dirname, '../data/database.sqlite'); // Correct path to actual data

// Oracle Config
const oracleConfig = {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
};

if (!process.env.ORACLE_USER) {
    logger.error("Oracle environment variables not set. Please check .env file.");
    process.exit(1);
}

function getSqliteData(db, tableName) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function migrate() {
    let sqliteDb;
    let oracleConn;

    try {
        logger.info("Starting migration...");

        // 1. Connect SQLite
        logger.info(`Connecting to SQLite at ${SQLITE_DB_PATH}...`);
        sqliteDb = new sqlite3.Database(SQLITE_DB_PATH);

        // 2. Connect Oracle
        logger.info("Connecting to Oracle...");
        oracleConn = await oracledb.getConnection(oracleConfig);
        logger.info("Connected to Oracle.");

        // Tables to migrate in order (Parents first for Insert, Children first for Delete)
        // Migration Order: gjj_ywbzk -> gjj_ywbzkhc -> gjj_ywbzksx -> gjj_ywbz -> gjj_ywbzsx -> gjj_ywbz_debug_case
        // Delete Order: gjj_ywbzsx -> gjj_ywbz -> gjj_ywbz_debug_case -> gjj_ywbzkhc -> gjj_ywbzksx -> gjj_ywbzk
        
        // 3. Clear Oracle Data
        logger.info("Clearing existing data in Oracle...");
        await oracleConn.execute("DELETE FROM gjj_ywbzsx");
        await oracleConn.execute("DELETE FROM gjj_ywbz");
        await oracleConn.execute("DELETE FROM gjj_ywbz_debug_case");
        await oracleConn.execute("DELETE FROM gjj_ywbzkhc");
        await oracleConn.execute("DELETE FROM gjj_ywbzksx");
        await oracleConn.execute("DELETE FROM gjj_ywbzk");
        logger.info("Cleared existing data.");

        // 4. Migrate gjj_ywbzk
        logger.info("Migrating gjj_ywbzk...");
        const ywbzkRows = await getSqliteData(sqliteDb, 'gjj_ywbzk');
        if (ywbzkRows.length > 0) {
            const sql = `INSERT INTO gjj_ywbzk (id, pxh, ywblbz, zdybm, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, ywblfl, bzfl, cjsj, gxsj) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13)`;
            const binds = ywbzkRows.map(row => [
                row.id, row.pxh, row.ywblbz, row.zdybm, row.ywbzz, row.ywbzjg, row.ywblbzsm, row.gjsjsf, row.ywnrfl, row.ywblfl || '1', row.bzfl,
                row.cjsj ? new Date(row.cjsj) : new Date(), 
                row.gxsj ? new Date(row.gxsj) : new Date()
            ]);
            await oracleConn.executeMany(sql, binds, { autoCommit: false });
            logger.info(`Migrated ${ywbzkRows.length} rows to gjj_ywbzk.`);
        }

        // 5. Migrate gjj_ywbzkhc
        logger.info("Migrating gjj_ywbzkhc...");
        const ywbzkhcRows = await getSqliteData(sqliteDb, 'gjj_ywbzkhc');
        if (ywbzkhcRows.length > 0) {
            const sql = `INSERT INTO gjj_ywbzkhc (id, mbid, hcmbid, cjsj, gxsj) VALUES (:1, :2, :3, :4, :5)`;
            const binds = ywbzkhcRows.map(row => [
                row.id, row.mbid, row.hcmbid,
                row.cjsj ? new Date(row.cjsj) : new Date(),
                row.gxsj ? new Date(row.gxsj) : new Date()
            ]);
            await oracleConn.executeMany(sql, binds, { autoCommit: false });
            logger.info(`Migrated ${ywbzkhcRows.length} rows to gjj_ywbzkhc.`);
        }

        // 6. Migrate gjj_ywbzksx
        logger.info("Migrating gjj_ywbzksx...");
        const ywbzksxRows = await getSqliteData(sqliteDb, 'gjj_ywbzksx');
        if (ywbzksxRows.length > 0) {
            const sql = `INSERT INTO gjj_ywbzksx (id, mbid, ywblbzdx, fwdxbq, sxbm, ywblbzsx, sxly, ywblbzyg, cjsj, gxsj) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10)`;
            const binds = ywbzksxRows.map(row => [
                row.id, row.mbid, row.ywblbzdx, row.fwdxbq, row.sxbm, row.ywblbzsx, row.sxly, row.ywblbzyg,
                row.cjsj ? new Date(row.cjsj) : new Date(),
                row.gxsj ? new Date(row.gxsj) : new Date()
            ]);
            await oracleConn.executeMany(sql, binds, { autoCommit: false });
            logger.info(`Migrated ${ywbzksxRows.length} rows to gjj_ywbzksx.`);
        }

        // 7. Migrate gjj_ywbz
        logger.info("Migrating gjj_ywbz...");
        const ywbzRows = await getSqliteData(sqliteDb, 'gjj_ywbz');
        if (ywbzRows.length > 0) {
            const sql = `INSERT INTO gjj_ywbz (id, mbid, ywsf, ywnrfl, gzmc, gzljsm, yxj, sfqy, jgbh, zjgbh, cjsj, gxsj) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12)`;
            const binds = ywbzRows.map(row => [
                row.id, row.mbid, row.ywsf, row.ywnrfl, row.gzmc, row.gzljsm, row.yxj, row.sfqy, row.jgbh, row.zjgbh,
                row.cjsj ? new Date(row.cjsj) : new Date(),
                row.gxsj ? new Date(row.gxsj) : new Date()
            ]);
            await oracleConn.executeMany(sql, binds, { autoCommit: false });
            logger.info(`Migrated ${ywbzRows.length} rows to gjj_ywbz.`);
        }

        // 8. Migrate gjj_ywbzsx
        logger.info("Migrating gjj_ywbzsx...");
        const ywbzsxRows = await getSqliteData(sqliteDb, 'gjj_ywbzsx');
        if (ywbzsxRows.length > 0) {
            const sql = `INSERT INTO gjj_ywbzsx (id, ywid, row_index, k1, v1, k2, v2, k3, v3, k4, v4, k5, v5, k6, v6, k7, v7, k8, v8, k9, v9, k10, v10, result, cjsj, gxsj) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16, :17, :18, :19, :20, :21, :22, :23, :24, :25, :26)`;
            const binds = ywbzsxRows.map(row => [
                row.id, row.ywid, row.row_index, 
                row.k1, row.v1, row.k2, row.v2, row.k3, row.v3, row.k4, row.v4, row.k5, row.v5, 
                row.k6, row.v6, row.k7, row.v7, row.k8, row.v8, row.k9, row.v9, row.k10, row.v10,
                row.result,
                row.cjsj ? new Date(row.cjsj) : new Date(),
                row.gxsj ? new Date(row.gxsj) : new Date()
            ]);
            await oracleConn.executeMany(sql, binds, { autoCommit: true }); // Commit at the end
            logger.info(`Migrated ${ywbzsxRows.length} rows to gjj_ywbzsx.`);
        } else {
            await oracleConn.commit();
        }

        // 9. Migrate gjj_ywbz_debug_case
        logger.info("Migrating gjj_ywbz_debug_case...");
        const debugCaseRows = await getSqliteData(sqliteDb, 'gjj_ywbz_debug_case');
        if (debugCaseRows.length > 0) {
            const sql = `INSERT INTO gjj_ywbz_debug_case (id, ywsf, ywnrfl, case_name, request_json, result_summary, creator_name, jgbh, zjgbh, cjsj, gxsj) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11)`;
            const binds = debugCaseRows.map(row => [
                row.id, row.ywsf, row.ywnrfl, row.case_name, row.request_json, row.result_summary, row.creator_name, row.jgbh, row.zjgbh,
                row.cjsj ? new Date(row.cjsj) : new Date(),
                row.gxsj ? new Date(row.gxsj) : new Date()
            ]);
            await oracleConn.executeMany(sql, binds, { autoCommit: true });
            logger.info(`Migrated ${debugCaseRows.length} rows to gjj_ywbz_debug_case.`);
        }

        logger.info("Migration completed successfully.");

    } catch (err) {
        logger.error("Migration failed:", err);
        if (oracleConn) {
            try { await oracleConn.rollback(); } catch (e) { console.error("Rollback failed", e); }
        }
    } finally {
        if (sqliteDb) {
            sqliteDb.close();
        }
        if (oracleConn) {
            try { await oracleConn.close(); } catch (e) { console.error("Close failed", e); }
        }
    }
}

migrate();
