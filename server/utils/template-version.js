const fs = require('fs');
const path = require('path');

const TEMPLATE_META_KEY = 'x-template-meta';
const VERSION_PATTERN = /\{#\s*@template-version\s*:\s*(\d+)\s*#\}/g;
const templatesDir = path.join(__dirname, '../templates');
const pagesDir = path.join(templatesDir, 'pages');

let templateRegistry = new Map();

function readTemplateVersion(content) {
    if (typeof content !== 'string') return null;

    const versions = [];
    for (const match of content.matchAll(VERSION_PATTERN)) {
        const version = Number.parseInt(match[1], 10);
        if (Number.isSafeInteger(version) && version > 0) {
            versions.push(version);
        }
    }

    return versions.length === 1 ? versions[0] : null;
}

function scanTemplateVersions(directory = pagesDir) {
    const registry = new Map();
    if (!fs.existsSync(directory)) return registry;

    for (const fileName of fs.readdirSync(directory).filter(name => name.endsWith('.j2'))) {
        const templateId = path.basename(fileName, '.j2');
        const absolutePath = path.join(directory, fileName);
        const version = readTemplateVersion(fs.readFileSync(absolutePath, 'utf8'));

        registry.set(templateId, {
            templateId,
            templateFile: `pages/${fileName}`,
            version
        });
    }

    return registry;
}

function refreshTemplateRegistry() {
    templateRegistry = scanTemplateVersions();
    return templateRegistry;
}

function getTemplateInfo(templateId, registry = templateRegistry) {
    return registry.get(templateId) || null;
}

function getTemplateMeta(value) {
    if (!value || typeof value !== 'object') return null;
    const meta = value[TEMPLATE_META_KEY];
    if (!meta || typeof meta !== 'object') return null;

    const version = Number(meta.version);
    if (!meta.templateId || !Number.isSafeInteger(version) || version <= 0) return null;

    return {
        templateId: String(meta.templateId),
        version
    };
}

function applyTemplateVersionMeta(value, templateId, registry = templateRegistry) {
    if (!value || typeof value !== 'object') return value;

    const template = getTemplateInfo(templateId, registry);
    if (!template || !template.version) {
        delete value[TEMPLATE_META_KEY];
        return value;
    }

    value[TEMPLATE_META_KEY] = {
        templateId,
        version: template.version
    };
    return value;
}

function checkTemplateDefinitionVersion(templateId, paramsSchema, registry = templateRegistry) {
    const template = getTemplateInfo(templateId, registry);
    if (!template) {
        return {
            ok: false,
            status: 'missing_program_template',
            message: `当前镜像中不存在模板 ${templateId}`
        };
    }

    const configMeta = getTemplateMeta(paramsSchema);
    if (!template.version) {
        if (configMeta?.templateId === templateId) {
            return {
                ok: false,
                status: 'program_version_older',
                templateId,
                programVersion: null,
                configVersion: configMeta.version,
                message: '当前镜像模板没有版本，但模板定义已有版本，请检查是否发生了镜像回滚'
            };
        }
        return { ok: true, status: 'unversioned_template' };
    }

    if (!configMeta || configMeta.templateId !== templateId || configMeta.version !== template.version) {
        return {
            ok: false,
            status: 'template_config_outdated',
            templateId,
            programVersion: template.version,
            configVersion: configMeta?.version || null,
            message: '模板定义版本与当前程序模板不一致，请先在人工智能配置中重新分析模板'
        };
    }

    return { ok: true, status: 'current' };
}

function assessPageTemplateVersion(page, schema, registry = templateRegistry) {
    if (!page?.source_template_id) {
        return { status: 'unmanaged' };
    }

    const templateId = page.source_template_id;
    const template = getTemplateInfo(templateId, registry);
    if (!template) {
        return {
            status: 'missing_program_template',
            templateId,
            message: `页面来源模板 ${templateId} 在当前镜像中不存在，请检查镜像或模板配置`
        };
    }

    const pageMeta = getTemplateMeta(schema);
    if (!template.version) {
        if (pageMeta?.templateId === templateId) {
            return {
                status: 'program_version_older',
                templateId,
                programVersion: null,
                pageVersion: pageMeta.version,
                message: '当前镜像模板没有版本，但页面已记录版本，请检查是否发生了镜像回滚'
            };
        }
        return { status: 'unversioned_template', templateId };
    }

    if (!pageMeta || pageMeta.templateId !== templateId) {
        return {
            status: 'legacy_unversioned',
            templateId,
            programVersion: template.version,
            pageVersion: pageMeta?.version || null,
            message: '当前页面未记录模板版本，请前往人工智能配置重新分析模板并保存页面'
        };
    }

    if (template.version > pageMeta.version) {
        return {
            status: 'page_outdated',
            templateId,
            programVersion: template.version,
            pageVersion: pageMeta.version,
            message: '当前页面由旧版模板生成，请前往人工智能配置更新页面'
        };
    }

    if (template.version < pageMeta.version) {
        return {
            status: 'program_version_older',
            templateId,
            programVersion: template.version,
            pageVersion: pageMeta.version,
            message: '当前镜像模板版本低于页面版本，请检查是否发生了镜像回滚'
        };
    }

    return {
        status: 'current',
        templateId,
        programVersion: template.version,
        pageVersion: pageMeta.version
    };
}

refreshTemplateRegistry();

module.exports = {
    TEMPLATE_META_KEY,
    VERSION_PATTERN,
    readTemplateVersion,
    scanTemplateVersions,
    refreshTemplateRegistry,
    getTemplateInfo,
    getTemplateMeta,
    applyTemplateVersionMeta,
    checkTemplateDefinitionVersion,
    assessPageTemplateVersion
};
