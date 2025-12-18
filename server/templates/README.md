# AMIS Schema Template System

## 概述

本系统使用 Jinja2 模板引擎将 AMIS 页面 Schema 组件化和模块化，实现配置与代码分离。

## 目录结构

```
server/
├── templates/              # Jinja2 模板目录
│   ├── base/              # 基础模板
│   │   └── colors.j2      # 颜色变量（Apple Design System）
│   ├── components/        # 可复用组件
│   │   ├── header.j2      # 页面标题组件
│   │   ├── alert.j2       # 提示框组件
│   │   ├── chart_panel.j2 # 图表面板组件
│   │   └── text_section.j2# 文字分析组件
│   └── pages/             # 页面主模板
│       └── chart_demo.j2  # 图表示例页面
├── template_config/       # 配置文件
│   └── chart_demo_vars.json  # 页面变量配置
├── build_schema.py        # 模板渲染脚本
└── demo_chart_schema.json # 生成的 JSON Schema
```

## 设计理念

### 1. 分层架构

- **Base Layer**: 全局变量和样式标准（colors.j2）
- **Component Layer**: 可复用的 UI 组件
- **Page Layer**: 组合组件的完整页面
- **Config Layer**: JSON 配置文件（内容与样式分离）

### 2. Apple Design System

遵循苹果设计规范，使用克制的配色：

```jinja2
colors = {
    'title': '#1d1d1f',        # 深灰黑（标题）
    'subtitle': '#86868b',      # 中性灰（副标题）
    'background': '#f7f8fa',    # 浅灰背景
    'alert_bg': '#f5f5f7',     # 通知背景
    'chart_colors': ['#3aa1ff', '#36cfc9', '#9254de']  # 商务冷色调
}
```

### 3. 配置化

所有文案、API 地址、样式参数都可通过 JSON 配置文件修改：

```json
{
    "title": "图表交互示例",
    "api_url": "/api/demo/chart/risk-pie",
    "sections": [
        {
            "label": "风险分析",
            "color": "#0050b3",
            "content": "..."
        }
    ]
}
```

## 使用方法

###1. 修改配置

编辑 `template_config/chart_demo_vars.json`，修改页面内容：

```bash
vi template_config/chart_demo_vars.json
```

### 2. 生成 Schema

运行渲染脚本（需要先安装 Jinja2）：

```bash
# 安装依赖
pip3 install jinja2

# 生成 Schema
python3 build_schema.py
```

### 3. 更新数据库

将生成的 Schema 同步到数据库：

```bash
sqlite3 database.sqlite "UPDATE sys_page_template SET schema_json = readfile('demo_chart_schema.json') WHERE page_key = 'chart_demo' AND is_active = 1;"
```

### 4. 刷新页面

在浏览器中刷新页面即可看到更新。

## 组件说明

### colors.j2 - 颜色变量

定义了全局颜色标准，所有组件通过 `import` 引用：

```jinja2
{% import 'base/colors.j2' as theme %}
{{ theme.colors.title }}
```

### header.j2 - 页面标题

输入变量：
- `title`: 主标题文字
- `subtitle`: 副标题文字

### alert.j2 - 系统通知

输入变量：
- `message`: 提示内容（支持 Markdown）

### text_section.j2 - 文字分析区块

输入变量：
- `sections`: 数组，每项包含 `{label, color, content}`

循环渲染多个分析段落。

## 工作流程

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ 修改配置文件  │ ──▶ │ 运行渲染脚本 │ ──▶ │ 更新数据库    │
│ .json        │     │ build_schema│     │ sqlite3      │
└──────────────┘     └─────────────┘     └──────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ 生成 JSON Schema │
                    │ (AMIS 格式)      │
                    └──────────────────┘
```

## 优势

✅ **模块化**: 组件独立，便于维护  
✅ **复用性**: 一次开发，多处使用  
✅ **配置化**: 非技术人员可修改内容  
✅ **标准化**: 统一颜色和样式规范  
✅ **版本控制**: 模板和配置分离，易于追踪变更

## 扩展指南

### 创建新页面

1. 在 `template_config/` 创建新的配置文件
2. 在 `templates/pages/` 创建页面模板
3. 在 `build_schema.py` 添加构建任务
4. 运行脚本生成 Schema

### 创建新组件

1. 在 `templates/components/` 创建 `.j2` 文件
2. 导入 `colors.j2` 使用统一颜色
3. 在页面模板中 `include` 使用

## 注意事项

1. **JSON 语法**: 模板输出必须是合法的 JSON
2. **引号转义**: HTML属性中使用单引号 `'`
3. **Jinja2 语法**: 熟悉 `{% %}` (逻辑) 和 `{{ }}` (变量)
4. **路径引用**: 使用相对于 `templates/` 的路径

## 故障排查

### JSON 解析错误

```bash
# 查看生成的 JSON 并验证
python3 -m json.tool demo_chart_schema.json
```

### 模板未找到

检查 `FileSystemLoader` 的根目录设置和模板路径。

### 变量未定义

确保配置文件包含所有模板所需的变量。

## 相关文档

- [Jinja2 官方文档](https://jinja.palletsprojects.com/)
- [AMIS 组件文档](https://aisuda.bce.baidu.com/amis/zh-CN/components/page)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
