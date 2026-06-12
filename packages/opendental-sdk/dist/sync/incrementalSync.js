"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementalFetchSince = incrementalFetchSince;
exports.filterByTimestampSince = filterByTimestampSince;
async function incrementalFetchSince(listFn, options) {
    const dateField = options.dateField ?? 'DateTStamp';
    const params = {
        ...options.additionalParams,
        [dateField]: options.since,
    };
    return listFn(params);
}
function filterByTimestampSince(items, since, field = 'DateTStamp') {
    return items.filter((item) => {
        const value = item[field];
        if (typeof value !== 'string')
            return false;
        return value >= since;
    });
}
//# sourceMappingURL=incrementalSync.js.map