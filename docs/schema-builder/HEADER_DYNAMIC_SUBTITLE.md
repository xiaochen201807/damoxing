# Header 动态副标题 - 更新说明

## 📋 版本 2.0 更新

**更新时间**: 2025-12-15

### 主要变更

#### 1. 后端接口优化

**新增字段**: `displayText`

**API 返回示例**:
```json
{
  "status": 0,
  "msg": "success",
  "data": {
    "displayText": "数据更新时间: 2025/12/15 16:58:45 | 覆盖范围: 全市在贷客户 9 人，抵押房产 6 套",
    "updateTime": "2025/12/15 16:58:45",
    "customerCount": "9",
    "houseCount": "6",
    "highRiskCount": 3,
    "mediumRiskCount": 3,
    "lowRiskCount": 3
  }
}
```

**优势**:
- ✅ **后端控制文案**：文字内容由后端生成，便于统一管理
- ✅ **灵活性**：后端可根据业务规则动态调整显示内容
- ✅ **国际化支持**：便于多语言支持
- ✅ **向后兼容**：保留原始数据字段，支持自定义格式化

---

#### 2. 前端模板升级

**`subtitle_service.j2` 更新**:
```jinja2
{
    "type": "tpl",
    "className": "text-center header-stats",
    {% if subtitle_tpl %}
    {# 兼容旧版：使用模板格式化 #}
    "tpl": "{{ subtitle_tpl }}"
    {% else %}
    {# 新版：直接显示后端返回的 displayText #}
    "tpl": "${displayText}"
    {% endif %}
}
```

**特性**:
- 默认使用 `${displayText}` 直接显示后端文本
- 保留 `subtitle_tpl` 支持，向后兼容旧配置

---

#### 3. 配置简化

**新版配置** (`header_dynamic_example.json`):
```json
{
    "title": "住房公积金贷后风险",
    "subtitle_api": "/api/demo/header-info"
}
```

**移除字段**:
- ❌ `subtitle_tpl` - 不再需要前端配置文字模板
- ❌ `subtitle_api_adaptor` - 不再需要前端数据适配

**保留字段**:
- ✅ `subtitle_api` - API 地址
- ✅ `subtitle_api_method` - 请求方法（可选，默认 GET）
- ✅ 样式配置 - 颜色、字体大小等

---

## 🔄 迁移指南

### 从旧版迁移

**旧版配置**:
```json
{
    "subtitle_api": "/api/demo/header-info",
    "subtitle_tpl": "数据更新时间: ${updateTime} | 覆盖范围: 全市在贷客户 ${customerCount} 人"
}
```

**新版配置**:
```json
{
    "subtitle_api": "/api/demo/header-info"
}
```

只需删除 `subtitle_tpl` 即可！模板会自动使用后端返回的 `displayText`。

---

## 💡 使用场景

### 场景 1: 简单使用（推荐）

直接使用后端返回的 displayText，无需任何配置：

```json
{
    "title": "页面标题",
    "subtitle_api": "/api/demo/header-info"
}
```

### 场景 2: 自定义格式（高级）

如果需要自定义显示格式，仍可使用 `subtitle_tpl`：

```json
{
    "title": "页面标题",
    "subtitle_api": "/api/demo/header-info",
    "subtitle_tpl": "更新: ${updateTime} | 客户: ${customerCount}"
}
```

---

## 📊 对比总结

| 特性 | 旧版 | 新版 |
|------|------|------|
| 文字内容控制 | 前端配置 | 后端生成 ✅ |
| 配置复杂度 | 需要 subtitle_tpl | 无需配置 ✅ |
| 灵活性 | 前端固定 | 后端动态 ✅ |
| 国际化支持 | 困难 | 易于实现 ✅ |
| 向后兼容 | - | 完全兼容 ✅ |

---

## ⚙️ 技术细节

### 后端实现

```javascript
const displayText = `数据更新时间: ${updateTime} | 覆盖范围: 全市在贷客户 ${customerCountFormatted} 人，抵押房产 ${houseCountFormatted} 套`;

res.json({
    data: {
        displayText: displayText,  // 新增字段
        updateTime: updateTime,
        customerCount: customerCountFormatted,
        houseCount: houseCountFormatted
    }
});
```

### 前端模板逻辑

1. 检查配置中是否有 `subtitle_tpl`
2. 如果有：使用自定义模板格式化
3. 如果无：直接显示 `${displayText}`

---

**版本**: v2.0  
**更新**: 2025-12-15
