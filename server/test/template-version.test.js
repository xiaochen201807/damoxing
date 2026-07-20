const test = require('node:test');
const assert = require('node:assert/strict');
const {
    readTemplateVersion,
    getTemplateMeta,
    applyTemplateVersionMeta,
    checkTemplateDefinitionVersion,
    assessPageTemplateVersion,
    TEMPLATE_META_KEY
} = require('../utils/template-version');
const {
    stripVersionComments,
    writeVersionComment
} = require('../scripts/update-template-versions');

test('readTemplateVersion accepts exactly one positive integer version', () => {
    assert.equal(readTemplateVersion('{# @template-version: 12 #}\n{}'), 12);
    assert.equal(readTemplateVersion('{}'), null);
    assert.equal(readTemplateVersion('{# @template-version: 0 #}\n{}'), null);
    assert.equal(readTemplateVersion('{# @template-version: 1 #}\n{# @template-version: 2 #}'), null);
});

test('writeVersionComment normalizes existing annotations and is idempotent', () => {
    const source = '{# @template-version: invalid #}\n{# @template-version: 3 #}\n{"type":"page"}\n';
    const expected = '{# @template-version: 4 #}\n{"type":"page"}\n';

    assert.equal(writeVersionComment(source, 4), expected);
    assert.equal(writeVersionComment(expected, 4), expected);
    assert.equal(writeVersionComment(`\uFEFF${expected}`, 4), `\uFEFF${expected}`);
    assert.equal(stripVersionComments(expected), '{"type":"page"}\n');
    assert.equal(stripVersionComments(expected.replace(/\n/g, '\r\n')), '{"type":"page"}\n');
});

test('getTemplateMeta validates embedded metadata', () => {
    assert.deepEqual(getTemplateMeta({
        [TEMPLATE_META_KEY]: { templateId: 'policy_demo', version: 3 }
    }), { templateId: 'policy_demo', version: 3 });
    assert.equal(getTemplateMeta({ [TEMPLATE_META_KEY]: { templateId: 'policy_demo', version: 0 } }), null);
    assert.equal(getTemplateMeta({}), null);
});

test('template definition and generated page use the program template version', () => {
    const registry = new Map([[
        'policy_demo',
        { templateId: 'policy_demo', templateFile: 'pages/policy_demo.j2', version: 3 }
    ]]);
    const paramsSchema = applyTemplateVersionMeta({ type: 'object' }, 'policy_demo', registry);
    const pageSchema = applyTemplateVersionMeta({ type: 'page' }, 'policy_demo', registry);

    assert.equal(checkTemplateDefinitionVersion('policy_demo', paramsSchema, registry).status, 'current');
    assert.equal(assessPageTemplateVersion({ source_template_id: 'policy_demo' }, pageSchema, registry).status, 'current');
});

test('page assessment distinguishes legacy, outdated, and rolled-back versions', () => {
    const registry = new Map([[
        'policy_demo',
        { templateId: 'policy_demo', templateFile: 'pages/policy_demo.j2', version: 3 }
    ]]);
    const page = { source_template_id: 'policy_demo' };

    assert.equal(assessPageTemplateVersion(page, { type: 'page' }, registry).status, 'legacy_unversioned');
    assert.equal(assessPageTemplateVersion(page, {
        [TEMPLATE_META_KEY]: { templateId: 'policy_demo', version: 2 }
    }, registry).status, 'page_outdated');
    assert.equal(assessPageTemplateVersion(page, {
        [TEMPLATE_META_KEY]: { templateId: 'policy_demo', version: 4 }
    }, registry).status, 'program_version_older');
});

test('unversioned historical templates remain unmanaged by version checks', () => {
    const registry = new Map([[
        'policy_demo',
        { templateId: 'policy_demo', templateFile: 'pages/policy_demo.j2', version: null }
    ]]);

    assert.equal(
        assessPageTemplateVersion({ source_template_id: 'policy_demo' }, { type: 'page' }, registry).status,
        'unversioned_template'
    );
    assert.equal(assessPageTemplateVersion({ source_template_id: 'policy_demo' }, {
        [TEMPLATE_META_KEY]: { templateId: 'policy_demo', version: 2 }
    }, registry).status, 'program_version_older');
});
