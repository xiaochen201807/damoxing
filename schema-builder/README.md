# AMIS Schema Builder

AMIS 页面 Schema 生成工具 - 基于 Jinja2 模板引擎

## 📚 文档导航

- 🚀 **[快速入门](../docs/schema-builder/QUICKSTART.md)** - 5分钟上手教程
- 📊 **[组件参考手册](../docs/schema-builder/COMPONENT_REFERENCE.md)** - 组件速查表和参数对照
- 🔄 **[柱状图更新说明](../docs/schema-builder/BAR_CHART_UPDATE.md)** - 柱状图组件简化说明

## 📁 目录结构

```
schema-builder/
├── templates/           # Jinja2 模板文件
│   ├── base/           # 基础模板（颜色、样式变量）
│   ├── components/     # 可复用组件
│   └── pages/          # 页面主模板
├── configs/            # 配置文件（JSON）
├── output/             # 生成的 Schema 输出目录
├── build_schema.py     # 主构建脚本
├── template_helpers.py # 模板辅助函数
├── requirements.txt    # Python 依赖
└── README.md          # 本文档
```

## 🚀 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境（推荐）
python3 -m venv .venv
source .venv/bin/activate  # Mac/Linux
# .venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 生成 Schema

```bash
# 运行默认构建（生成图表示例页面）
python3 build_schema.py

# 生成的文件
# └── output/demo_chart_schema.json
```

### 3. 使用生成的 Schema

将生成的 JSON Schema 同步到服务器数据库：

```bash
# 进入服务器目录
cd ../server

# 更新数据库中的页面模板
sqlite3 database.sqlite "UPDATE sys_page_template SET schema_json = readfile('../schema-builder/output/demo_chart_schema.json') WHERE page_key = 'chart_demo' AND is_active = 1;"
```

## 📝 使用说明

### 创建新页面

#### 步骤 1: 创建配置文件

在 `configs/` 目录创建 JSON 配置文件，例如 `my_page_vars.json`:

```json
{
    "title": "我的页面",
    "subtitle": "页面副标题",
    "api_url": "/api/data",
    "sections": [
        {
            "label": "数据展示",
            "content": "这里是内容"
        }
    ]
}
```

#### 步骤 2: 创建模板

在 `templates/pages/` 创建 Jinja2 模板 `my_page.j2`:

```jinja2
{% import 'base/colors.j2' as theme %}
{
    "type": "page",
    "title": "{{ title }}",
    "body": [
        {
            "type": "tpl",
            "tpl": "<h2>{{ subtitle }}</h2>"
        }
    ]
}
```

#### 步骤 3: 修改构建脚本

编辑 `build_schema.py`，添加新的构建任务：

```python
if __name__ == '__main__':
    # 构建新页面
    build_schema(
        template_name='my_page.j2',
        config_file='configs/my_page_vars.json',
        output_file='output/my_page_schema.json'
    )
```

#### 步骤 4: 运行构建

```bash
python3 build_schema.py
```

## 🎨 模板系统

### 设计理念

- **分层架构** - Base → Component → Page
- **配置化** - 内容与样式分离
- **复用性** - 组件可在多个页面使用
- **标准化** - 统一的颜色和样式规范

### 颜色主题

遵循 Apple Design System，定义在 `templates/base/colors.j2`:

```jinja2
{% set colors = {
    'title': '#1d1d1f',
    'subtitle': '#86868b',
    'background': '#f7f8fa',
    'chart_colors': ['#3aa1ff', '#36cfc9', '#9254de']
} %}
```

### 可用组件

| 组件 | 文件 | 用途 |
|------|------|------|
| header | `components/header.j2` | 页面标题 |
| alert | `components/alert.j2` | 系统通知 |
| chart_panel | `components/chart_panel.j2` | 图表面板 |
| text_section | `components/text_section.j2` | 文字分析 |

## 🔧 高级用法

### 使用组件

在页面模板中引用组件：

```jinja2
{% include 'components/header.j2' %}

{
    "type": "page",
    {% include 'components/alert.j2' %}
}
```

### 自定义函数

在 `template_helpers.py` 中添加辅助函数：

```python
def my_helper_function(data):
    # 处理数据
    return processed_data
```

在 `build_schema.py` 中导入并使用：

```python
from template_helpers import my_helper_function

config['processed'] = my_helper_function(config['raw_data'])
```

## 📊 输出验证

构建脚本会自动验证生成的 JSON：

```bash
✅ Successfully built schema: output/demo_chart_schema.json
   Template: chart_demo.j2
   Config: configs/chart_demo_vars.json
```

如果 JSON 格式错误，会显示详细的错误信息：

```bash
❌ JSON parse error: Expecting ',' delimiter: line 10 column 5
```

## 🔄 工作流程

```
┌────────────┐     ┌──────────────┐     ┌───────────┐
│ 编辑配置    │ ──▶ │ 运行构建脚本  │ ──▶ │ 更新数据库 │
│ .json      │     │ build_schema │     │ sqlite3   │
└────────────┘     └──────────────┘     └───────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ 生成 JSON Schema│
                  │ (AMIS 格式)     │
                  └─────────────────┘
```

## ⚙️ 环境要求

- **Python**: 3.7+
- **依赖**: 
  - jinja2 >= 3.0.0

## 📚 相关文档

- [Jinja2 官方文档](https://jinja.palletsprojects.com/)
- [AMIS 组件文档](https://aisuda.bce.baidu.com/amis/zh-CN/components/page)
- [项目文档目录](../docs/)
- [快速入门指南](../docs/schema-builder/QUICKSTART.md)
- [组件参考手册](../docs/schema-builder/COMPONENT_REFERENCE.md)

## 🐛 故障排查

### 问题 1: 模板未找到

```
jinja2.exceptions.TemplateNotFound: pages/my_page.j2
```

**解决**: 检查模板文件路径，确保文件在 `templates/pages/` 目录下

### 问题 2: JSON 解析错误

```
JSONDecodeError: Expecting property name enclosed in double quotes
```

**解决**: 
1. 检查模板中的 JSON 语法
2. 确保使用双引号 `"` 而不是单引号 `'`
3. 检查是否有多余的逗号

### 问题 3: 变量未定义

```
jinja2.exceptions.UndefinedError: 'title' is undefined
```

**解决**: 在配置文件中添加缺失的变量

## 📝 最佳实践

1. **配置优先** - 尽量把内容放在配置文件中，而不是硬编码在模板里
2. **组件复用** - 相同的 UI 元素提取为组件
3. **命名规范** - 使用描述性的变量名和文件名
4. **注释清晰** - 在模板中添加必要的注释
5. **版本控制** - 使用 Git 追踪模板和配置的变更

## 🔗 与主项目集成

这个工具是**独立**的，不依赖主项目的 Node.js 环境：

- ✅ **开发独立** - 可以单独开发和测试模板
- ✅ **部署灵活** - 可以选择性部署（如只在开发环境）
- ✅ **依赖隔离** - Python 和 Node.js 依赖完全分离

生成的 Schema 文件可以：
1. 手动导入数据库
2. 通过 API 上传
3. 在 CI/CD 流程中自动同步

---

**Happy Template Building!** 🎨
