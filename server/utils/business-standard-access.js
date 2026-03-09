function getMechanismMmodel(req) {
    return String(req?.user?.mechanismMmodel ?? '').trim();
}

function isBusinessStandardMasterEnabled(req) {
    return getMechanismMmodel(req) === '1';
}

function getBusinessStandardWriteDeniedMessage() {
    return '当前机构为非模型机构，标准库仅支持查看、导出和全量导入；新增、编辑、删除请在模型机构执行。';
}

module.exports = {
    getMechanismMmodel,
    isBusinessStandardMasterEnabled,
    getBusinessStandardWriteDeniedMessage,
};
