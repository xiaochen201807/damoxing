#!/usr/bin/env python3
"""
快速测试脚本：生成简化版柱状图示例
"""

import json
import sys
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from template_helpers import generate_alert_html

# 设置路径
script_dir = Path(__file__).parent
template_dir = script_dir / 'templates'

# Jinja2 环境
env = Environment(
    loader=FileSystemLoader(str(template_dir)),
    trim_blocks=True,
    lstrip_blocks=True
)

# 加载配置
config_path = script_dir / 'configs' / 'bar_chart_example.json'
with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

# 生成 alert HTML
if 'content' in config:
    config['alert_html'] = generate_alert_html(config['content'], {})

# 渲染柱状图组件
print("=" * 60)
print("📊 简化版柱状图组件 - 配置测试")
print("=" * 60)

print("\n✅ 配置文件加载成功:")
print(f"   - 标题: {config['title']}")
print(f"   - 副标题: {config['subtitle']}")
print(f"   - API: {config['bar_api_url']}")
print(f"   - 高度: {config['bar_height']}px")

print("\n✅ 样式配置:")
print(f"   - 柱子颜色: {config['bar_color']}")
print(f"   - 高亮颜色: {config['bar_emphasis_color']}")
print(f"   - 圆角半径: {config['bar_border_radius']}px")
print(f"   - Y轴名称: {config['bar_y_axis_name']}")

print("\n✅ 交互配置:")
print(f"   - 可点击: {config['bar_clickable']}")
print(f"   - 详情API: {config['bar_detail_api']}")

print("\n📋 数据格式示例:")
print("""
{
    "status": 0,
    "data": {
        "xAxis": {
            "type": "category",
            "data": ["1月", "2月", "3月", "4月", "5月", "6月"]
        },
        "yAxis": {
            "type": "value"
        },
        "series": [{
            "name": "客户数",
            "type": "bar",
            "data": [120, 200, 150, 180, 220, 190]
        }]
    }
}
""")

print("\n🎯 使用说明:")
print("   1. 每个柱子代表一个月份/类别的数据")
print("   2. 只支持单系列数据（二维）")
print("   3. 点击柱子可查看详细列表")
print("   4. 支持数据导出功能")

print("\n🚀 下一步:")
print("   - 在 build_schema.py 中使用此配置")
print("   - 或直接在页面模板中引用 bar_chart_panel.j2")

print("\n" + "=" * 60)
print("✨ 测试完成！")
print("=" * 60 + "\n")
