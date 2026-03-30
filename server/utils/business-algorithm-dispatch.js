const algorithmConfig = require('./business-algorithms');

const GATEWAY_SERVICE_PATH = 'HFB/business/ywbz/zhixing$m=execute.service';
const ENTRY_PROCEDURE = 'p_gjj_get_mxywsfz';
const fallbackAlgorithmMap = {
    '1': '最大可提取额',
    '2': '最高可贷金额',
    '3': '最高可贷年限',
    '4': '借款人最大可对冲支取金额',
};

const plannedProcedureMap = {
    '1': 'p_gjj_get_mxywsfz_ywsf_1',
    '2': 'p_gjj_get_mxywsfz_ywsf_2',
    '3': 'p_gjj_get_mxywsfz_ywsf_3',
    '4': 'p_gjj_get_mxywsfz_ywsf_4',
};

function getAlgorithmDispatchMeta(ywsf) {
    const algorithmCode = ywsf === undefined || ywsf === null || ywsf === ''
        ? ''
        : String(ywsf);
    const algorithmMap = typeof algorithmConfig.getAlgorithmMap === 'function'
        ? algorithmConfig.getAlgorithmMap()
        : fallbackAlgorithmMap;
    const algorithmLabel = algorithmCode
        ? (algorithmMap[algorithmCode] || `算法 ${algorithmCode}`)
        : '未选择关键数据算法';

    return {
        algorithmCode,
        algorithmLabel,
        gatewayServicePath: GATEWAY_SERVICE_PATH,
        entryProcedure: ENTRY_PROCEDURE,
        currentBranch: algorithmCode
            ? `${ENTRY_PROCEDURE} 内部 ${algorithmCode} 号算法分支`
            : `${ENTRY_PROCEDURE} 默认入口`,
        plannedProcedure: plannedProcedureMap[algorithmCode] || '',
    };
}

function buildDebugDispatchTip(dispatchMeta, ywnrfl) {
    const meta = dispatchMeta || getAlgorithmDispatchMeta('');
    const classTip = ywnrfl ? `，业务内容分类为 ${ywnrfl}` : '';

    if (!meta.algorithmCode) {
        return `当前调试仍通过统一入口 ${meta.gatewayServicePath} 对应的过程 ${meta.entryProcedure} 执行；未选择关键数据算法时，仅生成基础模板，不进入具体算法分支。`;
    }

    const plannedProcedureTip = meta.plannedProcedure
        ? `规划拆分后的子过程可命名为 ${meta.plannedProcedure}。`
        : '当前算法尚未配置规划子过程名称。';

    return `当前调试通过统一入口 ${meta.gatewayServicePath} 对应的过程 ${meta.entryProcedure} 发起，按关键数据算法 ${meta.algorithmCode}（${meta.algorithmLabel}）${classTip}进入 ${meta.currentBranch}；${plannedProcedureTip}`;
}

module.exports = {
    GATEWAY_SERVICE_PATH,
    ENTRY_PROCEDURE,
    getAlgorithmDispatchMeta,
    buildDebugDispatchTip,
};
