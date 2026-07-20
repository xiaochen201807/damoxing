const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readTemplateVersion } = require('../utils/template-version');

const REPO_ROOT = path.join(__dirname, '../..');
const TEMPLATES_PREFIX = 'server/templates/';
const PAGES_PREFIX = `${TEMPLATES_PREFIX}pages/`;
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const ZERO_SHA = /^0+$/;
const ANY_VERSION_PATTERN = /\{#\s*@template-version\s*:[\s\S]*?#\}\s*(?:\r?\n)?/g;

function runGit(args, options = {}) {
    const result = spawnSync('git', args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        ...options
    });

    if (result.status !== 0 && !options.allowFailure) {
        throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
    }

    return result;
}

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function stripVersionComments(content) {
    return String(content || '')
        .replace(ANY_VERSION_PATTERN, '')
        .replace(/\r\n/g, '\n');
}

function writeVersionComment(content, version) {
    const source = String(content || '');
    const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';
    const sourceWithoutBom = bom ? source.slice(1) : source;
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const withoutVersions = stripVersionComments(sourceWithoutBom).replace(/^\n+/, '');
    return `${bom}{# @template-version: ${version} #}${eol}${withoutVersions}`;
}

function getArgument(name) {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : null;
}

function resolveFromSha(fromSha, toSha) {
    if (fromSha && !ZERO_SHA.test(fromSha)) return fromSha;

    const parent = runGit(['rev-parse', `${toSha}^`], { allowFailure: true });
    return parent.status === 0 ? parent.stdout.trim() : EMPTY_TREE;
}

function readFileAtRevision(revision, filePath) {
    if (!revision) {
        const absolutePath = path.join(REPO_ROOT, filePath);
        return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : null;
    }

    const result = runGit(['show', `${revision}:${filePath}`], { allowFailure: true });
    return result.status === 0 ? result.stdout : null;
}

function listChangedTemplateFiles(fromSha, toSha) {
    const args = ['diff', '--name-only', '--diff-filter=ACMR', fromSha];
    if (toSha) args.push(toSha);
    args.push('--', 'server/templates');

    const result = runGit(args);
    return result.stdout
        .split(/\r?\n/)
        .map(normalizePath)
        .filter(Boolean);
}

function listPageTemplates() {
    const pagesDir = path.join(REPO_ROOT, PAGES_PREFIX);
    return fs.readdirSync(pagesDir)
        .filter(fileName => fileName.endsWith('.j2'))
        .map(fileName => `${PAGES_PREFIX}${fileName}`);
}

function updateTemplateVersions({ fromSha, toSha = null }) {
    const changedFiles = listChangedTemplateFiles(fromSha, toSha);
    const directPageChanges = new Set(changedFiles.filter(file => file.startsWith(PAGES_PREFIX) && file.endsWith('.j2')));
    const sharedTemplateChanged = changedFiles.some(file =>
        file.startsWith(`${TEMPLATES_PREFIX}components/`) || file.startsWith(`${TEMPLATES_PREFIX}base/`)
    );
    const affectedPages = sharedTemplateChanged ? listPageTemplates() : Array.from(directPageChanges);
    const updated = [];

    for (const filePath of affectedPages) {
        const absolutePath = path.join(REPO_ROOT, filePath);
        if (!fs.existsSync(absolutePath)) continue;

        const previousContent = readFileAtRevision(fromSha, filePath);
        const currentContent = fs.readFileSync(absolutePath, 'utf8');
        const bodyChanged = stripVersionComments(previousContent) !== stripVersionComments(currentContent);

        if (!bodyChanged && !sharedTemplateChanged) continue;

        const previousVersion = readTemplateVersion(previousContent) || 0;
        const targetVersion = previousVersion + 1;
        const nextContent = writeVersionComment(currentContent, targetVersion);

        if (nextContent !== currentContent) {
            fs.writeFileSync(absolutePath, nextContent, 'utf8');
            updated.push({ filePath, previousVersion, targetVersion });
        }
    }

    return { changedFiles, sharedTemplateChanged, updated };
}

function main() {
    const toSha = getArgument('to');
    const requestedFrom = getArgument('from');
    const fromSha = resolveFromSha(requestedFrom || (toSha ? null : 'HEAD'), toSha || 'HEAD');
    const result = updateTemplateVersions({ fromSha, toSha });

    if (result.updated.length === 0) {
        console.log('No template version updates are required.');
        return;
    }

    for (const item of result.updated) {
        console.log(`${item.filePath}: ${item.previousVersion || 'unversioned'} -> ${item.targetVersion}`);
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = {
    stripVersionComments,
    writeVersionComment,
    resolveFromSha,
    updateTemplateVersions
};
