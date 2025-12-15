# AMIS 图表模板快速入门指南

## 🎯 5分钟快速上手

### 1. 环境准备

```bash
cd /Users/xiaochen/Downloads/damoxing/schema-builder

# 激活虚拟环境（如果还没有）
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 创建你的第一个图表

#### 步骤 1: 选择图表类型

当前支持的图表类型：

| 图表类型 | 组件文件 | 适用场景 |
|---------|---------|---------|
| 饼图 | `chart_panel.j2` | 占比分析、分类统计 |
| 柱状图 | `bar_chart_panel.j2` | 趋势对比、排名展示 |
| 折线图 | `line_chart_panel.j2` | 时序分析、趋势预测 |
| 雷达图 | `radar_chart_panel.j2` | 多维评估、能力矩阵 |
| 漏斗图 | `funnel_chart_panel.j2` | 转化分析、流程监控 |
| 仪表盘 | `gauge_chart_panel.j2` | KPI监控、完成度 |

#### 步骤 2: 复制配置模板

```bash
# 以折线图为例
cp configs/line_chart_example.json configs/my_chart.json
```

#### 步骤 3: 修改配置

编辑 `configs/my_chart.json`:

```json
{
    "chart_type": "line",
    "title": "我的业务数据",
    "subtitle": "2024年度统计",
    
    "line_api_url": "/api/my-data/trend",
    "line_height": 400,
    "line_smooth": true,
    "line_show_area": false,
    
    "sections": [
        {
            "label": "数据分析",
            "color": "#0050b3",
            "content": "这里填写你的分析文字..."
        }
    ]
}
```

#### 步骤 4: 创建页面模板

创建 `templates/pages/my_page.j2`:

```jinja2
{% import 'base/colors.j2' as theme %}
{
    "type": "page",
    {% include 'components/header.j2' %},
    "body": [
        {
            "type": "panel",
            "title": "数据展示",
            "bodyClassName": "p-4",
            "body": {
                "type": "grid",
                "columns": [
                    {
                        "md": 8,
                        "body": [{% include 'components/line_chart_panel.j2' %}]
                    },
                    {
                        "md": 4,
                        "body": {% include 'components/text_section.j2' %}
                    }
                ]
            }
        }
    ]
}
```

#### 步骤 5: 生成 Schema

修改 `build_schema.py`:

```python
if __name__ == '__main__':
    # 构建你的页面
    build_schema(
        template_name='my_page.j2',
        config_file='configs/my_chart.json',
        output_file='output/my_page_schema.json'
    )
```

运行构建：

```bash
python3 build_schema.py
```

#### 步骤 6: 部署到数据库

```bash
cd ../server

# 更新数据库
sqlite3 database.sqlite "UPDATE sys_page_template 
SET schema_json = readfile('../schema-builder/output/my_page_schema.json') 
WHERE page_key = 'my_page' AND is_active = 1;"
```

---

## 📊 常用场景示例

### 场景 1: 简单饼图

**需求**: 展示风险分布

**配置文件** (`pie_simple.json`):
```json
{
    "chart_type": "pie",
    "title": "风险分布",
    "api_url": "/api/risk/distribution",
    "height": 400
}
```

**模板文件** (`pie_page.j2`):
```jinja2
{% import 'base/colors.j2' as theme %}
{
    "type": "page",
    "title": "{{ title }}",
    "body": [{% include 'components/chart_panel.j2' %}]
}
```

### 场景 2: 趋势对比（折线图）

**需求**: 对比今年与去年数据

**配置文件** (`trend_compare.json`):
```json
{
    "chart_type": "line",
    "title": "年度对比",
    "line_api_url": "/api/trend/yearly",
    "line_smooth": true,
    "line_show_area": true
}
```

### 场景 3: 转化漏斗

**需求**: 销售流程分析

**配置文件** (`sales_funnel.json`):
```json
{
    "chart_type": "funnel",
    "title": "销售漏斗",
    "funnel_api_url": "/api/sales/funnel",
    "funnel_height": 450,
    "funnel_clickable": true
}
```

---

## 🎨 自定义主题

### 方法 1: 修改颜色配置

编辑 `templates/base/colors.j2`:

```jinja2
{% set colors = {
    'title': '#1d1d1f',
    'subtitle': '#86868b',
    'chart_colors': ['#FF6B6B', '#4ECDC4', '#45B7D1']  # 自定义配色
} %}
```

### 方法 2: 使用预设方案

在配置中指定：

```json
{
    "color_scheme": "business",  // 商务配色
    "chart_type": "bar"
}
```

可用方案: `default`, `business`, `soft`, `warm`, `cool`, `nature`

---

## 🔧 高级技巧

### 技巧 1: 使用 Python 生成适配器

在 `build_schema.py` 中:

```python
from template_helpers import generate_line_adaptor

config['line_adaptor'] = generate_line_adaptor(
    smooth=True,
    show_area=True,
    stack=False
)
```

### 技巧 2: 多图表组合

**配置文件** (`dashboard.json`):
```json
{
    "charts": {
        "pie": {
            "api_url": "/api/pie",
            "height": 300
        },
        "line": {
            "line_api_url": "/api/line",
            "line_height": 300
        }
    }
}
```

**模板文件** (`dashboard.j2`):
```jinja2
{
    "type": "grid",
    "columns": [
        {"md": 6, "body": [{% include 'components/chart_panel.j2' %}]},
        {"md": 6, "body": [{% include 'components/line_chart_panel.j2' %}]}
    ]
}
```

### 技巧 3: 动态数据更新

在图表 API 中返回:

```json
{
    "status": 0,
    "data": {
        "title": { "text": "动态标题" },
        "series": [{
            "data": [
                {"name": "类别A", "value": 100},
                {"name": "类别B", "value": 200}
            ]
        }]
    }
}
```

---

## ❓ 常见问题

### Q1: 图表不显示怎么办？

**检查清单**:
1. ✅ API 地址是否正确
2. ✅ 数据格式是否符合 ECharts 规范
3. ✅ 浏览器控制台是否有错误
4. ✅ 后端接口是否返回正确数据

### Q2: 如何调试图表配置？

**方法**:
```javascript
// 在 adaptor 中添加调试代码
"adaptor": "console.log('Chart Data:', payload); return payload;"
```

### Q3: 点击事件不生效？

**检查**:
1. `clickable` 是否设置为 `true`
2. `click_action` 配置是否正确
3. Dialog 中的 API 是否可访问

### Q4: 如何自定义颜色？

**方法 1 - 全局配置**:
```python
# build_schema.py
config['chart_colors'] = ['#FF6B6B', '#4ECDC4', '#45B7D1']
```

**方法 2 - 适配器**:
```javascript
"adaptor": "payload.data.color = ['#FF6B6B', '#4ECDC4']; return payload;"
```

---

## 📚 下一步学习

1. **深入了解 AMIS**: [官方文档](https://aisuda.bce.baidu.com/amis)
2. **学习 ECharts**: [配置手册](https://echarts.apache.org/zh/option.html)
3. **Jinja2 语法**: [模板指南](https://jinja.palletsprojects.com/)
4. **查看示例**: 浏览 `configs/` 目录下的配置文件

---

## 🎉 成功案例

完成快速入门后，你应该能够：

- ✅ 创建并配置基础图表
- ✅ 自定义图表样式和颜色
- ✅ 实现图表点击交互
- ✅ 组合多个图表形成仪表板
- ✅ 将生成的 Schema 部署到系统

**下一步**: 尝试创建一个包含3种不同图表的综合仪表板！

---

**需要帮助？** 查看详细文档或联系技术支持团队
