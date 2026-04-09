function getMechanismMmodel(req) {
    return String(req?.user?.mechanismMmodel ?? '').trim();
}

function isBusinessStandardMasterEnabled(req) {
    return getMechanismMmodel(req) === '1';
}

function getBusinessStandardWriteDeniedMessage() {
    return '当前机构为非模型机构，标准库仅支持查看和导出；新增、编辑、删除请在模型机构执行。';
}

function getBusinessStandardImportDisabledMessage() {
    return '业务标准全量导入接口已禁用，请通过页面维护标准库数据。';
}

module.exports = {
    getMechanismMmodel,
    isBusinessStandardMasterEnabled,
    getBusinessStandardWriteDeniedMessage,
    getBusinessStandardImportDisabledMessage,
};
