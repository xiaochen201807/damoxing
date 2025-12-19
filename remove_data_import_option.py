#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
移除配置页面中的 data_import 选项
用途: 从系统配置页面的 AI 工作流下拉选项中移除"数据导入"选项
作者: Auto-generated
日期: 2025-12-19
"""

import json
import sqlite3
import sys
import os
from datetime import datetime


def remove_data_import_option(db_path):
    """
    从配置页面的 schema 中移除 data_import 选项
    
    Args:
        db_path: SQLite 数据库文件路径
    """
    
    # 检查数据库文件是否存在
    if not os.path.exists(db_path):
        print(f"❌ 错误: 数据库文件不存在: {db_path}")
        return False
    
    try:
        # 连接数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"📂 连接数据库: {db_path}")
        
        # 1. 查找活跃的配置页面记录
        cursor.execute("""
            SELECT id, page_key, version, schema_json 
            FROM sys_page_template 
            WHERE page_key = 'config' AND is_active = 1
            ORDER BY id DESC
            LIMIT 1
        """)
        
        result = cursor.fetchone()
        
        if not result:
            print("⚠️  警告: 未找到活跃的配置页面记录 (page_key='config', is_active=1)")
            conn.close()
            return False
        
        record_id, page_key, version, schema_json = result
        print(f"✅ 找到活跃记录: ID={record_id}, Version={version}")
        
        # 2. 解析 JSON schema
        try:
            schema = json.loads(schema_json)
        except json.JSONDecodeError as e:
            print(f"❌ JSON 解析失败: {e}")
            conn.close()
            return False
        
        # 3. 检查是否包含 data_import
        original_json = json.dumps(schema, ensure_ascii=False)
        if 'data_import' not in original_json:
            print("ℹ️  该配置页面已经不包含 data_import 选项，无需修改")
            conn.close()
            return True
        
        print("🔍 检测到 data_import 选项，开始清理...")
        
        # 4. 深度遍历并移除所有 data_import 相关内容
        def clean_data_import(obj, path="root"):
            """递归清理 data_import"""
            removed_count = 0
            
            if isinstance(obj, dict):
                # 移除 options 中的 data_import
                if 'options' in obj and isinstance(obj['options'], list):
                    original_len = len(obj['options'])
                    obj['options'] = [
                        opt for opt in obj['options'] 
                        if opt.get('value') != 'data_import'
                    ]
                    new_len = len(obj['options'])
                    if new_len < original_len:
                        removed_count += (original_len - new_len)
                        print(f"  ✓ 移除 options 中的 data_import (路径: {path})")
                
                # 移除 map 中的 data_import
                if 'map' in obj and isinstance(obj['map'], dict):
                    if 'data_import' in obj['map']:
                        obj['map'].pop('data_import')
                        removed_count += 1
                        print(f"  ✓ 移除 map 中的 data_import (路径: {path})")
                
                # 递归处理
                for key, value in obj.items():
                    removed_count += clean_data_import(value, f"{path}.{key}")
                    
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    removed_count += clean_data_import(item, f"{path}[{i}]")
            
            return removed_count
        
        removed_count = clean_data_import(schema)
        
        if removed_count == 0:
            print("ℹ️  未找到需要移除的 data_import 引用")
            conn.close()
            return True
        
        print(f"📊 共移除 {removed_count} 处 data_import 引用")
        
        # 5. 生成新的 JSON
        new_schema_json = json.dumps(schema, ensure_ascii=False)
        
        # 6. 备份原始数据（可选）
        backup_table = "sys_page_template_backup"
        try:
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {backup_table} AS 
                SELECT * FROM sys_page_template WHERE 1=0
            """)
            cursor.execute(f"""
                INSERT INTO {backup_table} 
                SELECT * FROM sys_page_template WHERE id = ?
            """, (record_id,))
            print(f"💾 已备份原始记录到 {backup_table} 表")
        except Exception as e:
            print(f"⚠️  备份失败（可忽略）: {e}")
        
        # 7. 更新数据库
        cursor.execute("""
            UPDATE sys_page_template 
            SET schema_json = ?, 
                updated_at = datetime('now')
            WHERE id = ?
        """, (new_schema_json, record_id))
        
        conn.commit()
        affected_rows = cursor.rowcount
        
        # 8. 验证更新
        cursor.execute("SELECT schema_json FROM sys_page_template WHERE id = ?", (record_id,))
        updated_schema = cursor.fetchone()[0]
        
        if 'data_import' in updated_schema:
            print("❌ 验证失败: 更新后仍包含 data_import")
            conn.rollback()
            conn.close()
            return False
        
        print(f"✅ 成功更新记录 (ID={record_id})")
        print(f"✅ 验证通过: schema 中已不包含 data_import")
        print(f"📅 更新时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"❌ 数据库错误: {e}")
        return False
    except Exception as e:
        print(f"❌ 未知错误: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主函数"""
    print("=" * 60)
    print("  移除配置页面 data_import 选项脚本")
    print("=" * 60)
    print()
    
    # 获取数据库路径
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    else:
        # 默认路径
        db_path = "server/data/database.sqlite"
        print(f"💡 使用默认数据库路径: {db_path}")
        print(f"💡 也可以指定路径: python3 {sys.argv[0]} /path/to/database.sqlite")
        print()
    
    # 执行移除
    success = remove_data_import_option(db_path)
    
    print()
    print("=" * 60)
    if success:
        print("✅ 操作成功完成")
        print()
        print("📝 后续步骤:")
        print("   1. 重启应用服务器")
        print("   2. 刷新配置页面")
        print("   3. 验证 AI 工作流类型下拉选项中不再显示'数据导入'")
    else:
        print("❌ 操作失败")
        print()
        print("🔧 故障排除:")
        print("   1. 检查数据库文件路径是否正确")
        print("   2. 检查是否有数据库访问权限")
        print("   3. 检查 sys_page_template 表是否存在")
        print("   4. 查看上方错误信息获取详细原因")
    print("=" * 60)
    
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())
