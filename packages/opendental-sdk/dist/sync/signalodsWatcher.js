"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchSignalods = watchSignalods;
async function watchSignalods(signalods, options = {}) {
    const params = {
        ...options.params,
    };
    if (options.since) {
        params.SigDateTime = options.since;
    }
    const records = await signalods.list(params);
    if (!options.types?.length)
        return records;
    const typeSet = new Set(options.types.map((t) => t.toLowerCase()));
    return records.filter((r) => {
        const itemName = typeof r.ItemName === 'string' ? r.ItemName.toLowerCase() : '';
        const fKeyType = typeof r.FKeyType === 'string' ? r.FKeyType.toLowerCase() : '';
        return typeSet.has(itemName) || typeSet.has(fKeyType);
    });
}
//# sourceMappingURL=signalodsWatcher.js.map