# AMIS 图表组件对照表

## 📊 组件速查表

| 组件名称 | 文件名 | 图表类型 | 主要用途 | 关键特性 | 状态 |
|---------|--------|---------|---------|---------|------|
| **饼图** | `chart_panel.j2` | Pie Chart | 占比分析、分类统计 | 环形饼图、点击详情、自定义半径 | ✅ 已有 |
| **柱状图** | `bar_chart_panel.j2` | Bar Chart | 趋势对比、排名展示 | 时序对比、多系列、点击钻取 | ✅ 已有 |
| **折线图** | `line_chart_panel.j2` | Line Chart | 时序分析、趋势预测 | 平滑曲线、面积填充、数据导出 | 🆕 新增 |
| **雷达图** | `radar_chart_panel.j2` | Radar Chart | 多维评估、能力矩阵 | 多边形/圆形、详细分析、建议 | 🆕 新增 |
| **漏斗图** | `funnel_chart_panel.j2` | Funnel Chart | 转化分析、流程监控 | 自动计算转化率、流失分析 | 🆕 新增 |
| **仪表盘** | `gauge_chart_panel.j2` | Gauge Chart | KPI监控、完成度 | 动画效果、颜色分段、目标对比 | 🆕 新增 |

---

## 🎯 应用场景匹配

### 1. 数据分布分析
**推荐组件**: 饼图 (Pie Chart)

**典型场景**:
- 风险等级分布
- 客户类型占比
- 业务板块构成
- 地域分布统计

**配置示例**:
```json
{
    "api_url": "/api/distribution",
    "height": 380,
    "radius": ["50%", "70%"]
}
```

---

### 2. 趋势对比分析
**推荐组件**: 折线图 (Line Chart) 或 柱状图 (Bar Chart)

**典型场景**:
- 月度业绩趋势
- 年度同比分析
- 用户增长曲线
- 成本变化趋势

**配置示例**:
```json
{
    "line_api_url": "/api/trend",
    "line_smooth": true,
    "line_show_area": true
}
```

---

### 3. 多维度评估
**推荐组件**: 雷达图 (Radar Chart)

**典型场景**:
- 员工能力评估
- 产品竞争力分析
- 客户满意度调查
- 风险多维分析

**配置示例**:
```json
{
    "radar_api_url": "/api/evaluation",
    "radar_shape": "polygon",
    "radar_split_number": 5
}
```

---

### 4. 转化流程分析
**推荐组件**: 漏斗图 (Funnel Chart)

**典型场景**:
- 销售漏斗
- 用户注册流程
- 审批流程监控
- 营销转化路径

**配置示例**:
```json
{
    "funnel_api_url": "/api/conversion",
    "funnel_align": "center",
    "funnel_clickable": true
}
```

---

### 5. KPI 监控
**推荐组件**: 仪表盘 (Gauge Chart)

**典型场景**:
- 目标完成率
- 系统负载监控
- 任务达成度
- 质量评分

**配置示例**:
```json
{
    "gauge_api_url": "/api/kpi",
    "gauge_min": 0,
    "gauge_max": 100,
    "gauge_unit_suffix": "%"
}
```

---

## 📋 配置参数对照

### 通用参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|------|--------|------|
| `api_url` / `*_api_url` | string | ✅ | - | 数据接口地址 |
| `height` / `*_height` | number | ❌ | 400 | 图表高度（px） |
| `clickable` / `*_clickable` | boolean | ❌ | true | 是否可点击 |
| `title` | string | ✅ | - | 图表标题 |
| `subtitle` | string | ❌ | - | 副标题 |

### 饼图专用参数

| 参数名 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `radius` | array | ['50%', '70%'] | 内外半径 |
| `rose_type` | string | null | 玫瑰图类型 |

### 折线图专用参数

| 参数名 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `line_smooth` | boolean | true | 平滑曲线 |
| `line_show_area` | boolean | false | 显示面积 |
| `line_detail_api` | string | - | 详情接口 |

### 雷达图专用参数

| 参数名 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `radar_shape` | string | 'polygon' | 形状 |
| `radar_opacity` | number | 0.3 | 透明度 |
| `radar_split_number` | number | 5 | 分割段数 |

### 漏斗图专用参数

| 参数名 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `funnel_align` | string | 'center' | 对齐方式 |
| `funnel_sort` | string | 'descending' | 排序方式 |
| `funnel_gap` | number | 2 | 间距 |

### 仪表盘专用参数

| 参数名 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `gauge_min` | number | 0 | 最小值 |
| `gauge_max` | number | 100 | 最大值 |
| `gauge_unit_suffix` | string | '%' | 单位后缀 |
| `gauge_radius` | string | '75%' | 半径 |

---

## 🔌 数据接口规范

### 1. 饼图数据格式

**请求**:
```
GET /api/distribution
```

**响应**:
```json
{
    "status": 0,
    "data": {
        "title": { "text": "数据分布" },
        "series": [{
            "type": "pie",
            "data": [
                { "name": "类别A", "value": 100, "itemId": "a" },
                { "name": "类别B", "value": 200, "itemId": "b" }
            ]
        }]
    }
}
```

---

### 2. 折线图数据格式

**请求**:
```
GET /api/trend
```

**响应**:
```json
{
    "status": 0,
    "data": {
        "xAxis": {
            "data": ["1月", "2月", "3月"]
        },
        "series": [
            {
                "name": "今年",
                "type": "line",
                "data": [120, 200, 150]
            },
            {
                "name": "去年",
                "type": "line",
                "data": [100, 180, 130]
            }
        ]
    }
}
```

---

### 3. 雷达图数据格式

**请求**:
```
GET /api/evaluation
```

**响应**:
```json
{
    "status": 0,
    "data": {
        "radar": {
            "indicator": [
                { "name": "维度1", "max": 100 },
                { "name": "维度2", "max": 100 },
                { "name": "维度3", "max": 100 }
            ]
        },
        "series": [{
            "type": "radar",
            "data": [
                {
                    "name": "对象A",
                    "value": [80, 90, 70]
                }
            ]
        }]
    }
}
```

---

### 4. 漏斗图数据格式

**请求**:
```
GET /api/conversion
```

**响应**:
```json
{
    "status": 0,
    "data": {
        "series": [{
            "type": "funnel",
            "data": [
                { "name": "阶段1", "value": 1000, "stageId": "1" },
                { "name": "阶段2", "value": 800, "stageId": "2" },
                { "name": "阶段3", "value": 600, "stageId": "3" }
            ]
        }]
    }
}
```

---

### 5. 仪表盘数据格式

**请求**:
```
GET /api/kpi
```

**响应**:
```json
{
    "status": 0,
    "data": {
        "series": [{
            "type": "gauge",
            "data": [
                {
                    "value": 85,
                    "name": "完成率"
                }
            ]
        }]
    }
}
```

---

## 🎨 颜色方案速查

| 方案名 | 适用场景 | 主色调 | 颜色示例 |
|-------|---------|--------|---------|
| `default` | 通用场景 | 蓝绿橙 | #5470c6, #91cc75, #fac858 |
| `business` | 商务报表 | 蓝绿黄 | #2f54eb, #52c41a, #faad14 |
| `soft` | 轻量展示 | 柔和色 | #b7eb8f, #87e8de, #ffd591 |
| `contrast` | 强调对比 | 高对比 | #000000, #ff0000, #00ff00 |
| `monochrome` | 黑白灰 | 单色 | #262626, #8c8c8c, #d9d9d9 |
| `warm` | 活力风格 | 暖色调 | #ff6b6b, #feca57, #ff9ff3 |
| `cool` | 科技风格 | 冷色调 | #48dbfb, #0abde3, #10ac84 |
| `nature` | 清新风格 | 自然色 | #6ab04c, #badc58, #f9ca24 |

---

## 🚀 快速开始

### 1. 选择合适的组件

根据您的需求在上表中选择对应的组件。

### 2. 复制配置模板

```bash
# 以折线图为例
cp configs/line_chart_example.json configs/my_chart.json
```

### 3. 修改配置参数

根据参数对照表修改配置文件。

### 4. 创建页面模板

参考 `templates/pages/chart_demo.j2` 创建您的页面。

### 5. 生成并部署

```bash
python3 build_schema.py
```

---

## 📞 获取帮助

- 📖 [快速入门指南](file:///Users/xiaochen/Downloads/damoxing/schema-builder/QUICKSTART.md)
- 📋 [实施规划文档](file:///Users/xiaochen/.gemini/antigravity/brain/a96842a1-3cbf-4d81-8909-b0268b305415/implementation_plan.md)
- 🎯 [完成总结](file:///Users/xiaochen/.gemini/antigravity/brain/a96842a1-3cbf-4d81-8909-b0268b305415/walkthrough.md)

---

**更新时间**: 2025-12-15  
**版本**: v1.0
