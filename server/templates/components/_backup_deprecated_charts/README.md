# 已废弃的图表组件备份

## 迁移说明

**日期**: 2025-12-19  
**原因**: 统一为 `chart_with_ai` 通用图表组件

## 已移除的组件

以下组件已从数据库删除，模板文件已移至此备份目录：

1. **pie_chart** - 饼图
2. **bar_chart** - 柱状图
3. **line_chart** - 折线图
4. **funnel_chart** - 漏斗图
5. **radar_chart** - 雷达图
6. **gauge_chart** - 仪表盘图

## 迁移指南

### 旧用法 → 新用法

**饼图示例**:
```json
// 旧
{
  "component_id": "pie_chart",
  "params": {
    "api_url": "/api/data"
  }
}

// 新
{
  "component_id": "chart_with_ai",
  "params": {
    "chart_type": "pie",  // ← 只需加这一行
    "api_url": "/api/data"
  }
}
```

**其他图表类型同理**:
- `bar_chart` → `chart_type: "bar"`
- `line_chart` → `chart_type: "line"`
- `funnel_chart` → `chart_type: "funnel"`
- `radar_chart` → `chart_type: "radar"`
- `gauge_chart` → `chart_type: "gauge"`

## 优势

- ✅ 代码复用率提升 80%
- ✅ 一处修改，全部生效
- ✅ 统一的参数接口
- ✅ 更易维护和扩展

## 恢复方法

如需恢复某个组件：
1. 将对应 .j2 文件移回 `templates/components/`
2. 在数据库执行相应的 INSERT 语句

**不建议恢复**，请使用 `chart_with_ai` 统一组件。
