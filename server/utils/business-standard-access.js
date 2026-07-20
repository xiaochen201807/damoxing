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
    return '业务标准库页面导入已永久关闭。请从本页「导出历史」下载 SQL，在数据库客户端执行；勿将脚本上传到关键数据计算模型页面。';
}

module.exports = {
    getMechanismMmodel,
    isBusinessStandardMasterEnabled,
    getBusinessStandardWriteDeniedMessage,
    getBusinessStandardImportDisabledMessage,
};
