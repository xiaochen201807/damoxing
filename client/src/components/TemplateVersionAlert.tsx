import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../config/constants';
import type { TemplateVersionStatus } from '../types/api';
import './TemplateVersionAlert.css';

interface Props {
  status: TemplateVersionStatus | null;
}

const visibleStatuses = new Set([
  'legacy_unversioned',
  'page_outdated',
  'program_version_older',
  'missing_program_template'
]);

const titles: Record<string, string> = {
  legacy_unversioned: '页面尚未登记模板版本',
  page_outdated: '页面模板需要更新',
  program_version_older: '当前镜像版本可能过旧',
  missing_program_template: '页面来源模板缺失'
};

const TemplateVersionAlert: React.FC<Props> = ({ status }) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!status || dismissed || !visibleStatuses.has(status.status)) return null;

  return (
    <div className={`template-version-alert template-version-alert--${status.status}`} role="alert">
      <i className="fa fa-exclamation-triangle template-version-alert__icon" aria-hidden="true" />
      <div className="template-version-alert__content">
        <strong>{titles[status.status] || '页面模板版本异常'}</strong>
        <span>{status.message || '请前往人工智能配置检查并更新当前页面。'}</span>
        {(status.programVersion || status.pageVersion) && (
          <small>
            程序版本：{status.programVersion ?? '未知'}，页面版本：{status.pageVersion ?? '未登记'}
          </small>
        )}
      </div>
      <button
        type="button"
        className="template-version-alert__action"
        onClick={() => navigate(ROUTES.CONFIG)}
      >
        前往人工智能配置
      </button>
      <button
        type="button"
        className="template-version-alert__dismiss"
        aria-label="关闭模板版本提示"
        title="关闭提示"
        onClick={() => setDismissed(true)}
      >
        <i className="fa fa-times" aria-hidden="true" />
      </button>
    </div>
  );
};

export default TemplateVersionAlert;
