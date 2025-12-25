# 统计指标卡片组件设计文档

## 📊 组件概述

**组件名称**：`stats_cards`  
**组件分类**：展示型组件  
**最后更新**：2025-12-25

统计指标卡片组件用于展示多个关键业务指标，支持静态数据配置和 API 动态加载，广泛应用于数据看板、风险预警、业务监控等场景。

### 核心特征

- 📦 **分组展示**：支持多个指标分组（如风险预警、标准预警等）
- 🎨 **样式区分**：不同组可以有不同的边框颜色/样式
- 📐 **响应式布局**：自动适配列数（通常 3-5 列）
- 🔢 **灵活数据**：支持静态数据和 API 动态加载
- 📈 **趋势指示**：支持显示趋势箭头和变化百分比

---

## 🎯 设计方案

### 组件参数结构

```json
{
  "component_id": "stats_cards",
  "params": {
    "title": "分组标题（可选）",
    "border_color": "red",
    "columns": 4,
    "items": [
      {
        "label": "预测增长率",
        "value": "8.5%",
        "unit": "单位（可选）",
        "sub_label": "副标题（可选）",
        "trend": "up",
        "trend_value": "1.3%",
        "trend_color": "auto"
      }
    ],
    "api_url": "/api/stats",
    "api_method": "post",
    "api_data": {
      "custom_param": "自定义参数"
    },
    "api_headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 否 | 组标题，显示在卡片上方 |
| `border_color` | string | 否 | 边框颜色：red/blue/green/orange/gray |
| `columns` | integer | 否 | 每行显示列数，默认 5 |
| `items` | array | 条件必填 | 静态数据模式的指标列表 |
| `api_url` | string | 条件必填 | API 动态加载地址 |
| `api_method` | string | 否 | API 请求方法，默认 get |
| `api_data` | object | 否 | API 请求参数 |
| `api_headers` | object | 否 | API 请求头 |

#### items 对象结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label` | string | 是 | 指标名称 |
| `value` | string/number | 是 | 指标值 |
| `unit` | string | 否 | 单位 |
| `sub_label` | string | 否 | 副标题 |
| `trend` | string | 否 | 趋势方向：up/down |
| `trend_value` | string | 否 | 趋势变化值，如 1.3% |
| `trend_color` | string | 否 | 趋势颜色：auto/red/green，默认 auto |

---

## 🛠️ 技术实现

### 1. 数据库 Schema

```sql
INSERT INTO sys_component_library (
  component_id,
  component_name,
  description,
  template_path,
  params_schema,
  default_params,
  category,
  is_active
) VALUES (
  'stats_cards',
  '统计指标卡片',
  '展示多个关键业务指标，支持静态数据或API动态加载，支持趋势箭头显示',
  'server/templates/stats_cards.j2',
  '{
    "type": "object",
    "properties": {
      "title": {"type": "string", "description": "组标题"},
      "border_color": {
        "type": "string",
        "enum": ["red", "blue", "green", "orange", "gray"],
        "description": "边框颜色"
      },
      "columns": {"type": "integer", "default": 5},
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "label": {"type": "string"},
            "value": {"type": ["string", "number"]},
            "unit": {"type": "string"},
            "sub_label": {"type": "string"},
            "trend": {"type": "string", "enum": ["up", "down"]},
            "trend_value": {"type": "string"},
            "trend_color": {"type": "string", "enum": ["red", "green", "auto"], "default": "auto"}
          },
          "required": ["label", "value"]
        }
      },
      "api_url": {"type": "string"},
      "api_method": {"type": "string", "enum": ["get", "post"], "default": "get"},
      "api_data": {"type": "object"},
      "api_headers": {"type": "object"}
    }
  }',
  '{"columns": 5, "border_color": "gray"}',
  'display',
  1
);
```

### 2. Jinja2 模板

**文件路径**：`server/templates/stats_cards.j2`

```jinja2
{# 统计指标卡片组件 #}
{
  "type": "container",
  {% if title %}
  "className": "m-b-sm",
  "body": [
    {
      "type": "html",
      "html": "<h4 style='margin-bottom: 10px;'>{{ title }}</h4>"
    },
    {{ self.stats_grid() }}
  ]
  {% else %}
  "body": [{{ self.stats_grid() }}]
  {% endif %}
}

{% macro stats_grid() %}
{
  "type": "grid",
  "className": "stats-cards-grid {% if border_color %}border-{{ border_color }}{% endif %}",
  "columns": {{ columns or 5 }},
  "gap": "sm",
  {% if api_url %}
  "api": {
    "method": "{{ api_method or 'get' }}",
    "url": "{{ api_url }}"
    {% if api_data %}
    ,"data": {{ api_data | tojson }}
    {% endif %}
    {% if api_headers %}
    ,"headers": {{ api_headers | tojson }}
    {% endif %}
  },
  {% endif %}
  "items": [
    {% if items %}
      {% for item in items %}
      {
        "type": "container",
        "className": "stat-card",
        "body": [
          {
            "type": "tpl",
            "tpl": "<div class='stat-label'>{{ item.label }}</div>",
            "inline": false
          },
          {
            "type": "tpl",
            "tpl": "<div class='stat-value'>{{ item.value }}{% if item.unit %}<span class='stat-unit'>{{ item.unit }}</span>{% endif %}</div>",
            "inline": false
          }
          {% if item.trend %}
          ,{
            "type": "tpl",
            "tpl": "<div class='stat-trend {% if item.trend_color == 'auto' %}trend-{{ item.trend }}{% else %}trend-{{ item.trend_color }}{% endif %}'>{% if item.trend == 'up' %}↑{% else %}↓{% endif %} {{ item.trend_value }}</div>",
            "inline": false
          }
          {% endif %}
          {% if item.sub_label %}
          ,{
            "type": "tpl",
            "tpl": "<div class='stat-sublabel'>{{ item.sub_label }}</div>",
            "inline": false
          }
          {% endif %}
        ]
      }{% if not loop.last %},{% endif %}
      {% endfor %}
    {% endif %}
  ]
}
{% endmacro %}
```

### 3. CSS 样式

**文件路径**：`client/src/index.css`

```css
/* 统计指标卡片样式 */
.stats-cards-grid {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
}

.stats-cards-grid.border-red {
  border: 2px solid #dc3545;
  background: #fff5f5;
}

.stats-cards-grid.border-blue {
  border: 2px solid #007bff;
  background: #f0f8ff;
}

.stats-cards-grid.border-orange {
  border: 2px solid #fd7e14;
}

.stats-cards-grid.border-green {
  border: 2px solid #28a745;
}

.stat-card {
  padding: 15px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  text-align: center;
  transition: box-shadow 0.2s;
}

.stat-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.stat-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.4;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
  line-height: 1.2;
}

.stat-unit {
  font-size: 14px;
  font-weight: normal;
  margin-left: 4px;
}

.stat-sublabel {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.stat-trend {
  font-size: 13px;
  font-weight: 500;
  margin-top: 6px;
  display: inline-block;
}

.stat-trend.trend-up {
  color: #dc3545;  /* 上升=红色（风险警示） */
}

.stat-trend.trend-down {
  color: #28a745;  /* 下降=绿色（改善） */
}

.stat-trend.trend-red {
  color: #dc3545;
}

.stat-trend.trend-green {
  color: #28a745;
}
```

---

## 📝 使用示例

### 示例 1：静态数据 + 趋势箭头

```json
{
  "component_id": "stats_cards",
  "params": {
    "title": "缴存增长系统概览",
    "border_color": "red",
    "columns": 4,
    "items": [
      { 
        "label": "预测增长率完年(%)", 
        "value": "8.5%",
        "trend": "up",
        "trend_value": "1.3%"
      },
      { 
        "label": "预测增长率完总占比", 
        "value": "46.8%",
        "trend": "up",
        "trend_value": "1.6%"
      },
      { 
        "label": "预测增长率完总占比", 
        "value": "20.1%",
        "trend": "up",
        "trend_value": "1.4%"
      },
      { 
        "label": "风险等级", 
        "value": "低风险"
      }
    ]
  }
}
```

### 示例 2：API 动态加载（POST + 自定义参数）

```json
{
  "component_id": "stats_cards",
  "params": {
    "title": "实时业务指标",
    "columns": 4,
    "border_color": "blue",
    "api_url": "/HFB/common/dmx_risk/management=stats_overview.service",
    "api_method": "post",
    "api_data": {
      "cxlx": {
        "moduleKey": "fxgl",
        "ywflKey": "jcdjfx"
      },
      "jgbh": "1305282025",
      "date_range": "2025-01"
    },
    "api_headers": {
      "Authorization": "Bearer ${token}"
    }
  }
}
```

**API 返回格式**：
```json
{
  "status": 0,
  "data": {
    "items": [
      { 
        "label": "连续缴存6个月", 
        "value": "12000",
        "trend": "up",
        "trend_value": "5.2%"
      },
      { 
        "label": "还款能力", 
        "value": "月收入大于月息存金额的2倍" 
      }
    ]
  }
}
```

### 示例 3：多组指标组合

```json
{
  "components": [
    {
      "component_id": "stats_cards",
      "params": {
        "title": "风险预警指标",
        "border_color": "red",
        "columns": 5,
        "items": [...]
      }
    },
    {
      "component_id": "stats_cards",
      "params": {
        "title": "标准预警指标",
        "columns": 5,
        "items": [...]
      }
    },
    {
      "component_id": "stats_cards",
      "params": {
        "title": "租赁住房提取",
        "columns": 2,
        "items": [...]
      }
    }
  ]
}
```

---

## 🎨 样式变体

### 边框颜色

- `border-red`：红色边框，适用于风险预警
- `border-blue`：蓝色边框，适用于常规信息
- `border-green`：绿色边框，适用于正向指标
- `border-orange`：橙色边框，适用于警告信息
- `border-gray`：灰色边框，默认样式

### 趋势颜色规则

- **auto 模式**（默认）：
  - `up` → 红色（风险上升）
  - `down` → 绿色（风险下降）
  
- **手动指定**：
  - `trend_color: "red"` → 红色
  - `trend_color: "green"` → 绿色

---

## ✅ 组件优势

| 特性 | 说明 |
|------|------|
| ✅ 高复用性 | 一个组件支持所有指标卡片场景 |
| ✅ 灵活布局 | 支持自定义列数（3-5列） |
| ✅ 样式丰富 | 多种边框颜色区分不同类型 |
| ✅ 动静结合 | 既支持静态数据也支持 API |
| ✅ 趋势展示 | 内置趋势箭头和变化值 |
| ✅ AI 友好 | 参数清晰易于 AI 生成配置 |
| ✅ POST 支持 | 完整支持 POST 请求和自定义参数 |

---

## 📋 API 接口规范

### 请求要求

- **Method**: GET 或 POST
- **Headers**: 可选，通过 `api_headers` 配置
- **Data**: 可选，通过 `api_data` 配置

### 响应格式

```json
{
  "status": 0,
  "msg": "success",
  "data": {
    "items": [
      {
        "label": "指标名称",
        "value": "数值",
        "unit": "单位（可选）",
        "trend": "up|down（可选）",
        "trend_value": "变化值（可选）",
        "sub_label": "副标题（可选）"
      }
    ]
  }
}
```

### 字段要求

- ✅ **必须字段**：`items`数组，每个 item 包含 `label` 和 `value`
- ✅ **可选字段**：`unit`, `trend`, `trend_value`, `trend_color`, `sub_label`
- ✅ **状态码**：`status: 0` 表示成功

---

## 🚀 实施步骤

1. ✅ **数据库配置**：执行 SQL 插入组件定义
2. ✅ **创建模板**：创建 `server/templates/stats_cards.j2`
3. ✅ **添加样式**：将 CSS 添加到 `client/src/index.css`
4. ✅ **重启服务**：重启后端服务使组件生效
5. ✅ **MCP 测试**：通过 MCP Inspector 测试组件
6. ✅ **页面集成**：在实际页面中使用组件

---

## 📞 相关文档

- [MCP 组件开发指南](./MCP_COMPONENT_GUIDE.md)
- [AMIS 官方文档](https://aisuda.bce.baidu.com/amis/zh-CN/docs/index)
- [Jinja2 模板文档](https://jinja.palletsprojects.com/)
