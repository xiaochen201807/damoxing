# MCP 组件配置使用说明

本文档详细说明如何通过 MCP 的 `generate_page_schema` 工具配置页面组件。

---

## 目录

1. [快速开始](#快速开始)
2. [组件列表](#组件列表)
3. [chart_with_ai 图表组件](#chart_with_ai-图表组件)
4. [alert 提示框组件](#alert-提示框组件)
5. [ai_form AI提问表单组件](#ai_form-ai提问表单组件)
6. [标签页布局 (tabs)](#标签页布局-tabs)
7. [完整示例](#完整示例)

---

## 快速开始

### 调用方式

通过 MCP JSON-RPC 2.0 协议调用 `generate_page_schema` 工具：

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "generate_page_schema",
    "arguments": {
      "title": "页面标题",
      "layout": "simple",
      "components": [...]
    }
  },
  "id": 1
}
```

### 两种模式

| 模式 | 参数 | 说明 |
|------|------|------|
| 单页模式 | `components` | 所有组件垂直堆叠显示 |
| 标签页模式 | `tabs` | 组件按标签分组显示 |

---

## 组件列表

| component_id | 组件名称 | 说明 |
|--------------|----------|------|
| `chart_with_ai` | 通用图表(带AI分析) | 支持6种图表类型，带钻取和AI分析 |
| `alert` | 提示框/告警 | 页面提示信息展示 |
| `ai_form` | AI提问表单 | 向AI发送分析请求并动态加载结果 |

---

## chart_with_ai 图表组件

### 支持的图表类型

| chart_type | 类型名称 | 适用场景 |
|------------|----------|----------|
| `pie` | 饼图 | 占比分布、分类统计 |
| `bar` | 柱状图 | 类别对比、月度统计 |
| `line` | 折线图 | 趋势变化、时间序列 |
| `funnel` | 漏斗图 | 流程转化、销售漏斗 |
| `radar` | 雷达图 | 多维对比、能力评估 |
| `gauge` | 仪表盘 | 指标完成度、单值展示 |

### 参数说明

#### 基础参数（必填）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `chart_type` | string | ✅ | 图表类型：pie/bar/line/funnel/radar/gauge |
| `api_url` | string | ✅ | 图表数据 API 地址 |

#### 基础参数（可选）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | string | - | 图表标题 |
| `api_method` | string | `"get"` | API 请求方法：get/post |
| `api_data` | object | - | POST 请求时的请求体参数 |
| `height` | number | `400` | 图表高度（像素） |

#### 钻取功能参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enable_drilldown` | boolean | `true` | 是否启用钻取 |
| `drilldown_api` | string | - | 钻取详情 API 地址 |
| `drilldown_method` | string | `"get"` | 钻取 API 请求方法 |
| `drilldown_data` | object | - | 钻取 API POST 请求时的基础参数 |
| `drilldown_columns` | array | - | 钻取表格列定义 |

#### AI 分析参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `ai_analysis_text` | string | AI 生成的风险分析文本 |
| `ai_suggestions` | string | AI 生成的规避建议（支持 `\n` 换行） |

---

### 饼图示例 (pie)

```json
{
  "component_id": "chart_with_ai",
  "params": {
    "chart_type": "pie",
    "title": "风险等级分布",
    "api_url": "/api/demo/chart/risk-pie-post",
    "api_method": "post",
    "api_data": { "chart_id": "risk_pie_001" },
    "height": 400,
    "drilldown_api": "/api/demo/risk-list-post",
    "drilldown_method": "post",
    "ai_analysis_text": "高风险客户占比23%，需重点关注。",
    "ai_suggestions": "1. 实施每日监控\n2. 启动专项催收"
  }
}
```

---

### 柱状图示例 (bar)

```json
{
  "component_id": "chart_with_ai",
  "params": {
    "chart_type": "bar",
    "title": "月度销售趋势",
    "api_url": "/api/demo/chart/risk-bar-post",
    "api_method": "post",
    "height": 380,
    "drilldown_api": "/api/demo/bar-risk-list-post",
    "drilldown_method": "post",
    "drilldown_columns": [
      { "name": "id", "label": "ID", "width": 60 },
      { "name": "customer_name", "label": "客户名称" },
      { "name": "amount", "label": "金额", "type": "number" }
    ]
  }
}
```

---

### 折线图示例 (line)

```json
{
  "component_id": "chart_with_ai",
  "params": {
    "chart_type": "line",
    "title": "风险变化趋势",
    "api_url": "/api/demo/chart/risk-line-post",
    "api_method": "post",
    "height": 350,
    "ai_analysis_text": "低风险客户呈稳定增长态势。"
  }
}
```

---

### 漏斗图示例 (funnel)

```json
{
  "component_id": "chart_with_ai",
  "params": {
    "chart_type": "funnel",
    "title": "贷款流程转化",
    "api_url": "/api/demo/chart/risk-funnel-post",
    "api_method": "post",
    "height": 380,
    "ai_analysis_text": "整体转化率30%，初审流失率最高。"
  }
}
```

---

### 雷达图示例 (radar)

```json
{
  "component_id": "chart_with_ai",
  "params": {
    "chart_type": "radar",
    "title": "风险评估指标",
    "api_url": "/api/demo/chart/risk-radar-post",
    "api_method": "post",
    "height": 400
  }
}
```

---

### 仪表盘示例 (gauge)

```json
{
  "component_id": "chart_with_ai",
  "params": {
    "chart_type": "gauge",
    "title": "综合风险指数",
    "api_url": "/api/demo/chart/risk-gauge-post",
    "api_method": "post",
    "height": 320,
    "ai_analysis_text": "当前综合风险评分68分，中等偏高。"
  }
}
```

---

## alert 提示框组件

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `alert_html` | string | ✅ | 提示框的 HTML 内容 |

### 使用示例

#### 信息提示（蓝色）

```json
{
  "component_id": "alert",
  "params": {
    "alert_html": "<i class=\"fa fa-info-circle\" style=\"margin-right: 8px;\"></i>本页面展示销售数据分析。"
  }
}
```

#### 警告提示（带图标）

```json
{
  "component_id": "alert",
  "params": {
    "alert_html": "<i class=\"fa fa-warning\" style=\"margin-right: 8px; color: #faad14;\"></i>警告：有5条高风险客户需要处理！"
  }
}
```

#### 成功提示

```json
{
  "component_id": "alert",
  "params": {
    "alert_html": "<i class=\"fa fa-check-circle\" style=\"margin-right: 8px; color: #52c41a;\"></i>数据同步完成"
  }
}
```

#### 错误提示

```json
{
  "component_id": "alert",
  "params": {
    "alert_html": "<i class=\"fa fa-times-circle\" style=\"margin-right: 8px; color: #ff4d4f;\"></i>操作失败，请重试"
  }
}
```

---

## ai_form AI提问表单组件

### 功能说明

用于向 AI 发送分析请求并动态加载返回的页面 Schema。用户在表单中输入需求，点击按钮后会调用指定的 AI 接口，返回的页面组件会动态渲染在下方。

### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `api_url` | string | ✅ | - | AI 分析 API 地址 |
| `title` | string | | `"向 AI 提问"` | 表单标题 |
| `label` | string | | `"请输入分析需求"` | 输入框标签 |
| `placeholder` | string | | `""` | 输入框占位符 |
| `default_value` | string | | `""` | 输入框默认值 |
| `button_text` | string | | `"开始分析"` | 按钮文字 |
| `api_method` | string | | `"post"` | API 请求方法：get/post |
| `page_id` | string | | - | 页面ID参数（会传递给API） |

### 基础示例

```json
{
  "component_id": "ai_form",
  "params": {
    "api_url": "/api/ai/generate-page"
  }
}
```

### 完整示例

```json
{
  "component_id": "ai_form",
  "params": {
    "title": "向 AI 提问",
    "label": "请输入分析需求",
    "placeholder": "例如：生成贷款逾期分析图表",
    "default_value": "生成贷款逾期分析图表",
    "button_text": "开始分析",
    "api_url": "/api/ai/generate-page",
    "api_method": "post",
    "page_id": "loan_analysis"
  }
}
```

### 自定义文字示例

```json
{
  "component_id": "ai_form",
  "params": {
    "title": "智能报表生成",
    "label": "请描述您需要的报表",
    "placeholder": "例如：按月统计销售额，生成柱状图",
    "button_text": "生成报表",
    "api_url": "/api/ai/generate-report"
  }
}
```

---

## 标签页布局 (tabs)

当需要将组件分组到多个标签页时，使用 `tabs` 参数替代 `components`。

### 参数结构

```json
{
  "tabs": [
    {
      "title": "标签页1标题",
      "components": [/* 该标签下的组件 */]
    },
    {
      "title": "标签页2标题",
      "components": [/* 该标签下的组件 */]
    }
  ]
}
```

### 标签页示例

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "generate_page_schema",
    "arguments": {
      "title": "风险分析仪表盘",
      "layout": "simple",
      "tabs": [
        {
          "title": "风险概览",
          "components": [
            {
              "component_id": "alert",
              "params": {
                "alert_html": "<i class=\"fa fa-warning\" style=\"margin-right: 8px;\"></i>有5条高风险客户待处理"
              }
            },
            {
              "component_id": "chart_with_ai",
              "params": {
                "chart_type": "pie",
                "title": "风险等级分布",
                "api_url": "/api/demo/chart/risk-pie-post",
                "api_method": "post"
              }
            }
          ]
        },
        {
          "title": "详细分析",
          "components": [
            {
              "component_id": "chart_with_ai",
              "params": {
                "chart_type": "bar",
                "title": "月度趋势",
                "api_url": "/api/demo/chart/risk-bar-post",
                "api_method": "post"
              }
            },
            {
              "component_id": "chart_with_ai",
              "params": {
                "chart_type": "line",
                "title": "风险变化",
                "api_url": "/api/demo/chart/risk-line-post",
                "api_method": "post"
              }
            }
          ]
        }
      ]
    }
  },
  "id": 1
}
```

> **注意**：如果 `tabs` 数组只有 1 个元素，会自动降级为单页模式（不显示标签栏）。

---

## 完整示例

### 单页模式（多图表 + 提示框）

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "generate_page_schema",
    "arguments": {
      "title": "综合分析仪表盘",
      "layout": "simple",
      "components": [
        {
          "component_id": "alert",
          "params": {
            "alert_html": "<i class=\"fa fa-info-circle\" style=\"margin-right: 8px;\"></i>数据更新时间：2024-12-22 13:00"
          }
        },
        {
          "component_id": "chart_with_ai",
          "params": {
            "chart_type": "pie",
            "title": "客户分布",
            "api_url": "/api/demo/chart/risk-pie-post",
            "api_method": "post",
            "height": 400
          }
        },
        {
          "component_id": "chart_with_ai",
          "params": {
            "chart_type": "bar",
            "title": "月度统计",
            "api_url": "/api/demo/chart/risk-bar-post",
            "api_method": "post",
            "height": 350
          }
        }
      ]
    }
  },
  "id": 1
}
```

---

## API 数据格式要求

图表数据 API 应返回 ECharts option 格式：

```json
{
  "status": 0,
  "msg": "success",
  "data": {
    "series": [...],
    "xAxis": {...},
    "yAxis": {...}
  }
}
```

钻取列表 API 应返回分页格式：

```json
{
  "status": 0,
  "msg": "success",
  "data": {
    "items": [...],
    "total": 100
  }
}
```
