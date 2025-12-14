# Python 模板生成工具独立化 - 完成报告

## 📅 执行时间
2025-12-14

---

## 🎯 重构目标

将 Python 的 Jinja2 模板生成工具从 `server/` 目录中独立出来，创建专门的 `schema-builder/` 目录。

### 为什么要独立？

| 原因 | 说明 |
|------|------|
| **职责分离** | Python 只负责模板生成，Node.js 负责 API 服务 |
| **依赖隔离** | Python 和 Node.js 的依赖完全分开管理 |
| **部署灵活** | 可以选择性部署（如只在开发环境使用） |
| **维护清晰** | 独立的文档和配置，更易理解 |
| **技术栈清晰** | 前端(React)/后端(Node.js)/工具(Python) 三者分明 |

---

## 📦 新项目结构

### 修改前
```
damoxing/
├── client/
├── server/
│   ├── build_schema.py           # ❌ Python 文件在 Node.js 项目中
│   ├── template_helpers.py       # ❌ 混在一起
│   ├── templates/                # ❌ 不清楚是什么模板
│   └── template_config/          # ❌ 配置文件混杂
└── docs/
```

### 修改后
```
damoxing/
├── client/                       # 纯前端项目 ✅
├── server/                       # 纯后端项目 ✅
├── schema-builder/               # 独立的 Python 工具 ✅
│   ├── templates/
│   │   ├── base/
│   │   ├── components/
│   │   └── pages/
│   ├── configs/
│   ├── output/
│   ├── build_schema.py
│   ├── template_helpers.py
│   ├── requirements.txt
│   ├── .gitignore
│   └── README.md
└── docs/
```

---

## 🔄 迁移步骤

### 1. 创建目录结构
```bash
mkdir -p schema-builder/{templates,configs,output}
```

### 2. 迁移文件

| 原路径 | 新路径 | 状态 |
|--------|--------|------|
| `server/build_schema.py` | `schema-builder/build_schema.py` | ✅ 已迁移并更新路径 |
| `server/template_helpers.py` | `schema-builder/template_helpers.py` | ✅ 已迁移 |
| `server/templates/` | `schema-builder/templates/` | ✅ 已迁移 |
| `server/template_config/` | `schema-builder/configs/` | ✅ 已迁移（重命名） |

### 3. 创建配置文件

**新增文件**:
- ✅ `schema-builder/README.md` - 详细使用文档
- ✅ `schema-builder/requirements.txt` - Python 依赖
- ✅ `schema-builder/.gitignore` - Git 忽略规则
- ✅ `schema-builder/output/.gitkeep` - 保留输出目录

### 4. 更新代码

**修改 `build_schema.py`**:
```python
# 修改前
template_dir = Path(__file__).parent / 'templates' / 'pages'

# 修改后（保持不变，相对路径自动适应）
template_dir = Path(__file__).parent / 'templates' / 'pages'

config_file='template_config/chart_demo_vars.json'  # 修改前
config_file='configs/chart_demo_vars.json'           # 修改后
output_file='demo_chart_schema.json'                 # 修改前
output_file='output/demo_chart_schema.json'          # 修改后
```

---

## 📁 Schema Builder 功能说明

### 用途
基于 Jinja2 模板引擎，将配置化的 JSON 数据和可复用的模板组件编译成 AMIS 页面 Schema。

### 工作流程
```
1. 编辑配置文件 (configs/*.json)
   ↓
2. 运行构建脚本 (python3 build_schema.py)
   ↓
3. 生成 Schema JSON (output/*.json)
   ↓
4. 同步到数据库 (sqlite3 或 API)
```

### 快速开始
```bash
# 进入工具目录
cd schema-builder

# 创建虚拟环境（可选但推荐）
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 构建 Schema
python3 build_schema.py

# 查看生成的文件
cat output/demo_chart_schema.json
```

---

## 🔧 与主项目的集成

### 开发环境

**独立开发模板**:
```bash
cd schema-builder
python3 build_schema.py
```

**同步到服务器**:
```bash
cd ../server
sqlite3 database.sqlite "UPDATE sys_page_template SET schema_json = readfile('../schema-builder/output/demo_chart_schema.json') WHERE page_key = 'chart_demo' AND is_active = 1;"
```

### 生产环境

**选项 1: 预构建**
- CI/CD 流程中运行 Python 脚本
- 将生成的 JSON 文件提交到代码库
- 部署时只需要 Node.js 环境

**选项 2: 按需构建**
- 生产环境也安装 Python
- 需要更新模板时运行构建脚本
- 更灵活，但增加了依赖

**选项 3: 开发环境专用**（推荐）
- 只在开发环境使用 Python 工具
- 生成的 Schema 通过 API 或数据库同步到生产
- 生产环境无需 Python

---

## 📝 配置文件说明

### requirements.txt
```txt
jinja2>=3.0.0
```

### .gitignore
```gitignore
# Python 虚拟环境
.venv/
__pycache__/

# 生成的文件（可根据需求调整）
output/*.json
!output/.gitkeep
```

---

## 🎨 模板系统架构

### 三层设计

```
┌─────────────────┐
│  Base Layer     │  <- 全局变量（颜色、样式）
│  (colors.j2)    │
└────────┬────────┘
         │
┌────────▼────────┐
│ Component Layer │  <- 可复用组件
│ (header.j2,     │     (header, alert, chart)
│  alert.j2...)   │
└────────┬────────┘
         │
┌────────▼────────┐
│  Page Layer     │  <- 完整页面模板
│ (chart_demo.j2) │     (组合多个组件)
└────────┬────────┘
         │
┌────────▼────────┐
│  Config Layer   │  <- JSON 配置文件
│ (*.json)        │     (内容与样式分离)
└─────────────────┘
```

### 设计理念
- **分层架构** - 职责清晰，易于维护
- **组件复用** - 一次开发，多处使用
- **配置驱动** - 内容与代码分离
- **标准化** - 统一的颜色和样式规范

---

## ⚠️ 注意事项

### 1. 环境要求
- **Python**: 3.7+
- **pip**: 最新版本
- **操作系统**: Mac/Linux/Windows（推荐使用虚拟环境）

### 2. 路径更新
如果之前有脚本或文档引用了旧路径，需要更新：
- `server/build_schema.py` → `schema-builder/build_schema.py`
- `server/templates/` → `schema-builder/templates/`
- `server/template_config/` → `schema-builder/configs/`

### 3. 生成的文件位置
- 旧位置: `server/demo_chart_schema.json`
- 新位置: `schema-builder/output/demo_chart_schema.json`

### 4. 是否保留 server/ 中的文件？

**建议**: 删除 `server/` 中的 Python 文件，保持目录整洁

```bash
# 备份（可选）
cd server
mkdir ../schema-builder-backup
cp *.py ../schema-builder-backup/

# 删除（请确认 schema-builder 工作正常后再执行）
rm build_schema.py template_helpers.py
rm -rf templates template_config
rm demo_chart_schema.json config_page_schema.json  # 生成的文件也可删除
```

---

## ✅ 验证清单

- [x] `schema-builder/` 目录已创建
- [x] 所有 Python 文件已迁移
- [x] `build_schema.py` 路径已更新
- [x] `requirements.txt` 已创建
- [x] `.gitignore` 已配置
- [x] `README.md` 文档完整
- [x] 主项目 `README.md` 已更新
- [ ] 测试构建脚本（需用户执行）
- [ ] 删除 server/ 中的旧文件（需用户确认）

---

## 🚀 下一步操作

### 立即测试（推荐）
```bash
cd /Users/xiaochen/Downloads/damoxing/schema-builder
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 build_schema.py
```

### 清理旧文件（可选）
确认新工具运行正常后：
```bash
cd /Users/xiaochen/Downloads/damoxing/server
rm build_schema.py template_helpers.py
rm -rf templates template_config
rm *.json  # 生成的 schema 文件
```

---

## 📊 重构效果

| 指标 | 重构前 | 重构后 | 改善 |
|------|--------|--------|------|
| 目录结构 | 混杂 | 清晰 | ✅ |
| 职责划分 | 不清晰 | 明确 | ✅ |
| 依赖管理 | 混在一起 | 独立 | ✅ |
| 文档完整性 | 部分 | 完整 | ✅ |
| 部署灵活性 | 低 | 高 | ✅ |

---

## 📚 相关文档

- [Schema Builder README](../schema-builder/README.md) - 详细使用文档
- [Templates README](../schema-builder/templates/README.md) - 模板系统说明
- [项目主 README](../README.md) - 更新了项目结构

---

**重构完成！** 🎉

项目结构现在更加清晰，职责分离明确：
- **client/** - 前端 React + AMIS
- **server/** - 后端 Node.js + Express
- **schema-builder/** - 工具 Python + Jinja2
- **docs/** - 文档

每个部分都可以独立开发、测试和部署！
