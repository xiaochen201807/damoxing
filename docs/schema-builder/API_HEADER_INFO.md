# Header API 接口文档

## 接口信息

**接口地址**: `/api/demo/header-info`  
**请求方法**: GET  
**接口说明**: 获取页面头部统计信息

---

## 请求参数

无需参数

---

## 响应示例

```json
{
    "status": 0,
    "msg": "success",
    "data": {
        "updateTime": "2025/12/15 16:55:23",
        "customerCount": "9",
        "houseCount": "6",
        "highRiskCount": 3,
        "mediumRiskCount": 3,
        "lowRiskCount": 3
    }
}
```

---

## 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | number | 状态码，0 表示成功 |
| `msg` | string | 消息说明 |
| `data` | object | 数据对象 |
| `data.updateTime` | string | 数据更新时间（实时生成） |
| `data.customerCount` | string | 客户总数（带千位分隔符） |
| `data.houseCount` | string | 房产总数（带千位分隔符） |
| `data.highRiskCount` | number | 高风险客户数 |
| `data.mediumRiskCount` | number | 中风险客户数 |
| `data.lowRiskCount` | number | 低风险客户数 |

---

## 使用示例

### 在 AMIS Schema Builder 配置中使用

**配置文件** (`header_dynamic_example.json`):
```json
{
    "title": "住房公积金贷后风险",
    "subtitle_api": "/api/demo/header-info",
    "subtitle_tpl": "数据更新时间: ${updateTime} | 覆盖范围: 全市在贷客户 ${customerCount} 人，抵押房产 ${houseCount} 套"
}
```

**页面模板**:
```jinja2
{
    "type": "page",
    {% include 'components/header.j2' %},
    "body": [
        {% include 'components/subtitle_service.j2' %},
        ...
    ]
}
```

---

## 数据说明

1. **实时更新**: `updateTime` 字段每次请求都会返回当前服务器时间
2. **数据来源**: 基于 demo 模拟数据（`mockData`）计算
3. **格式化**: 数字自动添加千位分隔符，便于阅读
4. **扩展性**: 返回额外的风险分类统计，可用于其他场景

---

## 注意事项

⚠️ **这是演示接口**，使用模拟数据。生产环境应替换为真实的数据库查询。

---

**创建时间**: 2025-12-15  
**接口版本**: v1.0
