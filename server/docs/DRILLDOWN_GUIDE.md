# 二级钻取功能配置指南

多层钻取可以让用户从图表点击到第一层清册，再从第一层清册的操作列点击到第二层清册。

## 📊 完整示例：客户风险分析 → 风险清册 → 风险详情

### 架构流程

```
柱状图（月度风险统计）
    ↓ 点击柱子
第一层清册（该月的客户风险列表）
    ↓ 点击"查看详情"按钮
第二层清册（客户的风险明细记录）
```

---

## 🎯 第一步：配置带操作列的图表

### MCP 配置（完整版）

```json
{
  "component_id": "chart_with_ai",
  "params": {
    "chart_type": "bar",
    "title": "月度风险客户统计",
    "api_url": "/api/demo/chart/risk-bar-post",
    "api_method": "post",
    "height": 400,
    
    "drilldown_api": "/api/demo/bar-risk-list-post",
    "drilldown_method": "post",
    "drilldown_columns": [
      { 
        "name": "id", 
        "label": "ID", 
        "width": 60 
      },
      { 
        "name": "customer_name", 
        "label": "客户名称" 
      },
      { 
        "name": "risk_score", 
        "label": "风险评分", 
        "type": "number" 
      },
      { 
        "name": "risk_level", 
        "label": "风险等级",
        "type": "mapping",
        "map": {
          "high": "<span class='label label-danger'>高风险</span>",
          "medium": "<span class='label label-warning'>中风险</span>",
          "low": "<span class='label label-success'>低风险</span>"
        }
      },
      {
        "type": "operation",
        "label": "操作",
        "width": 150,
        "buttons": [
          {
            "type": "button",
            "label": "查看详情",
            "level": "link",
            "actionType": "dialog",
            "dialog": {
              "title": "${customer_name} - 风险明细",
              "size": "xl",
              "closeOnEsc": true,
              "actions": [
                {
                  "type": "button",
                  "label": "关闭",
                  "actionType": "close"
                }
              ],
              "body": {
                "type": "service",
                "api": {
                  "method": "post",
                  "url": "/api/demo/customer-risk-detail-post",
                  "data": {
                    "customerId": "${id}",
                    "customerName": "${customer_name}"
                  }
                },
                "body": {
                  "type": "crud",
                  "syncLocation": false,
                  "api": {
                    "method": "post",
                    "url": "/api/demo/customer-risk-detail-post",
                    "data": {
                      "&": "$$"
                    }
                  },
                  "perPageAvailable": [10, 20, 50],
                  "perPage": 10,
                  "columns": [
                    { 
                      "name": "id", 
                      "label": "记录ID", 
                      "width": 60 
                    },
                    { 
                      "name": "risk_type", 
                      "label": "风险类型" 
                    },
                    { 
                      "name": "risk_description", 
                      "label": "风险描述" 
                    },
                    { 
                      "name": "occur_date", 
                      "label": "发生日期", 
                      "type": "date" 
                    },
                    { 
                      "name": "severity", 
                      "label": "严重程度", 
                      "type": "mapping",
                      "map": {
                        "1": "<span class='label label-success'>轻微</span>",
                        "2": "<span class='label label-warning'>一般</span>",
                        "3": "<span class='label label-danger'>严重</span>"
                      }
                    },
                    { 
                      "name": "status", 
                      "label": "处理状态",
                      "type": "mapping",
                      "map": {
                        "pending": "<span class='label label-warning'>待处理</span>",
                        "processing": "<span class='label label-info'>处理中</span>",
                        "resolved": "<span class='label label-success'>已解决</span>"
                      }
                    }
                  ]
                }
              }
            }
          },
          {
            "type": "button",
            "label": "查看报告",
            "level": "link",
            "actionType": "dialog",
            "dialog": {
              "title": "${customer_name} - 风险报告",
              "size": "lg",
              "body": {
                "type": "service",
                "api": {
                  "method": "post",
                  "url": "/api/demo/customer-risk-report-post",
                  "data": {
                    "customerId": "${id}"
                  }
                },
                "body": [
                  {
                    "type": "html",
                    "html": "${report_content | raw}"
                  }
                ]
              }
            }
          }
        ]
      }
    ]
  }
}
```

---

## 🔧 配置说明

### 关键配置点

#### 1. **操作列配置**

```json
{
  "type": "operation",
  "label": "操作",
  "width": 150,
  "buttons": [...]
}
```

- `type: "operation"` - 标识这是一个操作列
- `width` - 列宽度
- `buttons` - 操作按钮数组

#### 2. **第二层清册弹窗**

```json
{
  "type": "button",
  "label": "查看详情",
  "actionType": "dialog",
  "dialog": {
    "title": "${customer_name} - 风险明细",
    "body": {
      "type": "service",
      "api": {
        "url": "/api/demo/customer-risk-detail-post",
        "data": {
          "customerId": "${id}",
          "customerName": "${customer_name}"
        }
      },
      "body": {
        "type": "crud",
        ...
      }
    }
  }
}
```

**要点**：
- ✅ `${id}`, `${customer_name}` - 引用当前行数据
- ✅ `type: "service"` - 异步加载数据
- ✅ `type: "crud"` - 显示表格

---

## 📡 后端 API 实现

### API 1: 图表数据（第0层）

**路径**: `POST /api/demo/chart/risk-bar-post`

```javascript
router.post('/chart/risk-bar-post', (req, res) => {
    res.json({
        status: 0,
        data: {
            xAxis: {
                type: 'category',
                data: ['1月', '2月', '3月', '4月', '5月', '6月']
            },
            yAxis: {
                type: 'value',
                name: '风险客户数'
            },
            series: [{
                type: 'bar',
                data: [
                    { value: 12, itemId: '2024-01', name: '1月' },
                    { value: 19, itemId: '2024-02', name: '2月' },
                    { value: 15, itemId: '2024-03', name: '3月' },
                    { value: 22, itemId: '2024-04', name: '4月' },
                    { value: 18, itemId: '2024-05', name: '5月' },
                    { value: 25, itemId: '2024-06', name: '6月' }
                ]
            }]
        }
    });
});
```

### API 2: 第一层清册（客户列表）

**路径**: `POST /api/demo/bar-risk-list-post`

```javascript
router.post('/bar-risk-list-post', (req, res) => {
    const { selectedId } = req.body; // 例如: "2024-01"
    
    // 根据月份返回该月的客户数据
    const customers = [
        { 
            id: 'C001', 
            customer_name: '张三公司', 
            risk_score: 85, 
            risk_level: 'high' 
        },
        { 
            id: 'C002', 
            customer_name: '李四企业', 
            risk_score: 65, 
            risk_level: 'medium' 
        },
        { 
            id: 'C003', 
            customer_name: '王五集团', 
            risk_score: 45, 
            risk_level: 'low' 
        }
    ];
    
    res.json({
        status: 0,
        data: {
            items: customers,
            total: customers.length
        }
    });
});
```

### API 3: 第二层清册（风险明细）

**路径**: `POST /api/demo/customer-risk-detail-post`

```javascript
router.post('/customer-risk-detail-post', (req, res) => {
    const { customerId } = req.body; // 例如: "C001"
    
    // 返回该客户的风险明细记录
    const riskDetails = [
        {
            id: 'R001',
            risk_type: '逾期未缴存',
            risk_description: '连续3个月未按时缴存公积金',
            occur_date: '2024-01-15',
            severity: 3,
            status: 'pending'
        },
        {
            id: 'R002',
            risk_type: '缴存基数异常',
            risk_description: '缴存基数突然下降50%',
            occur_date: '2024-02-10',
            severity: 2,
            status: 'processing'
        },
        {
            id: 'R003',
            risk_type: '贷后断缴',
            risk_description: '贷款发放后立即停缴',
            occur_date: '2024-03-05',
            severity: 3,
            status: 'resolved'
        }
    ];
    
    res.json({
        status: 0,
        data: {
            items: riskDetails,
            total: riskDetails.length
        }
    });
});
```

---

## 🎨 高级配置示例

### 场景1: 带条件筛选的二级钻取

```json
{
  "type": "operation",
  "buttons": [
    {
      "label": "查看高风险",
      "dialog": {
        "body": {
          "type": "service",
          "api": {
            "url": "/api/demo/customer-risk-detail-post",
            "data": {
              "customerId": "${id}",
              "riskLevel": "high"  // 只查看高风险
            }
          }
        }
      }
    }
  ]
}
```

### 场景2: 三级钻取（清册 → 清册 → 详情页）

在第二层清册中再添加操作列：

```json
{
  "columns": [
    { "name": "id", "label": "记录ID" },
    { "name": "risk_type", "label": "风险类型" },
    {
      "type": "operation",
      "buttons": [
        {
          "label": "详细信息",
          "actionType": "dialog",
          "dialog": {
            "body": {
              "type": "service",
              "api": {
                "url": "/api/demo/risk-full-detail",
                "data": {
                  "riskId": "${id}"
                }
              }
            }
          }
        }
      ]
    }
  ]
}
```

### 场景3: 操作按钮带确认

```json
{
  "type": "button",
  "label": "标记已处理",
  "level": "primary",
  "actionType": "ajax",
  "confirmText": "确定要将 ${customer_name} 的风险标记为已处理吗？",
  "api": {
    "method": "post",
    "url": "/api/demo/mark-risk-resolved",
    "data": {
      "customerId": "${id}"
    }
  }
}
```

---

## ✅ 完整测试清单

### 1. 测试第一层钻取
- [ ] 点击柱状图，弹出第一层清册
- [ ] 第一层清册数据正确
- [ ] 操作列显示正常

### 2. 测试第二层钻取
- [ ] 点击"查看详情"按钮
- [ ] 第二层弹窗标题正确（显示客户名）
- [ ] 第二层清册数据正确
- [ ] 第二层清册分页正常

### 3. 测试数据传递
- [ ] `customerId` 正确传递到第二层API
- [ ] `${customer_name}` 变量在标题中正确显示
- [ ] 第二层API能接收到正确参数

### 4. 测试UI交互
- [ ] 关闭按钮正常工作
- [ ] 多个弹窗可以叠加显示
- [ ] 关闭弹窗后状态正确恢复

---

## 🚀 快速开始

1. **复制 MCP 配置** - 使用上面的完整配置
2. **添加 API 端点** - 在 `demo-chart.js` 中添加三个 API
3. **测试** - 访问页面并依次点击测试

完整示例已包含所有必要配置！🎉
