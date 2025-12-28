/**
 * 通用分页工具函数
 * @param {Array} items - 要分页的数据数组
 * @param {number|string} page - 页码（从1开始）
 * @param {number|string} perPage - 每页数量
 * @returns {Object} 分页结果
 */
function paginate(items, page = 1, perPage = 10) {
    const total = items.length;
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(perPage) || 10;
    
    // 计算起始和结束索引
    const start = (pageNum - 1) * pageSizeNum;
    const end = start + pageSizeNum;
    
    // 切片数据
    const paginatedItems = items.slice(start, end);
    
    return {
        items: paginatedItems,
        total: total,
        page: pageNum,
        perPage: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum)
    };
}

module.exports = { paginate };
