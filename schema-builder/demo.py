#!/usr/bin/env python3
"""
演示脚本：展示如何使用新的图表组件
"""

import json
import sys
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from template_helpers import (
    generate_alert_html,
    generate_line_adaptor,
    generate_radar_adaptor,
    generate_funnel_adaptor,
    get_color_scheme
)

# 颜色主题
COLORS = {
    'title': '#1d1d1f',
    'subtitle': '#86868b',
    'text': '#1d1d1f',
    'text_secondary': '#666',
    'background': '#f7f8fa',
    'alert_bg': '#f5f5f7',
    'alert_border': '#e5e5ea',
    'chart_colors': get_color_scheme('business'),
    'tag_risk_analysis': '#0050b3',
    'tag_avoidance': '#006d75',
    'panel_shadow': '0 4px 12px rgba(0,0,0,0.08)',
    'panel_border': '#f0f0f0',
    'divider': '#e8e8e8'
}

def demo_line_chart():
    """演示折线图的使用"""
    print("=" * 60)
    print("📈 折线图组件演示")
    print("=" * 60)
    
    config = {
        "chart_type": "line",
        "title": "销售趋势分析",
        "subtitle": "2024年月度数据",
        "line_api_url": "/api/sales/monthly-trend",
        "line_height": 400,
        "line_smooth": True,
        "line_show_area": True,
        "line_clickable": True,
        "line_detail_api": "/api/sales/detail"
    }
    
    print("\n配置示例:")
    print(json.dumps(config, indent=2, ensure_ascii=False))
    
    print("\n使用的适配器:")
    adaptor = generate_line_adaptor(smooth=True, show_area=True)
    print(adaptor[:200] + "...")
    
    print("\n✅ 折线图配置完成！")
    print("   特性: 平滑曲线 + 面积填充 + 点击交互")
    print()

def demo_radar_chart():
    """演示雷达图的使用"""
    print("=" * 60)
    print("🎯 雷达图组件演示")
    print("=" * 60)
    
    config = {
        "chart_type": "radar",
        "title": "团队能力评估",
        "subtitle": "五维度综合分析",
        "radar_api_url": "/api/team/capability",
        "radar_height": 450,
        "radar_opacity": 0.3,
        "radar_split_number": 5,
        "radar_shape": "polygon",
        "radar_clickable": True
    }
    
    print("\n配置示例:")
    print(json.dumps(config, indent=2, ensure_ascii=False))
    
    print("\n使用的适配器:")
    adaptor = generate_radar_adaptor({
        'shape': 'polygon',
        'split_number': 5,
        'area_opacity': 0.3
    })
    print(adaptor[:200] + "...")
    
    print("\n✅ 雷达图配置完成！")
    print("   特性: 多维评估 + 详细分析 + 优化建议")
    print()

def demo_funnel_chart():
    """演示漏斗图的使用"""
    print("=" * 60)
    print("📊 漏斗图组件演示")
    print("=" * 60)
    
    config = {
        "chart_type": "funnel",
        "title": "营销转化漏斗",
        "subtitle": "从曝光到成交的完整路径",
        "funnel_api_url": "/api/marketing/funnel",
        "funnel_height": 450,
        "funnel_align": "center",
        "funnel_sort": "descending",
        "funnel_gap": 2,
        "funnel_clickable": True
    }
    
    print("\n配置示例:")
    print(json.dumps(config, indent=2, ensure_ascii=False))
    
    print("\n使用的适配器:")
    adaptor = generate_funnel_adaptor({
        'align': 'center',
        'sort': 'descending',
        'gap': 2
    })
    print(adaptor[:200] + "...")
    
    print("\n✅ 漏斗图配置完成！")
    print("   特性: 自动计算转化率 + 流失分析 + 详细数据")
    print()

def demo_color_schemes():
    """演示颜色方案"""
    print("=" * 60)
    print("🎨 颜色方案演示")
    print("=" * 60)
    
    schemes = ['default', 'business', 'soft', 'warm', 'cool', 'nature']
    
    for scheme in schemes:
        colors = get_color_scheme(scheme)
        print(f"\n{scheme.upper()} 方案:")
        print(f"  颜色: {', '.join(colors[:4])}...")
        
    print("\n✅ 共8种预设配色方案可用！")
    print()

def main():
    """主函数"""
    print("\n" + "🚀" * 30)
    print("   AMIS 图表组件库 - 功能演示")
    print("🚀" * 30 + "\n")
    
    # 演示各个组件
    demo_line_chart()
    demo_radar_chart()
    demo_funnel_chart()
    demo_color_schemes()
    
    # 总结
    print("=" * 60)
    print("📚 演示总结")
    print("=" * 60)
    print("""
✅ 已创建的图表组件:
   1. 折线图 (line_chart_panel.j2) - 趋势分析
   2. 雷达图 (radar_chart_panel.j2) - 多维评估
   3. 漏斗图 (funnel_chart_panel.j2) - 转化分析
   4. 仪表盘 (gauge_chart_panel.j2) - KPI监控

✅ 增强的辅助函数:
   - 8种预设颜色方案
   - 6个数据适配器生成器
   - 配置验证函数

✅ 配置示例文件:
   - line_chart_example.json
   - radar_chart_example.json
   - funnel_chart_example.json

📖 快速开始:
   查看 QUICKSTART.md 了解详细使用方法
   
🎯 下一步:
   1. 选择一个图表组件
   2. 复制对应的配置示例
   3. 修改API地址和参数
   4. 运行 build_schema.py 生成
   5. 部署到数据库
    """)
    print("=" * 60)
    print("✨ Happy Coding! ✨")
    print("=" * 60 + "\n")

if __name__ == '__main__':
    main()
