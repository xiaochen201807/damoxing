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
| `horizontal-bar` | 条形图（横向柱状图） | 类目名称较长、排名展示 |
| `grouped-bar` | 分组柱状图 | 多维度对比、多系列数据 |
| `line` | 折线图 | 趋势变化、时间序列 |
| `funnel` | 漏斗图 | 流程转化、销售漏斗 |
| `radar` | 雷达图 | 多维对比、能力评估 |
| `gauge` | 仪表盘 | 指标完成度、单值展示 |

### 参数说明

#### 基础参数（必填）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `chart_type` | string | ✅ | 图表类型：pie/bar/horizontal-bar/grouped-bar/line/funnel/radar/gauge |
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

### 条形图示例 (bar - 横向)

条形图是横向显示的柱状图，适用于类目名称较长或需要强调排名的场景。

**配置示例：**

```json
{
  "component_id": "chart_with_ai",
  "params": {
    "chart_type": "horizontal-bar",
    "title": "服务质量评分排名",
    "api_url": "/api/demo/chart/horizontal-bar-post",
    "api_method": "post",
    "height": 400,
    "api_data": {
      "chart_id": "service_rank",
      "orientation": "horizontal"
    },
    "drilldown_api": "/api/demo/service-detail-post",
    "drilldown_method": "post"
  }
}
```

**后端 API 返回数据格式：**

```json
{
  "status": 0,
  "msg": "success",
  "data": {
    "grid": {
      "left": "15%",
      "right": "10%",
      "bottom": "3%",
      "containLabel": true
    },
    "xAxis": {
      "type": "value",
      "name": "评分"
    },
    "yAxis": {
      "type": "category",
      "data": ["服务态度", "办事效率", "业务熟练", "热线响应", "一次办成"]
    },
    "series": [{
      "type": "bar",
      "data": [
        { "value": 78, "itemId": "service1", "name": "服务态度" },
        { "value": 65, "itemId": "service2", "name": "办事效率" },
        { "value": 43, "itemId": "service3", "name": "业务熟练" },
        { "value": 35, "itemId": "service4", "name": "热线响应" },
        { "value": 29, "itemId": "service5", "name": "一次办成" }
      ],
      "itemStyle": {
        "borderRadius": [0, 4, 4, 0]
      }
    }]
  }
}
```

**关键配置说明：**
- `xAxis.type = "value"` - X轴为数值轴
- `yAxis.type = "category"` - Y轴为类目轴（与普通柱状图相反）
- `grid.left = "15%"` - 为Y轴类目名称留足空间
- `itemStyle.borderRadius = [0, 4, 4, 0]` - 右侧圆角（横向）

---

### 分组柱状图示例 (bar - 多系列)

分组柱状图用于对比多个维度的数据，每个类目下有多个并排的柱子。

**配置示例：**

```json
{
  "component_id": "chart_with_ai",
  "params": {
    "chart_type": "grouped-bar",
    "title": "月度多维度分析",
    "api_url": "/api/demo/chart/grouped-bar-post",
    "api_method": "post",
    "height": 420,
    "api_data": {
      "chart_id": "multi_series_bar",
      "time_range": "2024"
    },
    "drilldown_api": "/api/demo/grouped-detail-post",
    "drilldown_method": "post",
    "ai_analysis_text": "浏览量呈TOP1为"公积金贷款"（28万次/月），到账率单次66%，长助贷落地率40%，旅游预订未完成并呈个别下滑趋势。",
    "ai_suggestions": "1. 电子面签深圳/线金线上化，作什"贷款管理"等关键高频\n2. 长助贷浏览和搜索贷款，涉税纵向检陈已倒挂40%"
  }
}
```

**后端 API 返回数据格式：**

```json
{
  "status": 0,
  "msg": "success",
  "data": {
    "legend": {
      "data": ["浏览次数（万次/月）", "咨询次数（万次/月）", "启劳次数（万次/月）"],
      "bottom": "0"
    },
    "grid": {
      "left": "3%",
      "right": "4%",
      "bottom": "10%",
      "top": "10%",
      "containLabel": true
    },
    "xAxis": {
      "type": "category",
      "data": ["贷款业务", "英政业务", "地产业务", "领取业务", "界他业务"]
    },
    "yAxis": {
      "type": "value",
      "name": "次数（万次）"
    },
    "series": [
      {
        "name": "浏览次数（万次/月）",
        "type": "bar",
        "data": [
          { "value": 28, "itemId": "loan_view", "name": "贷款业务" },
          { "value": 25, "itemId": "govt_view", "name": "英政业务" },
          { "value": 18, "itemId": "estate_view", "name": "地产业务" },
          { "value": 12, "itemId": "claim_view", "name": "领取业务" },
          { "value": 8, "itemId": "other_view", "name": "界他业务" }
        ]
      },
      {
        "name": "咨询次数（万次/月）",
        "type": "bar",
        "data": [
          { "value": 32, "itemId": "loan_consult", "name": "贷款业务" },
          { "value": 28, "itemId": "govt_consult", "name": "英政业务" },
          { "value": 14, "itemId": "estate_consult", "name": "地产业务" },
          { "value": 10, "itemId": "claim_consult", "name": "领取业务" },
          { "value": 6, "itemId": "other_consult", "name": "界他业务" }
        ]
      },
      {
        "name": "启劳次数（万次/月）",
        "type": "bar",
        "data": [
          { "value": 30, "itemId": "loan_process", "name": "贷款业务" },
          { "value": 30, "itemId": "govt_process", "name": "英政业务" },
          { "value": 8, "itemId": "estate_process", "name": "地产业务" },
          { "value": 5, "itemId": "claim_process", "name": "领取业务" },
          { "value": 3, "itemId": "other_process", "name": "界他业务" }
        ]
      }
    ]
  }
}
```

**关键配置说明：**
- `series` 为数组，包含多个系列（每个系列一种颜色）
- `legend.data` 定义图例名称，与 `series[].name` 对应
- 每个系列的 `data` 数组长度必须与 `xAxis.data` 长度一致
- 相同类目下的柱子会自动并排显示

**视觉效果：**
- 每个类目下有 3 个并排的柱子（蓝色、绿色、橙色）
- 图例显示在底部，可点击切换显示/隐藏某个系列
- 鼠标悬停显示详细数值

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
