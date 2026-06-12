"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePaginationParams = normalizePaginationParams;
exports.fetchAllPages = fetchAllPages;
const common_1 = require("../models/common");
function normalizePaginationParams(params, enterprise = false) {
    const maxLimit = enterprise ? 1000 : common_1.MAX_PAGE_LIMIT;
    const limit = params?.Limit ?? common_1.DEFAULT_PAGE_LIMIT;
    return {
        Limit: Math.min(Math.max(1, limit), maxLimit),
        Offset: Math.max(0, params?.Offset ?? 0),
    };
}
async function fetchAllPages(fetchPage, options = {}) {
    const pageLimit = options.limit ?? common_1.DEFAULT_PAGE_LIMIT;
    const maxPages = options.maxPages ?? 1000;
    const all = [];
    let offset = 0;
    let page = 0;
    while (page < maxPages) {
        const batch = await fetchPage(normalizePaginationParams({ Limit: pageLimit, Offset: offset }, options.enterprise));
        all.push(...batch);
        if (batch.length < pageLimit)
            break;
        offset += pageLimit;
        page += 1;
    }
    return all;
}
//# sourceMappingURL=pagination.js.map