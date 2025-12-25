#!/usr/bin/env node
/**
 * 为页面添加报告生成功能的通用脚本 (Node.js 版本)
 * 用于在生产环境中批量添加 report_display 组件
 * 
 * 用法:
 *     node add_report_display_to_pages.js page_key1 page_key2 page_key3
 *     
 * 示例:
 *     node add_report_display_to_pages.js fx_demo gdlfx cs1222
 */

const db = require('./server/db');
const path = require('path');

// report_display 组件的完整 JSON
function getReportDisplayComponent(pageKey) {
    return {
        type: "service",
        id: "report_display_root",
        className: "p-none",
        body: [
            {
                type: "container",
                visibleOn: "${report_loading}",
                style: {
                    position: "fixed",
                    top: "0",
                    left: "0",
                    width: "100vw",
                    height: "100vh",
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    zIndex: "9999",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(8px)"
                },
                body: [{
                    type: "tpl",
                    tpl: "<div style='font-size: 18px; color: #1890ff; font-weight: 600;'>🔄 正在生成报告...</div>"
                }]
            },
            {
                type: "container",
                visibleOn: "${show_report_result}",
                style: {
                    position: "fixed",
                    top: "0",
                    left: "0",
                    width: "100vw",
                    height: "100vh",
                    backgroundColor: "#525659",
                    zIndex: "9998"
                },
                body: [
                    {
                        type: "container",
                        style: {
                            backgroundColor: "#1a3c6e",
                            color: "white",
                            padding: "15px 20px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        },
                        body: [
                            {
                                type: "tpl",
                                tpl: "<span style='font-size: 18px; font-weight: bold;'>📄 风险分析报告预览</span>"
                            },
                            {
                                type: "button",
                                label: "✖ 关闭",
                                level: "danger",
                                onEvent: {
                                    click: {
                                        actions: [{
                                            actionType: "setValue",
                                            componentId: "global_page_root",
                                            args: {
                                                value: {
                                                    show_report_result: false,
                                                    report_loading: false
                                                }
                                            }
                                        }]
                                    }
                                }
                            }
                        ]
                    },
                    {
                        type: "service",
                        id: "report_service_inner",
                        style: {
                            height: "calc(100vh - 60px)",
                            overflowY: "auto",
                            padding: "30px"
                        },
                        schemaApi: {
                            method: "post",
                            url: "/api/ai/generate-page",
                            sendOn: "${report_loading === true}",
                            data: {
                                pageId: pageKey,
                                workflowType: "report_generation",
                                query: `生成 ${pageKey} 分析报告`,
                                timestamp: "${date(now(), 'x')}"
                            }
                        },
                        onEvent: {
                            fetchSchemaInited: {
                                actions: [{
                                    actionType: "setValue",
                                    componentId: "global_page_root",
                                    args: {
                                        value: {
                                            report_loading: false
                                        }
                                    }
                                }]
                            },
                            fetchFailed: {
                                actions: [{
                                    actionType: "setValue",
                                    componentId: "global_page_root",
                                    args: {
                                        value: {
                                            report_loading: false
                                        }
                                    }
                                }]
                            }
                        }
                    }
                ]
            }
        ]
    };
}

function addReportDisplay(pageKey, dryRun = false) {
    return new Promise((resolve, reject) => {
        // 获取当前页面配置
        const sql = 'SELECT schema_json FROM sys_page_template WHERE page_key = ? AND is_active = 1';

        db.get(sql, [pageKey], (err, row) => {
            if (err) {
                return resolve({
                    success: false,
                    page_key: pageKey,
                    error: err.message
                });
            }

            if (!row) {
                return resolve({
                    success: false,
                    page_key: pageKey,
                    error: '页面不存在或未激活'
                });
            }

            try {
                const schema = JSON.parse(row.schema_json);

                // 检查是否已有 report_display_root
                const hasReport = schema.body && schema.body.some(
                    component => component.id === 'report_display_root'
                );

                if (hasReport) {
                    return resolve({
                        success: true,
                        page_key: pageKey,
                        skipped: true,
                        message: '已包含 report_display 组件'
                    });
                }

                if (dryRun) {
                    return resolve({
                        success: true,
                        page_key: pageKey,
                        dry_run: true,
                        message: '将添加 report_display 组件（dry-run模式）'
                    });
                }

                // 添加组件
                if (!schema.body) {
                    schema.body = [];
                }

                const reportComponent = getReportDisplayComponent(pageKey);
                schema.body.push(reportComponent);

                // 确保有正确的 ID
                if (!schema.id) {
                    schema.id = 'global_page_root';
                }

                // 更新数据库
                const newSchemaJson = JSON.stringify(schema, null, 2);
                const updateSql = `
                    UPDATE sys_page_template 
                    SET schema_json = ?, 
                        updated_at = datetime("now", "localtime") 
                    WHERE page_key = ? AND is_active = 1
                `;

                db.run(updateSql, [newSchemaJson, pageKey], function (updateErr) {
                    if (updateErr) {
                        return resolve({
                            success: false,
                            page_key: pageKey,
                            error: updateErr.message
                        });
                    }

                    resolve({
                        success: true,
                        page_key: pageKey,
                        added: true,
                        component_count: schema.body.length,
                        message: '成功添加 report_display 组件'
                    });
                });

            } catch (parseErr) {
                resolve({
                    success: false,
                    page_key: pageKey,
                    error: `解析失败: ${parseErr.message}`
                });
            }
        });
    });
}

async function main() {
    // 解析参数
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
用法: node add_report_display_to_pages.js [选项] <page_key1> [page_key2] ...

选项:
    --dry-run    仅检查，不实际修改数据库
    --help, -h   显示此帮助信息
    
示例:
    # 为单个页面添加
    node add_report_display_to_pages.js fx_demo
    
    # 为多个页面添加
    node add_report_display_to_pages.js fx_demo gdlfx cs1222
    
    # Dry-run 模式（仅检查，不修改）
    node add_report_display_to_pages.js --dry-run fx_demo
`);
        process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
    }

    const dryRun = args.includes('--dry-run');
    const pageKeys = args.filter(arg => !arg.startsWith('--'));

    if (pageKeys.length === 0) {
        console.error('❌ 错误: 请至少指定一个 page_key');
        process.exit(1);
    }

    console.log('\n' + '='.repeat(60));
    console.log('  为页面添加报告生成功能');
    console.log('='.repeat(60));
    console.log(`模式: ${dryRun ? 'DRY-RUN（仅检查）' : '正式执行'}`);
    console.log(`页面数量: ${pageKeys.length}`);
    console.log('='.repeat(60) + '\n');

    // 处理每个页面
    const results = [];
    for (const pageKey of pageKeys) {
        process.stdout.write(`处理页面: ${pageKey} ... `);
        const result = await addReportDisplay(pageKey, dryRun);
        results.push(result);

        if (result.success) {
            if (result.skipped) {
                console.log(`⏭️  ${result.message}`);
            } else if (result.dry_run) {
                console.log(`✓  ${result.message}`);
            } else {
                console.log(`✅ ${result.message}`);
            }
        } else {
            console.log(`❌ ${result.error}`);
        }
    }

    // 统计结果
    console.log('\n' + '='.repeat(60));
    console.log('  执行结果');
    console.log('='.repeat(60));

    const successCount = results.filter(r => r.success && r.added).length;
    const skippedCount = results.filter(r => r.success && r.skipped).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`✅ 成功添加: ${successCount}`);
    console.log(`⏭️  已存在跳过: ${skippedCount}`);
    console.log(`❌ 失败: ${failedCount}`);
    console.log(`总计: ${results.length}`);

    if (!dryRun && successCount > 0) {
        console.log('\n📝 提示: 请刷新浏览器查看更新后的页面');
    }

    process.exit(failedCount === 0 ? 0 : 1);
}

// 运行主函数
main().catch(err => {
    console.error('❌ 执行失败:', err);
    process.exit(1);
});
