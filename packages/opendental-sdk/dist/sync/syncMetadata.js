"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSyncCapabilities = getSyncCapabilities;
exports.getAllSyncCapabilities = getAllSyncCapabilities;
exports.listSyncableResources = listSyncableResources;
exports.supportsIncrementalSync = supportsIncrementalSync;
exports.createSyncMetadata = createSyncMetadata;
const capability_matrix_json_1 = __importDefault(require("../capability-matrix.json"));
const capabilities = capability_matrix_json_1.default.syncCapabilities;
function getSyncCapabilities(resource) {
    return capabilities[resource];
}
function getAllSyncCapabilities() {
    return { ...capabilities };
}
function listSyncableResources() {
    return Object.entries(capabilities)
        .filter(([, cap]) => cap.bulkRead || cap.incrementalRead)
        .map(([resource]) => resource);
}
function supportsIncrementalSync(resource) {
    return capabilities[resource]?.incrementalRead ?? false;
}
function createSyncMetadata(resource) {
    return { resource, status: 'idle' };
}
//# sourceMappingURL=syncMetadata.js.map