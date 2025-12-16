# API 文档

## 概述

大模型系统提供 RESTful API 接口，支持系统菜单、页面模板、Dify 配置管理和 AI 生成功能。

**Base URL**: `http://localhost:3001/api`

---

## 认证

当前版本暂未实现认证机制。生产环境建议添加 JWT 或 OAuth2 认证。

---

## 通用响应格式

### 成功响应
```json
{
  "status": 0,
  "msg": "success",
  "data": { ... }
}
```

### 错误响应
```json
{
  "status": 400,
  "msg": "错误信息",
  "errors": [
    {
      "field": "字段名",
      "message": "错误详情"
    }
  ]
}
```

---

## 系统菜单 API

### 获取系统菜单

**GET** `/api/system/menu`

获取所有系统菜单项。

**响应示例**:
```json
{
  "status": 0,
  "msg": "success",
  "data": [
    {
      "id": 1,
      "label": "贷款风险",
      "path": "/dashboard/loan_risk",
      "icon": "fa fa-dashboard"
    }
  ]
}
```

---

## 页面模板 API

### 获取页面模板

**GET** `/api/page/:pageKey`

根据 pageKey 获取 AMIS 页面模板。

**路径参数**:
- `pageKey` (string): 页面唯一标识

**响应示例**:
```json
{
  "status": 0,
  "msg": "success",
  "data": {
    "type": "page",
    "title": "贷款风险分析",
    "body": [ ... ]
  }
}
```

---

## Dify 配置管理 API

### 1. 获取所有配置

**GET** `/api/dify/config`

**响应示例**:
```json
{
  "status": 0,
  "msg": "success",
  "data": [
    {
      "id": 1,
      "page_key": "loan_risk",
      "workflow_name": "贷款风险分析",
      "api_url": "https://api.dify.ai/v1",
      "api_key": "app-xxx",
      "enabled": 1,
      "description": "贷款风险分析工作流",
      "created_at": "2025-12-13 20:00:00",
      "updated_at": "2025-12-13 20:00:00"
    }
  ]
}
```

### 2. 获取指定配置

**GET** `/api/dify/config/:pageKey`

**路径参数**:
- `pageKey` (string): 页面唯一标识

### 3. 创建配置

**POST** `/api/dify/config`

**请求体**:
```json
{
  "page_key": "dashboard",
  "workflow_name": "数据分析工作流",
  "api_url": "https://api.dify.ai/v1",
  "api_key": "app-xxx",
  "enabled": 1,
  "description": "可选描述"
}
```

**参数验证**:
- `page_key`: 必填，字母数字，1-50字符
- `workflow_name`: 必填，1-100字符
- `api_url`: 必填，有效的 URL
- `api_key`: 必填，1-500字符
- `enabled`: 可选，0 或 1，默认 1
- `description`: 可选，最多 500 字符

### 4. 更新配置

**PUT** `/api/dify/config/:pageKey`

**请求体**（所有字段可选，至少一个）:
```json
{
  "workflow_name": "新工作流名称",
  "api_url": "https://api.dify.ai/v1",
  "api_key": "app-new-key",
  "enabled": 0,
  "description": "更新描述"
}
```

### 5. 删除配置

**DELETE** `/api/dify/config/:pageKey`

---

## AI 生成 API

### 1. 生成内容（Chat Messages）

**POST** `/api/ai/generate`

**限流**: 1分钟10次

**请求体**:
```json
{
  "query": "生成一个贷款风险分析页面",
  "pageId": "loan_risk"
}
```

**参数**:
- `query`: 必填，1-2000字符
- `pageId`: 可选，字母数字，最多50字符

**响应示例**:
```json
{
  "status": 0,
  "msg": "success",
  "data": {
    "type": "page",
    "title": "AI 生成页面",
    "body": [ ... ]
  }
}
```

### 2. 生成页面（Workflow）

**POST** `/api/ai/generate-page`

**限流**: 1分钟10次

**请求体**:
```json
{
  "query": "生成贷款风险分析页面，包含KPI和图表",
  "pageId": "loan_risk"
}
```

**配置优先级**:
1. 数据库中 `pageId` 对应的配置
2. 环境变量 `DIFY_API_KEY`
3. Mock 数据（如果都未配置）

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 0 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如重复创建） |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 限流规则

- **全局限流**: 15分钟内最多 100 次请求
- **AI 接口限流**: 1分钟内最多 10 次请求

超过限制返回 429 状态码。

---

## 使用示例

### cURL 示例

```bash
# 获取菜单
curl http://localhost:3001/api/system/menu

# 创建 Dify 配置
curl -X POST http://localhost:3001/api/dify/config \
  -H "Content-Type: application/json" \
  -d '{
    "page_key": "dashboard",
    "workflow_name": "数据分析",
    "api_url": "https://api.dify.ai/v1",
    "api_key": "app-xxx"
  }'

# AI 生成
curl -X POST http://localhost:3001/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "生成风险分析页面",
    "pageId": "loan_risk"
  }'
```

### JavaScript 示例

```javascript
// 使用 fetch
const response = await fetch('http://localhost:3001/api/dify/config', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    page_key: 'dashboard',
    workflow_name: '数据分析',
    api_url: 'https://api.dify.ai/v1',
    api_key: 'app-xxx',
  }),
});

const data = await response.json();
console.log(data);
```

---

## 安全建议

1. **生产环境添加认证** - 使用 JWT 或 API Key
2. **HTTPS** - 生产环境必须使用 HTTPS
3. **输入验证** - 所有输入已通过 Joi 验证
4. **限流** - 已配置全局和 AI 接口限流
5. **SQL 注入防护** - 已添加自动检测

---

## 更新日志

### v1.0.0 (2025-12-13)
- ✅ 系统菜单 API
- ✅ 页面模板 API
- ✅ Dify 配置管理 API（完整 CRUD）
- ✅ AI 生成 API（Chat + Workflow）
- ✅ 参数验证和限流

---

**完整示例代码**: 参见 [README.md](../README.md)
