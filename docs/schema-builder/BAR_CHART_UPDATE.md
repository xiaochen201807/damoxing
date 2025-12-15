# 柱状图组件简化更新说明

## 📊 更新概述

根据需求，已将柱状图组件从**支持多系列三维数据**（如：月份 vs 高中低风险）简化为**只支持二维数据**（如：月份 vs 客户数量）。

**更新时间**: 2025-12-15

---

## ✅ 修改内容

### 1. 模板组件修改

**文件**: [`bar_chart_panel.j2`](file:///Users/xiaochen/Downloads/damoxing/schema-builder/templates/components/bar_chart_panel.j2)

#### 主要变更：

- ❌ **移除**: 多系列支持（高风险/中风险/低风险）
- ❌ **移除**: 系列名称映射逻辑
- ✅ **新增**: 单系列数据支持
- ✅ **新增**: 可自定义柱子颜色、圆角、标签
- ✅ **新增**: 数据导出按钮
- ✅ **优化**: 简化的点击事件处理

#### 新增配置参数：

```jinja2
{
    "bar_api_url": "/api/customer/monthly-count",  # 数据接口
    "bar_method": "get",                            # 请求方法
    "bar_height": 350,                              # 图表高度
    "bar_clickable": true,                          # 是否可点击
    "bar_detail_api": "/api/customer/detail",       # 详情接口
    
    # 样式配置
    "bar_color": "#5470c6",                         # 柱子颜色
    "bar_emphasis_color": "#3aa1ff",                # 高亮颜色
    "bar_border_radius": 4,                         # 圆角半径
    "bar_show_label": false,                        # 显示数值标签
    "bar_x_rotate": 0,                              # X轴标签旋转角度
    "bar_y_axis_name": "客户数"                     # Y轴名称
}
```

---

### 2. 辅助函数更新

**文件**: [`template_helpers.py`](file:///Users/xiaochen/Downloads/damoxing/schema-builder/template_helpers.py)

#### 修改的函数：

**旧版本** (已废弃):
```python
def generate_bar_adaptor(horizontal=False, stack=False, label_inside=False):
    # 支持水平、堆叠等三维特性
```

**新版本** (当前):
```python
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
    """
```

#### 使用示例：

```python
from template_helpers import generate_bar_adaptor

# 生成适配器
adaptor = generate_bar_adaptor({
    'color': '#5470c6',
    'border_radius': 4,
    'show_label': False,
    'y_axis_name': '客户数'
})
```

---

### 3. 配置示例文件

**新增文件**: [`bar_chart_example.json`](file:///Users/xiaochen/Downloads/damoxing/schema-builder/configs/bar_chart_example.json)

展示了如何配置一个简单的月度客户统计柱状图。

**配置内容**:
- 标题：月度客户数量统计
- API：`/api/customer/monthly-count`
- 样式：蓝色柱子，圆角边框
- 交互：点击查看详情，支持导出

---

### 4. 测试脚本

**新增文件**: [`test_bar_chart.py`](file:///Users/xiaochen/Downloads/damoxing/schema-builder/test_bar_chart.py)

用于快速验证柱状图配置是否正确。

**运行方式**:
```bash
cd /Users/xiaochen/Downloads/damoxing/schema-builder
python3 test_bar_chart.py
```

---

## 📋 数据格式规范

### 后端 API 响应格式

```json
{
    "status": 0,
    "data": {
        "xAxis": {
            "type": "category",
            "data": ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
        },
        "yAxis": {
            "type": "value"
        },
        "series": [{
            "name": "客户数",
            "type": "bar",
            "data": [120, 200, 150, 180, 220, 190, 160, 140, 210, 230, 195, 175]
        }]
    }
}
```

### 关键字段说明：

- **xAxis.data**: 类别数组（如月份、产品名称等）
- **series[0].data**: 对应的数值数组
- **series**: 只包含一个元素（单系列）

---

## 🎨 样式定制

### 修改柱子颜色

在配置文件中设置：
```json
{
    "bar_color": "#FF6B6B",           // 柱子颜色
    "bar_emphasis_color": "#FF4949"   // 鼠标悬停颜色
}
```

### 显示数值标签

```json
{
    "bar_show_label": true  // 在柱子顶部显示数值
}
```

### 旋转X轴标签

当类别名称过长时：
```json
{
    "bar_x_rotate": 45  // 旋转45度
}
```

---

## 🔄 迁移指南

### 从旧版柱状图迁移

**旧版代码** (多系列):
```json
{
    "bar_api_url": "/api/demo/chart/risk-bar",
    "bar_height": 350
}
```

**新版代码** (单系列):
```json
{
    "bar_api_url": "/api/customer/monthly-count",
    "bar_height": 350,
    "bar_color": "#5470c6",
    "bar_y_axis_name": "客户数"
}
```

### API 接口调整

**旧版 API** 返回多系列数据：
```json
{
    "series": [
        {"name": "高风险", "data": [...]},
        {"name": "中风险", "data": [...]},
        {"name": "低风险", "data": [...]}
    ]
}
```

**新版 API** 只返回单系列：
```json
{
    "series": [{
        "name": "客户数",
        "data": [120, 200, 150, ...]
    }]
}
```

---

## ✨ 新功能

### 1. 数据导出

点击柱子弹窗中新增"导出数据"按钮：
- 自动调用 `/api/export/bar-data?category=${类别名}`
- 支持导出当前类别的详细数据

### 2. 详情列表优化

- 使用 `crud` 组件替代 `table`
- 支持分页（10/20/50条每页）
- 更友好的操作按钮

### 3. 灵活的样式配置

所有样式参数都可通过配置文件定制，无需修改模板代码。

---

## 🚀 快速开始

### 步骤 1: 复制配置

```bash
cp configs/bar_chart_example.json configs/my_bar_chart.json
```

### 步骤 2: 修改配置

编辑 `my_bar_chart.json`，修改API地址和标题等：

```json
{
    "title": "我的数据统计",
    "bar_api_url": "/api/my-data",
    "bar_y_axis_name": "数量"
}
```

### 步骤 3: 在页面中使用

在页面模板中引用：

```jinja2
{
    "type": "panel",
    "body": {% include 'components/bar_chart_panel.j2' %}
}
```

### 步骤 4: 准备后端数据

确保后端 API 返回正确格式的数据（参考上方数据格式规范）。

---

## 📝 示例应用

### 示例 1: 月度销售统计

```json
{
    "title": "2024年月度销售额",
    "subtitle": "单位：万元",
    "bar_api_url": "/api/sales/monthly",
    "bar_color": "#52c41a",
    "bar_y_axis_name": "销售额",
    "bar_show_label": true
}
```

### 示例 2: 产品销量排行

```json
{
    "title": "Top 10 产品销量",
    "bar_api_url": "/api/products/top10",
    "bar_color": "#1890ff",
    "bar_y_axis_name": "销量",
    "bar_height": 400
}
```

### 示例 3: 部门人员统计

```json
{
    "title": "各部门人员分布",
    "bar_api_url": "/api/departments/headcount",
    "bar_color": "#722ed1",
    "bar_y_axis_name": "人数",
    "bar_x_rotate": 30
}
```

---

## ⚠️ 注意事项

### 1. 数据格式

- ✅ 只支持单系列数据（二维）
- ❌ 不再支持多系列数据（三维）

### 2. 兼容性

- 旧版使用多系列的页面需要调整
- 后端 API 需要修改为单系列格式

### 3. 建议

- 如需对比多个指标，使用多个柱状图或改用折线图
- 复杂的分类对比可以使用分组展示

---

## 📞 相关文档

- [快速入门指南](file:///Users/xiaochen/Downloads/damoxing/schema-builder/QUICKSTART.md)
- [组件参考手册](file:///Users/xiaochen/Downloads/damoxing/schema-builder/COMPONENT_REFERENCE.md)
- [完整实施规划](file:///Users/xiaochen/.gemini/antigravity/brain/a96842a1-3cbf-4d81-8909-b0268b305415/implementation_plan.md)

---

## 🎉 总结

✅ **完成的修改**:
1. 简化柱状图组件为二维数据支持
2. 更新辅助函数以匹配新需求
3. 创建配置示例和测试脚本
4. 优化交互体验（导出、分页等）

✅ **优点**:
- 更简洁的配置
- 更清晰的数据结构
- 更好的性能
- 更容易维护

🚀 **下一步**: 
- 测试现有页面的兼容性
- 更新相关 API 接口
- 享受更简单的图表开发体验！

---

**更新者**: AI助手  
**版本**: v2.0  
**日期**: 2025-12-15
