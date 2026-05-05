# 任务项运行配置工具后端接口对接说明

## 当前状态

`task_config_upgrade` 页面已改为前端 React 渲染，现阶段仍复用 `/api/task_configmock/*` mock 接口。页面上的模板新增、重命名、删除、节点启停等操作目前只在前端内存态生效，刷新页面后不会持久化。

展开/收起交互暂不调整。

## 对接目标

后端需要提供正式接口，支撑以下能力：

- 查询任务项运行配置页面基础数据。
- 按业务关联方、任务项、模板加载节点-要素-内容清册。
- 保存模板列表和当前激活模板。
- 保存模板内的节点启停状态。
- 保存清册行的应用业务、算法参数和配置说明。
- 新增或修改清册项本身的节点、要素、内容、公式、描述和排序。

## 建议接口

### 1. 查询页面初始化数据

`POST /api/task-config/summary`

请求参数：

```json
{
    "relatedParty": "person",
    "task": "tq"
}
```

返回数据：

```json
{
    "status": 0,
    "msg": "ok",
    "data": {
        "templates": [
            { "id": "tpl-1", "name": "统建版" }
        ],
        "activeTemplateId": "tpl-1",
        "relatedParties": [],
        "taskTypes": [],
        "businessOptions": [],
        "parameterOptions": [],
        "taskPathText": "缴存人 / 提取服务 / 提取服务 / 提取"
    }
}
```

### 2. 查询清册

`POST /api/task-config/rows`

请求参数：

```json
{
    "relatedParty": "person",
    "task": "tq",
    "templateId": "tpl-1"
}
```

返回数据：

```json
{
    "status": 0,
    "msg": "ok",
    "data": {
        "items": [
            {
                "id": "tq-verify-identity-role-1",
                "task": "tq",
                "nodeKey": "verify-identity",
                "nodeTitle": "核实身份",
                "nodeEnabled": true,
                "groupId": "verify-identity-role",
                "elementTitle": "角色",
                "objectName": "综合柜员",
                "formula": "业务受理与规则校验",
                "description": "核实身份环节默认办理角色",
                "appliedBusinesses": ["purchase"],
                "algorithmParamGroups": [],
                "remarks": ""
            }
        ]
    }
}
```

### 3. 新增模板

`POST /api/task-config/templates`

请求参数：

```json
{
    "relatedParty": "person",
    "task": "tq",
    "name": "新版模板",
    "copyFromTemplateId": "tpl-1"
}
```

说明：

- 建议默认从当前模板复制一份配置，避免新增后出现空清册。
- 返回新模板 `id` 和 `name`。

### 4. 重命名模板

`PUT /api/task-config/templates/:templateId`

请求参数：

```json
{
    "name": "省会版"
}
```

### 5. 删除模板

`DELETE /api/task-config/templates/:templateId`

约束：

- 至少保留一个模板。
- 如果删除的是当前激活模板，后端应返回新的 `activeTemplateId`。

返回数据：

```json
{
    "status": 0,
    "msg": "删除成功",
    "data": {
        "activeTemplateId": "tpl-1",
        "templates": []
    }
}
```

### 6. 切换当前模板

`POST /api/task-config/templates/:templateId/activate`

请求参数：

```json
{
    "relatedParty": "person",
    "task": "tq"
}
```

### 7. 保存节点启停

`POST /api/task-config/templates/:templateId/nodes/:nodeKey/enabled`

请求参数：

```json
{
    "enabled": true
}
```

### 8. 保存清册行配置

`POST /api/task-config/rows/:rowId/config`

请求参数：

```json
{
    "templateId": "tpl-1",
    "task": "tq",
    "appliedBusinesses": ["purchase", "build"],
    "algorithmParamGroups": [
        {
            "paramName": "depositMonths",
            "businessStandardValue": "连续足额缴存 6 个月",
            "valueSource": "业务标准库"
        }
    ],
    "remarks": "配置说明"
}
```

说明：

- 该接口只保存某一行在当前模板下的配置关系，不修改清册项定义本身。
- 适用于当前页面齿轮按钮里的“配置应用业务”弹窗。

### 9. 新增或修改清册项

`POST /api/task-config/rows/save`

请求参数：

```json
{
    "id": "tq-verify-identity-role-1",
    "relatedParty": "person",
    "task": "tq",
    "templateId": "tpl-1",
    "nodeKey": "verify-identity",
    "nodeTitle": "核实身份",
    "groupId": "verify-identity-role",
    "elementTitle": "角色",
    "objectName": "综合柜员",
    "formula": "业务受理与规则校验",
    "description": "核实身份环节默认办理角色",
    "sortNo": 10,
    "enabled": true,
    "appliedBusinesses": ["purchase", "build"],
    "algorithmParamGroups": [
        {
            "paramName": "depositMonths",
            "businessStandardValue": "连续足额缴存 6 个月",
            "valueSource": "业务标准库"
        }
    ],
    "remarks": "配置说明"
}
```

返回数据：

```json
{
    "status": 0,
    "msg": "保存成功",
    "data": {
        "id": "tq-verify-identity-role-1",
        "task": "tq",
        "nodeKey": "verify-identity",
        "nodeTitle": "核实身份",
        "nodeEnabled": true,
        "groupId": "verify-identity-role",
        "elementTitle": "角色",
        "objectName": "综合柜员",
        "formula": "业务受理与规则校验",
        "description": "核实身份环节默认办理角色",
        "appliedBusinesses": ["purchase", "build"],
        "algorithmParamGroups": [],
        "remarks": ""
    }
}
```

说明：

- `id` 为空或不传时表示新增清册项；传 `id` 时表示修改已有清册项。
- 该接口保存清册项定义本身，同时允许携带当前模板下的应用业务、算法参数和备注，便于新增后立即完成配置。
- 后端建议按 `relatedParty + task + templateId + nodeKey + elementTitle` 做范围校验，避免跨任务项、跨模板误改。
- 返回完整 `TaskRow`，前端可直接按 `id` 替换当前行；新增时可插入到对应 `groupId` 的清册列表中。

## 前端切换点

后续正式对接时，主要替换 `TaskConfigUpgrade.tsx` 中这些内存态逻辑：

- `setTemplates(...)` 改为调用模板新增、重命名、删除接口。
- `selectTemplate(...)` 改为调用激活模板接口，并重新加载清册。
- `updateNodeEnabled(...)` 改为保存节点启停接口。
- `saveConfigModal(...)` 改为正式清册行配置保存接口。
- 后续如果页面增加“新增清册项 / 编辑清册项”入口，对接 `POST /api/task-config/rows/save`。

接口仍建议保持 `status/msg/data` 统一响应格式，便于沿用现有 `fetcher` 处理链路。
