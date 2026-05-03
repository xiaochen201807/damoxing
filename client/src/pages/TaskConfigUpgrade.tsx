import { useEffect, useMemo, useState } from 'react';
import { fetcher } from '../utils/fetcher';
import type { ApiResponse } from '../types/api';
import './TaskConfigUpgrade.css';

export interface TaskConfigUpgradeConfig {
  task_config_summary_api?: string;
  task_config_rows_api?: string;
  task_config_business_options_api?: string;
  task_config_group_options_api?: string;
  task_config_save_api?: string;
  default_task?: string;
  default_related_party?: string;
}

interface TaskConfigUpgradeProps {
  title?: string;
  config?: TaskConfigUpgradeConfig;
}

interface SelectOption {
  label: string;
  value: string;
  parties?: string[];
}

interface TemplateOption {
  id: string;
  name: string;
}

interface AlgorithmParamGroup {
  paramName: string;
  businessStandardValue: string;
  valueSource: string;
}

interface TaskRow {
  id: string;
  task: string;
  nodeKey: string;
  nodeTitle: string;
  nodeEnabled: boolean;
  groupId: string;
  elementTitle: string;
  objectName?: string;
  formula?: string;
  description?: string;
  appliedBusinesses?: string[];
  algorithmParamGroups?: AlgorithmParamGroup[];
  remarks?: string;
}

interface TaskGroup {
  id: string;
  task: string;
  nodeKey: string;
  nodeTitle: string;
  nodeEnabled: boolean;
  elementTitle: string;
  rows: TaskRow[];
}

interface CatalogItem {
  key: string;
  title: string;
  groupId: string;
  rowCount: number;
}

interface CatalogNode {
  key: string;
  title: string;
  enabled: boolean;
  items: CatalogItem[];
}

interface SummaryData {
  templates?: Array<{ label?: string; name?: string; value?: string; id?: string }>;
  activeTemplateId?: string;
  relatedParties?: SelectOption[];
  taskTypes?: SelectOption[];
  parameterOptions?: SelectOption[];
  businessOptions?: SelectOption[];
  taskPathText?: string;
  totalNodes?: number;
  totalElements?: number;
  configuredCount?: number;
  parameterCount?: number;
}

interface RowsData {
  items?: TaskRow[];
}

interface SelectionState {
  nodeKey: string;
  itemKey: string;
}

interface ModalContext {
  group: TaskGroup;
  row: TaskRow;
}

const DEFAULT_CONFIG = {
  summaryApi: '/api/task_configmock/summary',
  rowsApi: '/api/task_configmock/rows',
  saveApi: '/api/task_configmock/save-business-config',
  defaultTask: 'tq',
  defaultRelatedParty: 'person'
};

const DEFAULT_RELATED_PARTIES: SelectOption[] = [
  { label: '缴存人', value: 'person' },
  { label: '缴存单位', value: 'unit' },
  { label: '开发商', value: 'developer' }
];

const DEFAULT_TASK_TYPES: SelectOption[] = [
  { label: '缴存', value: 'jc', parties: ['person', 'unit'] },
  { label: '提取', value: 'tq', parties: ['person'] },
  { label: '贷款', value: 'dk', parties: ['person', 'developer'] },
  { label: '还款', value: 'hk', parties: ['person'] }
];

const UNAPPLIED_VALUE = '__unapplied__';

function normalizeTemplates(items?: SummaryData['templates']): TemplateOption[] {
  const templates = (items || [])
    .map(item => ({
      id: String(item.value || item.id || ''),
      name: String(item.label || item.name || '')
    }))
    .filter(item => item.id && item.name);

  return templates.length
    ? templates
    : [
        { id: 'tpl-1', name: '统建版' },
        { id: 'tpl-2', name: '省会版' },
        { id: 'tpl-3', name: '地级市版' },
        { id: 'tpl-4', name: '行业版' },
        { id: 'tpl-5', name: '基础贯标版' }
      ];
}

function normalizeRows(items?: TaskRow[]): TaskRow[] {
  return (items || []).map(row => ({
    ...row,
    nodeEnabled: row.nodeEnabled !== false,
    appliedBusinesses: Array.isArray(row.appliedBusinesses) ? row.appliedBusinesses : [],
    algorithmParamGroups: Array.isArray(row.algorithmParamGroups) ? row.algorithmParamGroups : []
  }));
}

function buildGroups(rows: TaskRow[], nodeEnabledMap: Record<string, boolean>): TaskGroup[] {
  const groupMap = new Map<string, TaskGroup>();

  rows.forEach(row => {
    const nodeEnabled = Object.prototype.hasOwnProperty.call(nodeEnabledMap, row.nodeKey)
      ? nodeEnabledMap[row.nodeKey]
      : row.nodeEnabled !== false;
    const normalizedRow = { ...row, nodeEnabled };
    const existing = groupMap.get(row.groupId);

    if (existing) {
      existing.rows.push(normalizedRow);
      existing.nodeEnabled = nodeEnabled;
      return;
    }

    groupMap.set(row.groupId, {
      id: row.groupId,
      task: row.task,
      nodeKey: row.nodeKey,
      nodeTitle: row.nodeTitle,
      nodeEnabled,
      elementTitle: row.elementTitle,
      rows: [normalizedRow]
    });
  });

  return Array.from(groupMap.values());
}

function buildCatalog(groups: TaskGroup[]): CatalogNode[] {
  const nodeMap = new Map<string, CatalogNode>();

  groups.forEach(group => {
    const existing = nodeMap.get(group.nodeKey);
    const item = {
      key: group.id,
      title: group.elementTitle,
      groupId: group.id,
      rowCount: group.rows.length
    };

    if (existing) {
      existing.items.push(item);
      existing.enabled = group.nodeEnabled;
      return;
    }

    nodeMap.set(group.nodeKey, {
      key: group.nodeKey,
      title: group.nodeTitle,
      enabled: group.nodeEnabled,
      items: [item]
    });
  });

  return Array.from(nodeMap.values());
}

function itemStateKey(nodeKey: string, itemKey: string): string {
  return `${nodeKey}::${itemKey}`;
}

function hashTemplateNode(templateId: string, nodeKey: string): boolean {
  const hash = `${templateId}${nodeKey}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % 3 !== 0;
}

function getUsageTagClass(label: string): string {
  if (/提取|购房|租房/.test(label)) {
    return 'tag tag-withdraw';
  }

  if (/贷款|首套|组合|还款/.test(label)) {
    return 'tag tag-loan';
  }

  return 'tag tag-manage';
}

function getDefaultParamGroup(): AlgorithmParamGroup {
  return {
    paramName: '',
    businessStandardValue: '',
    valueSource: ''
  };
}

function cleanParamGroups(groups: AlgorithmParamGroup[]): AlgorithmParamGroup[] {
  return groups
    .map(group => ({
      paramName: group.paramName.trim(),
      businessStandardValue: group.businessStandardValue.trim(),
      valueSource: group.valueSource.trim()
    }))
    .filter(group => group.paramName || group.businessStandardValue || group.valueSource);
}

async function postApi<T>(url: string, data: Record<string, unknown>): Promise<T> {
  const response = await fetcher<ApiResponse<T>>({
    url,
    method: 'post',
    data
  });
  const body = response.data;

  if (!body || body.status !== 0) {
    throw new Error(body?.msg || body?.error || '请求失败');
  }

  return body.data as T;
}

const TaskConfigUpgrade = ({ title = '任务项运行配置工具', config }: TaskConfigUpgradeProps) => {
  const summaryApi = config?.task_config_summary_api || DEFAULT_CONFIG.summaryApi;
  const rowsApi = config?.task_config_rows_api || DEFAULT_CONFIG.rowsApi;
  const saveApi = config?.task_config_save_api || DEFAULT_CONFIG.saveApi;
  const defaultTask = config?.default_task || DEFAULT_CONFIG.defaultTask;
  const defaultRelatedParty = config?.default_related_party || DEFAULT_CONFIG.defaultRelatedParty;

  const [relatedParty, setRelatedParty] = useState(defaultRelatedParty);
  const [task, setTask] = useState(defaultTask);
  const [businessFilter, setBusinessFilter] = useState('');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>(normalizeTemplates());
  const [activeTemplateId, setActiveTemplateId] = useState('tpl-1');
  const [nodeEnabledByTask, setNodeEnabledByTask] = useState<Record<string, Record<string, boolean>>>({});
  const [expandedNodesByTask, setExpandedNodesByTask] = useState<Record<string, string[]>>({});
  const [expandedItemsByTask, setExpandedItemsByTask] = useState<Record<string, string[]>>({});
  const [selectionByTask, setSelectionByTask] = useState<Record<string, SelectionState>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalContext, setModalContext] = useState<ModalContext | null>(null);
  const [draftBusinesses, setDraftBusinesses] = useState<string[]>([]);
  const [draftParamGroups, setDraftParamGroups] = useState<AlgorithmParamGroup[]>([getDefaultParamGroup()]);
  const [draftRemarks, setDraftRemarks] = useState('');

  const showMessage = (text: string, timeout = 0) => {
    setMessage(text);
    if (timeout > 0) {
      window.setTimeout(() => {
        setMessage(current => (current === text ? '' : current));
      }, timeout);
    }
  };

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    Promise.all([
      postApi<SummaryData>(summaryApi, { task, relatedParty }),
      postApi<RowsData>(rowsApi, {
        task,
        relatedParty,
        page: 1,
        perPage: 5000
      })
    ])
      .then(([summaryData, rowsData]) => {
        if (cancelled) {
          return;
        }

        const nextRows = normalizeRows(rowsData.items);
        const nextTemplates = normalizeTemplates(summaryData.templates);
        const initialNodeState = nextRows.reduce<Record<string, boolean>>((acc, row) => {
          if (!Object.prototype.hasOwnProperty.call(acc, row.nodeKey)) {
            acc[row.nodeKey] = row.nodeEnabled !== false;
          }
          return acc;
        }, {});

        setSummary(summaryData);
        setRows(nextRows);
        setTemplates(nextTemplates);
        setActiveTemplateId(current => (
          nextTemplates.some(item => item.id === current)
            ? current
            : summaryData.activeTemplateId || nextTemplates[0]?.id || 'tpl-1'
        ));
        setNodeEnabledByTask(current => (
          current[task] ? current : { ...current, [task]: initialNodeState }
        ));
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || '加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [summaryApi, rowsApi, relatedParty, task]);

  const relatedPartyOptions = summary?.relatedParties?.length ? summary.relatedParties : DEFAULT_RELATED_PARTIES;
  const taskTypeOptions = summary?.taskTypes?.length ? summary.taskTypes : DEFAULT_TASK_TYPES;
  const visibleTaskOptions = useMemo(() => (
    taskTypeOptions.filter(item => !relatedParty || !item.parties?.length || item.parties.includes(relatedParty))
  ), [relatedParty, taskTypeOptions]);

  useEffect(() => {
    if (visibleTaskOptions.length && !visibleTaskOptions.some(item => item.value === task)) {
      setTask(visibleTaskOptions[0].value);
    }
  }, [task, visibleTaskOptions]);

  const nodeEnabledMap = useMemo(() => nodeEnabledByTask[task] || {}, [nodeEnabledByTask, task]);
  const groups = useMemo(() => buildGroups(rows, nodeEnabledMap), [nodeEnabledMap, rows]);
  const catalogNodes = useMemo(() => buildCatalog(groups), [groups]);
  const catalogSignature = useMemo(() => (
    catalogNodes.map(node => `${node.key}:${node.items.map(item => item.key).join(',')}`).join('|')
  ), [catalogNodes]);

  useEffect(() => {
    if (!catalogNodes.length) {
      return;
    }

    const firstNode = catalogNodes[0];
    const firstItem = firstNode.items[0];

    setSelectionByTask(current => {
      const selected = current[task];
      const selectedNode = catalogNodes.find(node => node.key === selected?.nodeKey) || firstNode;
      const selectedItem = selectedNode.items.find(item => item.key === selected?.itemKey) || selectedNode.items[0] || firstItem;

      if (selected?.nodeKey === selectedNode.key && selected?.itemKey === selectedItem.key) {
        return current;
      }

      return {
        ...current,
        [task]: {
          nodeKey: selectedNode.key,
          itemKey: selectedItem.key
        }
      };
    });

    setExpandedNodesByTask(current => (
      current[task]?.length ? current : { ...current, [task]: [firstNode.key] }
    ));

    if (firstItem) {
      setExpandedItemsByTask(current => (
        current[task]?.length ? current : { ...current, [task]: [itemStateKey(firstNode.key, firstItem.key)] }
      ));
    }
  }, [catalogNodes, catalogSignature, task]);

  const businessOptions = useMemo(() => summary?.businessOptions || [], [summary?.businessOptions]);
  const parameterOptions = summary?.parameterOptions || [];
  const businessLabelMap = useMemo(() => (
    businessOptions.reduce<Record<string, string>>((acc, item) => {
      acc[item.value] = item.label;
      return acc;
    }, {})
  ), [businessOptions]);

  const filterBusinessOptions = useMemo(() => [
    { label: '全部应用业务', value: '' },
    ...businessOptions,
    { label: '未配置', value: UNAPPLIED_VALUE }
  ], [businessOptions]);

  const expandedNodeKeys = expandedNodesByTask[task] || [];
  const expandedItemKeys = expandedItemsByTask[task] || [];
  const selection = selectionByTask[task] || { nodeKey: catalogNodes[0]?.key || '', itemKey: catalogNodes[0]?.items[0]?.key || '' };
  const allExpanded = catalogNodes.length > 0 && catalogNodes.every(node => (
    expandedNodeKeys.includes(node.key) && node.items.every(item => expandedItemKeys.includes(itemStateKey(node.key, item.key)))
  ));
  const statusText = summary?.taskPathText || '缴存人 / 提取服务 / 提取服务 / 提取';

  const updateNodeEnabled = (nodeKey: string, enabled: boolean) => {
    setNodeEnabledByTask(current => ({
      ...current,
      [task]: {
        ...(current[task] || {}),
        [nodeKey]: enabled
      }
    }));
    setRows(current => current.map(row => (
      row.nodeKey === nodeKey ? { ...row, nodeEnabled: enabled } : row
    )));
    showMessage(enabled ? '流程节点已启用。' : '流程节点已停用，清册内容保留为只读。', 2200);
  };

  const toggleAllCatalog = () => {
    if (!catalogNodes.length) {
      return;
    }

    if (allExpanded) {
      setExpandedNodesByTask(current => ({ ...current, [task]: [] }));
      setExpandedItemsByTask(current => ({ ...current, [task]: [] }));
      return;
    }

    setExpandedNodesByTask(current => ({
      ...current,
      [task]: catalogNodes.map(node => node.key)
    }));
    setExpandedItemsByTask(current => ({
      ...current,
      [task]: catalogNodes.flatMap(node => node.items.map(item => itemStateKey(node.key, item.key)))
    }));
  };

  const selectNode = (node: CatalogNode) => {
    const current = selectionByTask[task];
    const isSameNode = current?.nodeKey === node.key;
    const firstItem = node.items[0];

    setSelectionByTask(prev => ({
      ...prev,
      [task]: {
        nodeKey: node.key,
        itemKey: isSameNode && current?.itemKey ? current.itemKey : firstItem?.key || ''
      }
    }));

    setExpandedNodesByTask(prev => {
      const currentKeys = prev[task] || [];
      const isExpanded = currentKeys.includes(node.key);
      const nextKeys = isSameNode && isExpanded
        ? currentKeys.filter(key => key !== node.key)
        : Array.from(new Set([...currentKeys, node.key]));
      return { ...prev, [task]: nextKeys };
    });

    if (firstItem) {
      setExpandedItemsByTask(prev => ({
        ...prev,
        [task]: Array.from(new Set([...(prev[task] || []), itemStateKey(node.key, firstItem.key)]))
      }));
    }
  };

  const selectItem = (node: CatalogNode, item: CatalogItem) => {
    const key = itemStateKey(node.key, item.key);
    const isSameItem = selection.nodeKey === node.key && selection.itemKey === item.key;
    const isExpanded = expandedItemKeys.includes(key);

    setSelectionByTask(prev => ({
      ...prev,
      [task]: {
        nodeKey: node.key,
        itemKey: item.key
      }
    }));
    setExpandedNodesByTask(prev => ({
      ...prev,
      [task]: Array.from(new Set([...(prev[task] || []), node.key]))
    }));
    setExpandedItemsByTask(prev => {
      const currentKeys = prev[task] || [];
      const nextKeys = isSameItem && isExpanded
        ? currentKeys.filter(itemKey => itemKey !== key)
        : Array.from(new Set([...currentKeys, key]));
      return { ...prev, [task]: nextKeys };
    });
  };

  const selectTemplate = (templateId: string) => {
    if (templateId === activeTemplateId) {
      return;
    }

    const nextNodeState = catalogNodes.reduce<Record<string, boolean>>((acc, node) => {
      acc[node.key] = hashTemplateNode(templateId, node.key);
      return acc;
    }, {});
    const template = templates.find(item => item.id === templateId);

    setActiveTemplateId(templateId);
    setNodeEnabledByTask(current => ({
      ...current,
      [task]: {
        ...(current[task] || {}),
        ...nextNodeState
      }
    }));
    setRows(current => current.map(row => (
      Object.prototype.hasOwnProperty.call(nextNodeState, row.nodeKey)
        ? { ...row, nodeEnabled: nextNodeState[row.nodeKey] }
        : row
    )));
    showMessage(`已加载模板配置：${template?.name || templateId}`, 2200);
  };

  const addTemplate = () => {
    const name = window.prompt('请输入新模板名称：');
    if (!name?.trim()) {
      return;
    }

    const id = `tpl-${Date.now()}`;
    setTemplates(current => [...current, { id, name: name.trim() }]);
    setActiveTemplateId(id);
    showMessage('已新增模板。', 2200);
  };

  const renameTemplate = (templateId: string) => {
    const template = templates.find(item => item.id === templateId);
    if (!template) {
      return;
    }

    const name = window.prompt('重命名模板：', template.name);
    if (!name?.trim()) {
      return;
    }

    setTemplates(current => current.map(item => (
      item.id === templateId ? { ...item, name: name.trim() } : item
    )));
    showMessage('模板名称已更新。', 2200);
  };

  const deleteTemplate = (templateId: string) => {
    if (templates.length <= 1) {
      window.alert('请至少保留一个模板。');
      return;
    }

    const template = templates.find(item => item.id === templateId);
    if (!window.confirm(`确定要删除模板 "${template?.name || templateId}" 吗？`)) {
      return;
    }

    setTemplates(current => current.filter(item => item.id !== templateId));
    if (activeTemplateId === templateId) {
      const nextTemplate = templates.find(item => item.id !== templateId);
      setActiveTemplateId(nextTemplate?.id || '');
    }
    showMessage('模板已删除。', 2200);
  };

  const getVisibleRows = (group: TaskGroup) => (
    group.rows.filter(row => {
      const applied = row.appliedBusinesses || [];
      if (!businessFilter) {
        return true;
      }
      if (businessFilter === UNAPPLIED_VALUE) {
        return applied.length === 0;
      }
      return applied.includes(businessFilter);
    })
  );

  const openConfigModal = (group: TaskGroup, row: TaskRow) => {
    if (!group.nodeEnabled) {
      showMessage('当前节点已停用，暂不支持修改业务配置。', 2200);
      return;
    }

    const currentParams = normalizeRows([row])[0].algorithmParamGroups || [];

    setModalContext({ group, row });
    setDraftBusinesses([...(row.appliedBusinesses || [])]);
    setDraftParamGroups(currentParams.length ? currentParams : [getDefaultParamGroup()]);
    setDraftRemarks(row.remarks || '');
  };

  const closeConfigModal = () => {
    if (saving) {
      return;
    }

    setModalContext(null);
    setDraftBusinesses([]);
    setDraftParamGroups([getDefaultParamGroup()]);
    setDraftRemarks('');
  };

  const saveConfigModal = async () => {
    if (!modalContext) {
      return;
    }

    const showAlgorithmParams = modalContext.group.elementTitle !== '内容';
    const payload = {
      id: modalContext.row.id,
      task: modalContext.row.task || task,
      appliedBusinesses: draftBusinesses,
      algorithmParamGroups: showAlgorithmParams ? cleanParamGroups(draftParamGroups) : [],
      remarks: draftRemarks
    };

    setSaving(true);
    try {
      const savedRow = normalizeRows([await postApi<TaskRow>(saveApi, payload)])[0];
      setRows(current => current.map(row => (
        row.id === savedRow.id
          ? { ...row, ...savedRow, nodeEnabled: row.nodeEnabled }
          : row
      )));
      setModalContext(null);
      setDraftBusinesses([]);
      setDraftParamGroups([getDefaultParamGroup()]);
      setDraftRemarks('');
      showMessage(
        draftBusinesses.length
          ? `业务配置已更新，共关联 ${draftBusinesses.length} 个业务。`
          : '业务配置已清空，该清册当前为未使用状态。',
        2600
      );
    } catch (err) {
      showMessage(err instanceof Error ? err.message : '保存失败', 3000);
    } finally {
      setSaving(false);
    }
  };

  const toggleDraftBusiness = (value: string, checked: boolean) => {
    setDraftBusinesses(current => (
      checked
        ? Array.from(new Set([...current, value]))
        : current.filter(item => item !== value)
    ));
  };

  const updateParamGroup = (index: number, patch: Partial<AlgorithmParamGroup>) => {
    setDraftParamGroups(current => current.map((group, groupIndex) => (
      groupIndex === index ? { ...group, ...patch } : group
    )));
  };

  const removeParamGroup = (index: number) => {
    setDraftParamGroups(current => {
      const next = current.filter((_, groupIndex) => groupIndex !== index);
      return next.length ? next : [getDefaultParamGroup()];
    });
  };

  const renderUsage = (row: TaskRow) => {
    const labels = (row.appliedBusinesses || [])
      .map(value => businessLabelMap[value])
      .filter(Boolean);

    if (!labels.length) {
      return <span className="usage-empty">未使用</span>;
    }

    return (
      <div className="usage-list">
        {labels.map(label => (
          <span className={getUsageTagClass(label)} key={label}>{label}</span>
        ))}
      </div>
    );
  };

  const renderActionButton = (group: TaskGroup, row: TaskRow) => (
    <button
      className="icon-button"
      type="button"
      title={group.nodeEnabled ? '业务配置' : '当前节点已停用，暂不可配置'}
      aria-label={group.nodeEnabled ? '业务配置' : '当前节点已停用，暂不可配置'}
      disabled={!group.nodeEnabled}
      onClick={() => openConfigModal(group, row)}
    >
      <i className="fa fa-cog" aria-hidden="true" />
    </button>
  );

  const renderGroupTable = (group: TaskGroup) => {
    const visibleRows = getVisibleRows(group);
    const compactTitle = group.elementTitle;
    const formulaOnly = ['角色', '时效', '待办任务描述', '消息', '任务结果'].includes(compactTitle);
    const attachmentLike = ['业务附件', '凭条'].includes(compactTitle);

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {!formulaOnly && !attachmentLike && <th className="index-cell">序号</th>}
              {!formulaOnly && !attachmentLike && <th className="object-cell">属性所属对象</th>}
              <th>
                {compactTitle === '角色'
                  ? '角色名称'
                  : compactTitle === '时效'
                    ? '时效'
                    : compactTitle === '业务附件'
                      ? '附件名称'
                      : compactTitle === '凭条'
                        ? '凭条名称'
                        : compactTitle === '待办任务描述'
                          ? '待办任务描述'
                          : compactTitle === '消息'
                            ? '消息内容'
                            : compactTitle === '任务结果'
                              ? '任务结果'
                              : '配置项/公式'}
              </th>
              {!formulaOnly && <th>{attachmentLike ? '配置说明' : '描述'}</th>}
              <th className="usage-cell">应用于</th>
              <th className="actions-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((row, index) => (
              <tr key={row.id}>
                {!formulaOnly && !attachmentLike && <td className="index-cell">{index + 1}</td>}
                {!formulaOnly && !attachmentLike && <td className="object-cell">{row.objectName || '-'}</td>}
                <td>{formulaOnly || attachmentLike ? (row.objectName || row.formula || '-') : (row.formula || '-')}</td>
                {!formulaOnly && <td>{row.description || '-'}</td>}
                <td className="usage-cell">{renderUsage(row)}</td>
                <td className="actions-cell">{renderActionButton(group, row)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={formulaOnly ? 3 : attachmentLike ? 4 : 6}>
                  <div className="table-empty-state">当前筛选条件下暂无清册</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="task-config-upgrade">
      <div className="app-wrapper">
        <h1 className="page-title">{title}</h1>

        <section className="panel filter-panel">
          <div className="filter-layout">
            <div className="filter-form">
              <div className="form-item">
                <select
                  value={relatedParty}
                  onChange={event => {
                    setRelatedParty(event.target.value);
                    setBusinessFilter('');
                    showMessage('');
                  }}
                  aria-label="业务关联方"
                >
                  {relatedPartyOptions.map(item => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-item">
                <select
                  value={task}
                  onChange={event => {
                    setTask(event.target.value);
                    setBusinessFilter('');
                    showMessage('');
                  }}
                  aria-label="任务项"
                >
                  {visibleTaskOptions.map(item => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-actions">
              <button
                className="catalog-tree-control-btn status-action-btn"
                type="button"
                disabled={!catalogNodes.length}
                onClick={toggleAllCatalog}
              >
                {allExpanded ? '收起' : '展开'}
              </button>
              <div className="inline-filter">
                <select
                  value={businessFilter}
                  onChange={event => setBusinessFilter(event.target.value)}
                  aria-label="应用于"
                >
                  {filterBusinessOptions.map(item => (
                    <option key={item.value || 'all'} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="panel roster-panel">
          <div className="status-bar">
            <div className="status-main">
              <div className="status-text">{statusText}</div>
            </div>

            <div className="template-selector">
              <span className="template-label">模板：</span>
              <div className="template-list">
                {templates.map(template => (
                  <div
                    className={`template-btn${template.id === activeTemplateId ? ' active' : ''}`}
                    key={template.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectTemplate(template.id)}
                    onDoubleClick={() => renameTemplate(template.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        selectTemplate(template.id);
                      }
                    }}
                  >
                    <span className="tpl-name">{template.name}</span>
                    <span className="template-actions" onClick={event => event.stopPropagation()}>
                      <button
                        className="tpl-action-btn"
                        type="button"
                        title="重命名"
                        aria-label="重命名"
                        onClick={() => renameTemplate(template.id)}
                      >
                        <i className="fa fa-pencil" aria-hidden="true" />
                      </button>
                      <button
                        className="tpl-action-btn"
                        type="button"
                        title="删除"
                        aria-label="删除"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <i className="fa fa-times" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                ))}
                <button className="template-btn add-btn" type="button" title="新增模板" onClick={addTemplate}>+</button>
              </div>
            </div>
          </div>

          <div className="status-tools">
            <div className="message">{message}</div>
          </div>

          {error && <div className="error-state">{error}</div>}
          {loading && <div className="loading-state">正在加载配置清册...</div>}

          {!loading && !error && (
            catalogNodes.length ? (
              <div className="catalog-layout">
                <section className="catalog-column">
                  <div className="catalog-nav">
                    <div className="catalog-tree-head">
                      <span className="catalog-tree-head-title">节点-要素-内容</span>
                    </div>
                    <div className="catalog-tree">
                      {catalogNodes.map(node => {
                        const nodeExpanded = expandedNodeKeys.includes(node.key);
                        const nodeActive = selection.nodeKey === node.key;
                        return (
                          <div
                            className={`catalog-tree-node${nodeActive ? ' active' : ''}${node.enabled ? '' : ' disabled'}`}
                            key={node.key}
                          >
                            <div className="catalog-tree-node-row">
                              <div className="catalog-tree-node-main">
                                <input
                                  type="checkbox"
                                  className="node-toggle-checkbox"
                                  checked={node.enabled}
                                  title="启用/停用节点"
                                  onChange={event => updateNodeEnabled(node.key, event.target.checked)}
                                  onClick={event => event.stopPropagation()}
                                />
                                <button
                                  className="catalog-tree-node-btn"
                                  type="button"
                                  onClick={() => selectNode(node)}
                                >
                                  <span className="catalog-tree-node-text">{node.title}</span>
                                </button>
                              </div>
                            </div>

                            {nodeExpanded && (
                              <div className="catalog-tree-children">
                                {node.items.map(item => {
                                  const expanded = expandedItemKeys.includes(itemStateKey(node.key, item.key));
                                  const group = groups.find(groupItem => groupItem.id === item.groupId);
                                  return (
                                    <div className="catalog-tree-branch" key={item.key}>
                                      <button
                                        className={`catalog-tree-item${expanded ? ' active' : ''}`}
                                        type="button"
                                        onClick={() => selectItem(node, item)}
                                      >
                                        <span>{item.title}</span>
                                        <em>{item.rowCount}</em>
                                      </button>
                                      {expanded && (
                                        <div className="catalog-tree-detail">
                                          {!node.enabled && (
                                            <div className="catalog-disabled-tip">
                                              当前节点已停用，当前内容仅支持查看；如需恢复配置，可在左侧流程节点上重新启用。
                                            </div>
                                          )}
                                          {group ? renderGroupTable(group) : <div className="empty-state">当前目录下暂无可展示的配置内容</div>}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className="empty-state">当前任务项暂无可展示的清册内容</div>
            )
          )}
        </section>
      </div>

      {modalContext && (
        <div className="modal-mask open" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) {
            closeConfigModal();
          }
        }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="businessConfigTitle">
            <div className="modal-header">
              <h3 id="businessConfigTitle" className="modal-title">配置应用业务</h3>
              <button className="btn-default" type="button" onClick={closeConfigModal}>关闭</button>
            </div>

            <div className="modal-body">
              <p className="modal-tip">请选择当前清册内容需要应用到哪些业务；如果一个业务都不选，则该内容视为未使用。</p>
              <div className="config-target">
                <strong>当前清册：</strong>
                {modalContext.group.elementTitle} \ {modalContext.row.formula || modalContext.row.objectName || '-'}
              </div>

              <div className="checkbox-grid">
                {businessOptions.map(item => (
                  <label key={item.value}>
                    <input
                      type="checkbox"
                      checked={draftBusinesses.includes(item.value)}
                      onChange={event => toggleDraftBusiness(item.value, event.target.checked)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              {modalContext.group.elementTitle !== '内容' && (
                <div className="modal-section">
                  <h4 className="modal-section-title">算法参数配置</h4>
                  <div className="param-group-list">
                    {draftParamGroups.map((group, index) => (
                      <div className="param-group-card" key={`${index}-${group.paramName}`}>
                        <div className="param-group-header">
                          <span className="param-group-title">参数组 {index + 1}</span>
                          {index > 0 && (
                            <button className="btn-link" type="button" onClick={() => removeParamGroup(index)}>删除</button>
                          )}
                        </div>
                        <div className="param-row-grid">
                          <div className="param-form-item">
                            <label>参数</label>
                            <select
                              value={group.paramName}
                              onChange={event => updateParamGroup(index, { paramName: event.target.value })}
                            >
                              <option value="">请选择</option>
                              {parameterOptions.map(item => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="param-form-item">
                            <label>业务标准值</label>
                            <input
                              className="param-result-input"
                              value={group.businessStandardValue}
                              placeholder="选择或填写业务标准值"
                              onChange={event => updateParamGroup(index, { businessStandardValue: event.target.value })}
                            />
                          </div>
                          <div className="param-form-item">
                            <label>取值来源</label>
                            <input
                              className="param-result-input"
                              value={group.valueSource}
                              placeholder="接口、标准库或人工维护"
                              onChange={event => updateParamGroup(index, { valueSource: event.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn-default param-add-button"
                    type="button"
                    onClick={() => setDraftParamGroups(current => [...current, getDefaultParamGroup()])}
                  >
                    + 新增
                  </button>
                </div>
              )}

              <div className="modal-section">
                <h4 className="modal-section-title">配置说明</h4>
                <textarea
                  className="remarks-input"
                  value={draftRemarks}
                  rows={3}
                  placeholder="记录本次配置口径、例外条件或后续接入说明"
                  onChange={event => setDraftRemarks(event.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-default" type="button" onClick={closeConfigModal} disabled={saving}>取消</button>
              <button className="btn-primary" type="button" onClick={saveConfigModal} disabled={saving}>
                {saving ? '保存中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskConfigUpgrade;
