"""
Helper functions for template rendering
"""

# ============================================================================
# 预设颜色方案
# ============================================================================

COLOR_SCHEMES = {
    'default': ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'],
    'business': ['#2f54eb', '#52c41a', '#faad14', '#f5222d', '#1890ff', '#13c2c2', '#eb2f96', '#722ed1'],
    'soft': ['#b7eb8f', '#87e8de', '#ffd591', '#ffadd2', '#d3adf7', '#ffd666', '#5cdbd3', '#ff9c6e'],
    'contrast': ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'],
    'monochrome': ['#262626', '#595959', '#8c8c8c', '#bfbfbf', '#d9d9d9', '#f0f0f0', '#fafafa', '#ffffff'],
    'warm': ['#ff6b6b', '#feca57', '#ff9ff3', '#ee5a6f', '#f368e0', '#ff7979', '#ffd93d', '#6bcf7f'],
    'cool': ['#48dbfb', '#0abde3', '#10ac84', '#00d2d3', '#5f27cd', '#341f97', '#2e86de', '#54a0ff'],
    'nature': ['#6ab04c', '#badc58', '#f9ca24', '#f0932b', '#eb4d4b', '#c7ecee', '#686de0', '#4834d4']
}

def get_color_scheme(scheme_name='default'):
    """
    获取预设颜色方案
    
    Args:
        scheme_name: 方案名称
    
    Returns:
        颜色数组
    """
    return COLOR_SCHEMES.get(scheme_name, COLOR_SCHEMES['default'])

# ============================================================================
# HTML 生成函数
# ============================================================================

def generate_alert_html(content, colors):
    """
    Generate rich HTML for alert/info box with structured content
    
    Args:
        content: dict with title and sections
        colors: color theme dict
    
    Returns:
        HTML string
    """
    html_parts = []
    # Match panel component border-radius (8px) and use white background
    html_parts.append("<div style='background-color: #ffffff; border: 1px solid #d9d9d9; border-radius: 8px; padding: 20px 24px; line-height: 1.7;'>")
    
    # Main title - larger, bolder, with left decorative border
    if content.get('title'):
        html_parts.append(f"<div style='color: #1d1d1f; font-weight: 700; font-size: 16px; margin-bottom: 18px; padding-left: 12px; border-left: 4px solid #1890ff;'>{content['title']}</div>")
    
    # Sections
    sections = content.get('sections', [])
    for i, section in enumerate(sections):
        is_last = (i == len(sections) - 1)
        margin = '0' if is_last else '20px'
        html_parts.append(f"<div style='margin-bottom: {margin};'>")
        
        # Section heading (blue) - smaller than main title, no border
        if section.get('heading'):
            html_parts.append(f"<div style='color: #1890ff; font-weight: 600; font-size: 14px; margin-bottom: 12px;'>{section['heading']}</div>")
        
        # Section text - dark text on white background
        if section.get('text'):
            html_parts.append(f"<div style='color: #333; font-size: 13px; line-height: 1.8; margin-bottom: 12px; text-align: justify;'>{section['text']}</div>")
        
        # Section items (numbered list) - proper indentation
        if section.get('items'):
            html_parts.append("<div style='padding-left: 0; margin-top: 10px;'>")
            for idx, item in enumerate(section['items'], 1):
                # Use hanging indent for numbered lists
                html_parts.append(f"<div style='color: #555; font-size: 13px; line-height: 1.8; margin-bottom: 10px; padding-left: 24px; text-indent: -24px; text-align: justify;'>{idx}. {item}</div>")
            html_parts.append("</div>")
        
        html_parts.append("</div>")
    
    html_parts.append("</div>")
    return ''.join(html_parts)

# ============================================================================
# 图表数据适配器生成函数
# ============================================================================

def generate_pie_adaptor(options=None):
    """
    生成饼图数据适配器
    
    Args:
        options: {
            'radius': list,       # 半径 ['50%', '70%']
            'rose_type': str,     # 玫瑰图类型 'area' | 'radius'
            'label_position': str # 标签位置 'outside' | 'inside'
        }
    
    Returns:
        JavaScript 适配器代码
    """
    opts = options or {}
    radius = opts.get('radius', ['50%', '70%'])
    rose_type = opts.get('rose_type')
    label_pos = opts.get('label_position', 'outside')
    
    adaptor = f"""
const option = payload.data || {{}};
if (option.series && option.series[0]) {{
    option.series[0].radius = {radius};
    option.series[0].emphasis = {{
        scale: true,
        scaleSize: 10
    }};
    option.series[0].itemStyle = {{
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
    }};
    option.series[0].label = {{
        position: '{label_pos}',
        formatter: '{{b}}: {{c}} ({{d}}%)'
    }};
"""
    if rose_type:
        adaptor += f"    option.series[0].roseType = '{rose_type}';\n"
    
    adaptor += """
}
option.legend = {
    orient: 'horizontal',
    bottom: '0',
    left: 'center',
    icon: 'circle'
};
return { ...payload, data: option };
"""
    return adaptor.strip()

def generate_line_adaptor(smooth=True, show_area=False, stack=False):
    """
    生成折线图适配器
    
    Args:
        smooth: 是否平滑曲线
        show_area: 是否显示面积
        stack: 是否堆叠
    
    Returns:
        JavaScript 适配器代码
    """
    adaptor = f"""
const option = payload.data || {{}};
if (option.series) {{
    option.series.forEach(s => {{
        s.smooth = {str(smooth).lower()};
"""
    if show_area:
        adaptor += "        s.areaStyle = { opacity: 0.3 };\n"
    if stack:
        adaptor += "        s.stack = 'total';\n"
    
    adaptor += """    });
}
option.grid = {
    left: '3%',
    right: '4%',
    bottom: '10%',
    containLabel: true
};
option.tooltip = {
    trigger: 'axis',
    axisPointer: { type: 'cross' }
};
return { ...payload, data: option };
"""
    return adaptor.strip()

def generate_bar_adaptor(options=None):
    """
    生成简单柱状图适配器（二维数据：类别 vs 数值）
    
    Args:
        options: {
            'color': str,           # 柱子颜色
            'border_radius': int,   # 圆角半径
            'show_label': bool,     # 显示数值标签
            'y_axis_name': str      # Y轴名称
        }
    
    Returns:
        JavaScript 适配器代码
    """
    opts = options or {}
    color = opts.get('color', '#5470c6')
    emphasis_color = opts.get('emphasis_color', '#3aa1ff')
    border_radius = opts.get('border_radius', 4)
    show_label = str(opts.get('show_label', False)).lower()
    y_axis_name = opts.get('y_axis_name', '数量')
    
    adaptor = f"""
const option = payload.data || {{}};
if (option.series && option.series[0]) {{
    option.series[0].type = 'bar';
    option.series[0].itemStyle = {{
        borderRadius: [{border_radius}, {border_radius}, 0, 0],
        color: '{color}'
    }};
    option.series[0].emphasis = {{
        itemStyle: {{ color: '{emphasis_color}' }}
    }};
    option.series[0].label = {{
        show: {show_label},
        position: 'top',
        formatter: '{{c}}'
    }};
}}
option.grid = {{
    left: '3%',
    right: '4%',
    bottom: '10%',
    top: '10%',
    containLabel: true
}};
option.tooltip = {{
    trigger: 'axis',
    axisPointer: {{ type: 'shadow' }},
    formatter: '{{b}}: {{c}}'
}};
if (option.yAxis) {{
    option.yAxis.name = '{y_axis_name}';
    option.yAxis.nameTextStyle = {{ padding: [0, 0, 0, 10] }};
}}
return {{ ...payload, data: option }};
"""
    return adaptor.strip()

def generate_radar_adaptor(options=None):
    """
    生成雷达图适配器
    
    Args:
        options: {
            'shape': str,          # 'polygon' | 'circle'
            'split_number': int,   # 分割段数
            'area_opacity': float  # 面积透明度
        }
    
    Returns:
        JavaScript 适配器代码
    """
    opts = options or {}
    shape = opts.get('shape', 'polygon')
    split_num = opts.get('split_number', 5)
    opacity = opts.get('area_opacity', 0.3)
    
    adaptor = f"""
const option = payload.data || {{}};
if (option.series && option.series[0]) {{
    option.series[0].type = 'radar';
    option.series[0].areaStyle = {{ opacity: {opacity} }};
    option.series[0].emphasis = {{
        lineStyle: {{ width: 4 }},
        areaStyle: {{ opacity: 0.5 }}
    }};
}}
if (option.radar) {{
    option.radar.shape = '{shape}';
    option.radar.splitNumber = {split_num};
    option.radar.splitArea = {{
        areaStyle: {{
            color: ['rgba(25, 183, 207, 0.05)', 'rgba(25, 183, 207, 0.1)']
        }}
    }};
}}
option.legend = {{
    bottom: '0',
    left: 'center'
}};
return {{ ...payload, data: option }};
"""
    return adaptor.strip()

def generate_funnel_adaptor(options=None):
    """
    生成漏斗图适配器，自动计算转化率
    
    Args:
        options: {
            'align': str,      # 'left' | 'center' | 'right'
            'sort': str,       # 'ascending' | 'descending'
            'gap': int         # 间距
        }
    
    Returns:
        JavaScript 适配器代码
    """
    opts = options or {}
    align = opts.get('align', 'center')
    sort_type = opts.get('sort', 'descending')
    gap = opts.get('gap', 2)
    
    adaptor = f"""
const option = payload.data || {{}};
if (option.series && option.series[0]) {{
    option.series[0].type = 'funnel';
    option.series[0].left = '{align}';
    option.series[0].sort = '{sort_type}';
    option.series[0].gap = {gap};
    option.series[0].label = {{
        show: true,
        position: 'inside',
        formatter: '{{b}}: {{c}}'
    }};
    
    // 自动计算转化率
    if (option.series[0].data) {{
        for (let i = 0; i < option.series[0].data.length - 1; i++) {{
            const current = option.series[0].data[i].value;
            const next = option.series[0].data[i + 1].value;
            const rate = ((next / current) * 100).toFixed(1);
            option.series[0].data[i].conversion = rate + '%';
        }}
    }}
}}
return {{ ...payload, data: option }};
"""
    return adaptor.strip()

def generate_gauge_adaptor(options=None):
    """
    生成仪表盘适配器
    
    Args:
        options: {
            'min': int,           # 最小值
            'max': int,           # 最大值
            'split_number': int,  # 分割段数
            'unit': str           # 单位
        }
    
    Returns:
        JavaScript 适配器代码
    """
    opts = options or {}
    min_val = opts.get('min', 0)
    max_val = opts.get('max', 100)
    split_num = opts.get('split_number', 10)
    unit = opts.get('unit', '%')
    
    adaptor = f"""
const option = payload.data || {{}};
if (option.series && option.series[0]) {{
    option.series[0].type = 'gauge';
    option.series[0].min = {min_val};
    option.series[0].max = {max_val};
    option.series[0].splitNumber = {split_num};
    option.series[0].progress = {{ show: true, width: 18 }};
    option.series[0].detail = {{
        valueAnimation: true,
        formatter: '{{value}}{unit}',
        fontSize: 30
    }};
    option.series[0].axisLine = {{
        lineStyle: {{ width: 18 }}
    }};
}}
return {{ ...payload, data: option }};
"""
    return adaptor.strip()

# ============================================================================
# 配置验证函数
# ============================================================================

def validate_chart_config(config, required_fields=None):
    """
    验证图表配置完整性
    
    Args:
        config: 配置字典
        required_fields: 必填字段列表
    
    Returns:
        (is_valid, error_message)
    """
    required = required_fields or ['chart_type', 'title']
    
    for field in required:
        if field not in config:
            return False, f"缺少必填字段: {field}"
    
    # 验证图表类型
    valid_types = ['pie', 'line', 'bar', 'radar', 'funnel', 'gauge', 'scatter', 'heatmap']
    if config.get('chart_type') not in valid_types:
        return False, f"不支持的图表类型: {config.get('chart_type')}"
    
    return True, None
