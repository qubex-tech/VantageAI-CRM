"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginatedFetchAll = paginatedFetchAll;
exports.fetchAllWithOffset = fetchAllWithOffset;
const pagination_1 = require("../client/pagination");
async function paginatedFetchAll(fetchPage, options) {
    return (0, pagination_1.fetchAllPages)(fetchPage, options);
}
async function fetchAllWithOffset(listFn, baseParams = {}, options) {
    const limit = options?.limit ?? 100;
    const maxPages = options?.maxPages ?? 1000;
    const all = [];
    let offset = 0;
    for (let page = 0; page < maxPages; page++) {
        const batch = await listFn({ ...baseParams, Limit: limit, Offset: offset });
        all.push(...batch);
        if (batch.length < limit)
            break;
        offset += limit;
    }
    return all;
}
//# sourceMappingURL=paginatedFetchAll.js.map