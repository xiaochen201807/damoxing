# Amis 使用指南（项目实战总结）

> 基于 `sys_page_template` 表中 **39 个 `is_active=1`** 的活跃页面模板提炼，所有示例均来自真实 Schema。

---

## 目录

1. [页面结构规范](#1-页面结构规范)
2. [数据绑定与表达式](#2-数据绑定与表达式)
3. [API 调用规范](#3-api-调用规范)
4. [事件系统（onEvent）](#4-事件系统onevent)
5. [常用组件速查](#5-常用组件速查)
6. [布局组件](#6-布局组件)
7. [AI 集成模式](#7-ai-集成模式)
8. [组件间传值（钻取）](#8-组件间传值钻取)
9. [常见模式 Cookbook](#9-常见模式-cookbook)

---

## 1. 页面结构规范

### 1.1 顶层 page 骨架

```json
{
  "type": "page",
  "id": "global_page_root",
  "className": "p-none",
  "data": {
    "show_analysis_result": false,
    "ai_loading": false,
    "show_prediction": false
  },
  "body": [...]
}
```

> `id` 统一命名 `global_page_root`，方便跨组件 `setValue` 写入页面级状态。

### 1.2 标准白卡片容器

```json
{
  "type": "container",
  "className": "m-t-md",
  "style": {
    "backgroundColor": "#fff",
    "borderRadius": "10px",
    "boxShadow": "0 4px 8px rgba(0,0,0,0.05)",
    "padding": "25px",
    "marginBottom": "20px"
  },
  "body": [...]
}
```

### 1.3 fieldset 参数分组（左蓝边框风格）

```json
{
  "type": "fieldset",
  "title": "某某参数组",
  "className": "mb-6",
  "style": {
    "backgroundColor": "#ffffff",
    "border": "1px solid #e5e7eb",
    "borderLeft": "4px solid #3b82f6",
    "borderRadius": "12px",
    "padding": "28px 24px",
    "marginBottom": "28px",
    "boxShadow": "0 1px 3px rgba(0,0,0,0.08)",
    "transition": "box-shadow 0.2s ease"
  },
  "body": [...]
}
```

---

## 2. 数据绑定与表达式

### 2.1 变量引用语法

| 场景 | 语法 | 示例 |
|---|---|---|
| 普通取值 | `${varName}` | `${displayText}` |
| 三元判断 | `${cond ? 'a' : 'b'}` | `${ai_loading ? '加载中' : '就绪'}` |
| 数字格式化 | `${val \| number:0,0}` | `¥${amount \| number:0,0}` |
| 日期格式化 | `${val \| date:'YYYY-MM-DD HH:mm:ss'}` | `${lastUpdated \| date:'YYYY-MM-DD'}` |
| 嵌套取值 | `${data.query}` | `${data.query \|\| query \|\| '未指定'}` |
| 条件 class | `${cond ? 'class-a' : 'class-b'}` | `${!show ? 'hidden' : 'm-t-md'}` |

### 2.2 显示/隐藏控制（两种方式）

```json
// 方式一：visibleOn（组件不渲染）
{ "visibleOn": "${ai_loading}" }

// 方式二：条件 className（保留 DOM，仅切换显隐）
{ "className": "${!show_analysis_result ? 'hidden' : 'm-t-md'}" }
```

### 2.3 tpl 内嵌 HTML

```json
{
  "type": "tpl",
  "tpl": "<div style='color:#8c8c8c;font-size:13px'>${displayText}</div>"
}
```

### 2.4 hidden 字段存储中间状态

```json
{ "type": "hidden", "name": "policy_params_all_json", "value": [] },
{ "type": "hidden", "name": "policy_params_selected_json", "value": [] }
```

---

## 3. API 调用规范

### 3.1 标准 POST API 结构

本项目全部使用 POST，`data` 中必传 `cxlx`（查询类型）和 `jgbh`（机构编号）：

```json
{
  "method": "post",
  "url": "/HFB/common/dmx_policy/management=xxx.service",
  "data": {
    "cxlx": { "metricsKey": "zcyc_zxgdl_value" },
    "jgbh": "6201022001"
  }
}
```

### 3.2 合并上下文数据（`"&": "$$"`）

```json
{
  "data": {
    "&": "$$",
    "cxlx": { "mxKey": "zcyc_zxgdl_lsmx" },
    "jgbh": "6201022001"
  }
}
```

> `"&": "$$"` 等效于将当前上下文所有字段 `Object.assign` 进请求参数。

### 3.3 adaptor 响应适配

```json
{
  "api": {
    "method": "post",
    "url": "...",
    "adaptor": "return { ...payload, options: payload.data.options }"
  }
}
```

多组数据扁平化示例：

```json
{
  "adaptor": "var options = []; if (payload.data && payload.data.groups) { payload.data.groups.forEach(function(g) { options = options.concat(g.items || []); }); } return { ...payload, data: { ...payload.data, options: options } };"
}
```

### 3.4 schemaApi 动态渲染（AI 核心）

```json
{
  "type": "service",
  "id": "unified_analysis_service",
  "initFetch": false,
  "className": "${!show_analysis_result ? 'hidden' : 'm-t-md'}",
  "schemaApi": {
    "method": "post",
    "url": "/api/ai/generate-page",
    "sendOn": "this.ai_loading === true",
    "data": {
      "&": "$$",
      "pageId": "zxgdl",
      "workflow_type": "ai_analysis",
      "timestamp": "${date(now(), 'x')}",
      "query": "${data.query || query || '用户未指定要求'}"
    }
  },
  "body": { "type": "tpl", "tpl": "", "visible": false }
}
```

> - `initFetch: false` — 禁止初始化自动请求
> - `sendOn` — 条件为 true 时才发请求
> - 后端返回合法 Amis Schema JSON 即可实现运行时动态渲染

### 3.5 CRUD 列表组件

```json
{
  "type": "crud",
  "api": {
    "method": "post",
    "url": "/HFB/.../detail_query.service",
    "data": { "&": "$$", "cxlx": {...}, "jgbh": "..." }
  },
  "syncLocation": false,
  "perPage": 10,
  "perPageField": "size",
  "perPageAvailable": [10, 20, 50, 100],
  "footerToolbar": ["statistics", "switch-per-page", "pagination"],
  "columns": [{ "name": "value1", "label": "年月", "width": 100 }]
}
```

> `syncLocation: false`：嵌套在 dialog 里时必须设置，防止翻页修改浏览器 URL。

---

## 4. 事件系统（onEvent）

### 4.1 actionType 速查

| actionType | 作用 | 频次 |
|---|---|---|
| `setValue` | 写入指定组件数据 | ★★★★★ |
| `toast` | 弹出提示消息 | ★★★★ |
| `reload` | 重新加载组件 | ★★★ |
| `dialog` | 弹出对话框 | ★★ |
| `custom` | 执行自定义 JS | ★ |

### 4.2 AI 触发标准模式

```json
{
  "type": "button",
  "label": "AI预测",
  "level": "danger",
  "onEvent": {
    "click": {
      "actions": [
        {
          "actionType": "setValue",
          "componentId": "global_page_root",
          "args": { "value": { "show_analysis_result": true, "ai_loading": true } }
        },
        {
          "actionType": "reload",
          "componentId": "unified_analysis_service",
          "args": { "data": { "&": "$$" } }
        }
      ]
    }
  }
}
```

### 4.3 service 生命周期事件

```json
{
  "onEvent": {
    "fetchSchemaInited": {
      "actions": [
        { "actionType": "setValue", "componentId": "global_page_root", "args": { "value": { "ai_loading": false } } },
        { "actionType": "toast", "args": { "msgType": "success", "msg": "分析完成" } }
      ]
    },
    "fetchFailed": {
      "actions": [
        { "actionType": "setValue", "componentId": "global_page_root", "args": { "value": { "ai_loading": false } } },
        { "actionType": "toast", "args": { "msgType": "error", "msg": "生成失败，请稍后重试" } }
      ]
    }
  }
}
```

### 4.4 chart 点击钻取

```json
{
  "type": "chart",
  "height": 350,
  "clickAction": {
    "actionType": "dialog",
    "dialog": {
      "title": "${selectedName}客户清册",
      "size": "xl",
      "data": { "selectedId": "${data.itemId}", "selectedName": "${data.name}" },
      "body": {
        "type": "service",
        "api": { "method": "get", "url": "/api/demo/risk-list/${selectedId}" },
        "body": { "type": "table", "columns": [...] }
      }
    }
  }
}
```

---

## 5. 常用组件速查

### 5.1 表单输入组件

| 组件 | 适用场景 | 关键属性 |
|---|---|---|
| `input-number` | 数值参数 | `precision`、`value` |
| `input-text` | 文本输入 | `clearable`、`placeholder` |
| `select` | 下拉选择 | `source`（远程）、`selectFirst`、`static`（只读） |
| `textarea` | 多行文本/AI需求输入 | `minRows`、`maxRows`、`showCounter`、`maxLength` |
| `input-date` | 日期选择 | `format`、`inputFormat` |
| `checkboxes` | 多选（政策参数勾选） | `checkAll`、`defaultCheckAll`、`joinValues`、`source` |
| `switch` | 开关 | `onText`、`offText` |
| `hidden` | 隐藏字段存状态 | `name`、`value` |

### 5.2 select 静态只读模式

```json
{
  "type": "select",
  "name": "zxgdl_dqgdl",
  "label": "当前个贷率(%)",
  "static": true,
  "source": {
    "method": "post",
    "url": "...",
    "adaptor": "return { ...payload, options: payload.data.options }"
  },
  "selectFirst": true,
  "labelWidth": 150
}
```

### 5.3 each 列表遍历

```json
{
  "type": "each",
  "name": "${groups || []}",
  "items": {
    "type": "container",
    "body": [
      { "type": "html", "tpl": "<div>${title}</div>", "visibleOn": "this.title" },
      {
        "type": "each",
        "name": "items",
        "items": {
          "type": "container",
          "body": [{ "type": "html", "html": "<div class='stat-label'>${label}</div><div class='stat-value' style='color:#007bff'>${value}${unit}</div>" }]
        }
      }
    ]
  }
}
```

> `"name": "${groups || [defaultItem]}"` 可在接口为空时提供占位结构，防止报错。

### 5.4 custom 组件（JS 生命周期）

```json
{
  "type": "custom",
  "name": "ai-modal-timer",
  "html": "<div id='timer-sec'>0</div>",
  "onMount": "window.myTimer = setInterval(() => { document.getElementById('timer-sec').innerText = ((Date.now()-Date.now())/1000).toFixed(1); }, 100);",
  "onUnmount": "clearInterval(window.myTimer);"
}
```

> `onMount` 挂载后执行 JS，`onUnmount` 销毁时清理副作用（防内存泄漏）。

### 5.5 mapping 状态标签映射

```json
{
  "type": "mapping",
  "map": {
    "*": "<span class='label label-${overdue_days > 60 ? \"danger\" : \"success\"}'>${overdue_days}天</span>"
  }
}
```

### 5.6 chart ECharts 图表

```json
{
  "type": "chart",
  "height": 350,
  "api": { "method": "post", "url": "/api/xxx/chart-data", "data": {...} },
  "dataFilter": "const option = payload.data || {}; /* 客户端处理 */ return option;"
}
```

---

## 6. 布局组件

### 6.1 grid 网格（12 列栅格）

```json
{
  "type": "grid",
  "columns": [
    { "md": 4, "body": [{ "type": "input-number", "name": "field1" }] },
    { "md": 4, "body": [{ "type": "input-number", "name": "field2" }] },
    { "md": 4, "body": [{ "type": "input-number", "name": "field3" }] }
  ]
}
```

### 6.2 tabs 标签页

```json
{
  "type": "tabs",
  "tabs": [
    { "title": "🗺️ 路由管理", "body": {...} },
    { "title": "📋 菜单管理", "body": {...} }
  ]
}
```

### 6.3 card 卡片

```json
{
  "type": "card",
  "className": "m-b",
  "header": { "title": "${group}", "titleClassName": "text-base font-bold" },
  "body": { "type": "table", "source": "${items}", "columns": [...] }
}
```

---

## 7. AI 集成模式

### 7.1 完整页面架构

```
page (global_page_root)
├── container → service（拉取页面标题）
├── tpl/html（AI背景知识说明）
├── form (wrapWithPanel: false)   ← 统一收集所有表单数据
│   ├── container（政策参数/checkboxes）
│   ├── container → fieldset（input-number 参数输入）
│   ├── container（textarea 分析需求）
│   ├── container（按钮区：历史数据 dialog + AI预测 reload）
│   └── service (unified_analysis_service, schemaApi)
│       └── onEvent: fetchSchemaInited / fetchFailed
└── container (AI Loading 蒙层, visibleOn: ${ai_loading})
    └── custom（SVG 转圈 + 计时器）
```

### 7.2 AI Loading 全屏蒙层

```json
{
  "type": "container",
  "visibleOn": "${ai_loading}",
  "style": {
    "position": "fixed", "top": "0", "left": "0",
    "width": "100vw", "height": "100vh",
    "backgroundColor": "rgba(255,255,255,0.6)",
    "zIndex": "9999", "display": "flex",
    "alignItems": "center", "justifyContent": "center",
    "backdropFilter": "blur(8px)"
  },
  "body": [{
    "type": "custom",
    "name": "ai-modal-timer",
    "html": "<!-- SVG转圈 + 计时器 DOM -->",
    "onMount": "const startTime = Date.now(); const texts = ['正在加载数据...','AI 正在分析...','正在渲染报告...']; window.modalTimer = setInterval(() => { const elapsed = ((Date.now()-startTime)/1000).toFixed(1); document.getElementById('timer-sec').innerText = elapsed; }, 100);",
    "onUnmount": "clearInterval(window.modalTimer);"
  }]
}
```

### 7.3 传给 AI 服务的标准 Payload

```json
{
  "&": "$$",
  "pageId": "zxgdl",
  "workflow_type": "ai_analysis",
  "timestamp": "${date(now(), 'x')}",
  "query": "${data.query || query || '用户未指定要求'}",
  "selected_policies": "${selected_policies}"
}
```

---

## 8. 组件间传值（钻取）

> 在 Amis 中「钻取」是指：从列表/图表点击某项，将该项数据传递给下一层（弹窗、子服务、子页面）。共有以下 5 种核心传值方式。

### 8.1 方式总览

| 方式 | 触发场景 | 数据来源 | 适用范围 |
|---|---|---|---|
| `dialog.data` | 按钮/图表点击弹窗 | `${data.xxx}` / `${event.name}` | 最常用 |
| URL 路径变量 | API 请求时 | `${varName}` 拼入 URL | 接口钻取 |
| `reload args.data` | 触发子组件刷新 | `"&": "$$"` 合并上下文 | 刷新子服务 |
| `setValue` | 跨组件写入 | 事件触发后写目标组件 | 页面级状态同步 |
| `event.data` / `event.name` | 图表/组件事件 | 组件事件对象 | chart/crud 点击钻取 |

---

### 8.2 方式一：dialog.data 显式传值（最常用）

弹窗时通过 `dialog.data` 将当前行/点击项的数据注入弹窗作用域，弹窗内任何子组件可直接用 `${varName}` 引用。

```json
// CRUD 行操作按钮 → 弹窗详情
{
  "type": "button",
  "label": "详情",
  "level": "link",
  "actionType": "dialog",
  "dialog": {
    "title": "详细信息 - ${name}",
    "size": "lg",
    "body": {
      "type": "form",
      "mode": "horizontal",
      "wrapWithPanel": false,
      "initApi": {
        "method": "get",
        "url": "/api/demo/item/${id}"
      },
      "body": [
        { "type": "static", "name": "id",   "label": "ID" },
        { "type": "static", "name": "name", "label": "名称" }
      ]
    }
  }
}
```

> **要点：** `dialog.title` 里也可用 `${name}` 动态显示当前行的字段，弹窗内无需再声明 `data`，因为弹窗会继承触发行的上下文。

**带显式 data 映射的写法（重命名变量防冲突）：**

```json
{
  "actionType": "dialog",
  "dialog": {
    "title": "${selectedName}客户清册",
    "data": {
      "selectedId":   "${data.itemId}",
      "selectedName": "${data.name}"
    },
    "body": {
      "type": "service",
      "api": {
        "method": "get",
        "url": "/api/demo/risk-list/${selectedId}"
      },
      "body": { "type": "table", "columns": [...] }
    }
  }
}
```

> 使用 `data` 字段可以**重命名**上层变量，避免弹窗内嵌 crud/service 的同名字段覆盖问题。

---

### 8.3 方式二：URL 路径变量（接口钻取）

直接在 API URL 中嵌入 `${varName}`，Amis 会自动将当前上下文中的值替换进去：

```json
// crud operation 列 → 编辑弹窗，URL 携带 route_key
{
  "type": "operation",
  "label": "操作",
  "buttons": [{
    "label": "编辑",
    "actionType": "dialog",
    "dialog": {
      "title": "编辑路由",
      "body": {
        "type": "form",
        "api":     "post:/api/routes/${route_key}/update",
        "initApi": "post:/api/routes/${route_key}",
        "body": [
          { "type": "static",     "name": "route_key",  "label": "路由标识" },
          { "type": "input-text", "name": "route_name", "label": "路由名称", "required": true }
        ]
      }
    }
  }]
}
```

> `${route_key}` 自动从 crud 当前行的上下文中取值，无需手动传递。

**GET 请求 Query 参数拼接：**

```json
{
  "method": "get",
  "url": "/api/export/bar-data?category=${event.name}"
}
```

---

### 8.4 方式三：chart 点击事件 → `event.data` / `event.name`

chart 点击时，Amis 会把 ECharts 的点击数据挂在 `event` 对象上：

```json
{
  "type": "chart",
  "height": 350,
  "clickAction": {
    "actionType": "dialog",
    "dialog": {
      "title": "${event.name} - 详细数据 (共${event.value}条)",
      "data": {
        "selectedCategory": "${event.name}",
        "selectedValue":    "${event.value}"
      },
      "body": {
        "type": "service",
        "api": {
          "method": "get",
          "url": "/api/demo/bar-detail",
          "requestAdaptor": "const category = api.data?.selectedCategory || ''; return { ...api, url: api.url + '?category=' + encodeURIComponent(category) };"
        },
        "body": {
          "type": "crud",
          "syncLocation": false,
          "api": "${api}",
          "columns": [...]
        }
      }
    }
  }
}
```

> **`event` 对象字段（来自 ECharts 点击事件）：**
> - `event.name` → 系列名/X轴标签
> - `event.value` → 数值
> - `event.data.itemId` → 自定义附加数据（需在 ECharts series.data 里定义）
> - `event.data.name` / `event.data.value` → data 对象内的字段

**requestAdaptor 动态改 URL 的技巧：**
```json
{
  "requestAdaptor": "const category = api.data?.selectedCategory || ''; return { ...api, url: api.url + '?category=' + encodeURIComponent(category) };"
}
```

---

### 8.5 方式四：reload + `"&": "$$"`（触发子服务刷新并传参）

点击按钮后先 `setValue` 写入状态，再 `reload` 触发子组件带着全量上下文重新请求：

```json
{
  "onEvent": {
    "click": {
      "actions": [
        {
          "actionType": "setValue",
          "componentId": "global_page_root",
          "args": { "value": { "show_analysis_result": true, "ai_loading": true } }
        },
        {
          "actionType": "reload",
          "componentId": "unified_analysis_service",
          "args": {
            "data": { "&": "$$" }
          }
        }
      ]
    }
  }
}
```

> `"&": "$$"` 将当前作用域**所有字段**（包括 form 中的 `input-number`、`checkboxes`、`textarea` 等）一并传入 reload，子服务拿到的是完整的表单快照。

---

### 8.6 方式五：setValue 跨组件写入（无 dialog 的组件通信）

不需要弹窗，直接向任意有 `id` 的组件写入数据：

```json
// 某个 chart/crud 点击后，把选中值写入页面级 data
{
  "actionType": "setValue",
  "componentId": "global_page_root",
  "args": {
    "value": {
      "subject": "${event.data.value}"
    }
  }
}
```

```json
// 再结合另一个 service 的 sendOn 条件，实现联动
{
  "type": "service",
  "schemaApi": {
    "url": "/api/ai/generate-page",
    "sendOn": "this.subject",
    "data": { "subject": "${subject}" }
  }
}
```

> **使用场景：** 图表/列表点击后不弹窗，而是联动刷新同页的另一个区块（如左侧点击右侧更新）。

---

### 8.7 五种方式对比决策

```
需要传值时，怎么选？

点击图表 bar/pie？
  └─ 用 event.name / event.data → 8.3

点击 CRUD 某一行？
  ├─ 弹窗展示详情/编辑 → 8.2（dialog 继承行上下文）
  └─ URL 带 id 查接口  → 8.3（URL 路径变量 ${id}）

按钮点击触发子区域刷新？
  ├─ 需要传 form 全量数据 → 8.5（reload + "&":"$$"）
  └─ 只需更新某个状态值 → 8.6（setValue → sendOn 联动）

变量需要重命名防冲突？
  └─ dialog.data 显式映射 → 8.2
```

---

## 9. 常见模式 Cookbook

### 8.1 弹窗展示历史数据

```json
{
  "actionType": "dialog",
  "dialog": {
    "title": "历史数据清册",
    "size": "xl",
    "body": {
      "type": "tabs",
      "tabs": [{
        "title": "内部数据",
        "body": {
          "type": "crud",
          "api": { "method": "post", "url": "...", "data": { "&": "$$", "cxlx": {...}, "jgbh": "..." } },
          "syncLocation": false,
          "perPage": 10,
          "footerToolbar": ["statistics", "switch-per-page", "pagination"]
        }
      }]
    }
  }
}
```

### 8.2 统计卡片（动态接口数据）

```json
{
  "type": "service",
  "api": { "method": "post", "url": "/HFB/.../metrics_query.service", "data": {...} },
  "body": [{
    "type": "each",
    "name": "${groups || []}",
    "items": {
      "type": "container",
      "style": { "display": "flex", "flexWrap": "wrap", "gap": "16px" },
      "body": [{
        "type": "each",
        "name": "items",
        "items": {
          "type": "container",
          "className": "stat-card",
          "body": [{
            "type": "html",
            "html": "<div class='stat-label'>${label}</div><div class='stat-value' style='color:#007bff;font-weight:bold'>${value}<span style='font-size:14px'>${unit}</span></div>"
          }]
        }
      }]
    }
  }]
}
```

### 8.3 页面标题从接口拉取

```json
{
  "type": "service",
  "api": {
    "method": "post",
    "url": "/HFB/common/dmx_policy/management=title_query.service",
    "dataType": "json",
    "data": { "cxlx": "{\"titleKey\": \"xxx_title\"}", "jgbh": "..." }
  },
  "body": [{
    "type": "container",
    "className": "text-center",
    "body": [
      { "type": "tpl", "tpl": "<h2 style='font-size:22px;font-weight:600'>${title}</h2>" },
      { "type": "tpl", "tpl": "<div style='color:#8c8c8c;font-size:13px'>${displayText}</div>" }
    ]
  }]
}
```

### 8.4 button-group 切换视图

```json
{
  "type": "button-group",
  "buttons": [
    {
      "label": "图表视图",
      "onEvent": { "click": { "actions": [{ "actionType": "setValue", "componentId": "global_page_root", "args": { "value": { "view_mode": "chart" } } }] } }
    },
    {
      "label": "表格视图",
      "onEvent": { "click": { "actions": [{ "actionType": "setValue", "componentId": "global_page_root", "args": { "value": { "view_mode": "table" } } }] } }
    }
  ]
}
```

### 8.5 form 不包裹面板（无边框表单）

```json
{
  "type": "form",
  "wrapWithPanel": false,
  "mode": "horizontal",
  "actionsClassName": "m-t-md text-center",
  "body": [...],
  "actions": [{ "type": "submit", "label": "提交", "level": "primary" }]
}
```

---

## 附录：项目活跃页面速查表

| id | page_key | 标题 | 主要组件 |
|---|---|---|---|
| 1 | loan_risk | 贷款风险智能分析 | form, service, schemaApi |
| 54 | config | 系统配置中心 | tabs, crud, form, each |
| 552 | xyqc | 信用清册 | crud, select, mapping |
| 737 | tqfw | 提取服务 | tabs, service, crud, input-date |
| 751 | dkfw | 贷款服务 | tabs, service, crud |
| 758 | fxjk | 风险监控 | chart, crud, card |
| 819~829 | *tq | 各类提取政策调整预测 | service, each, fieldset, schemaApi |
| 841/842 | jcdwkm/lhjckm | 扩面分析 | service, card, input-file |
| 849/850 | gjjdqzc/gjjdhzc | 贷前/贷后政策预测 | fieldset, grid, input-number |
| 851/854/866 | dkyql/tqzzl/zxgdl | 调控建议系列 | checkboxes, hidden, schemaApi |

---

> 本文档基于数据库模板自动分析生成，如有新增模板建议定期更新。
