"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseDomainService = void 0;
class BaseDomainService {
    client;
    context;
    constructor(client, context) {
        this.client = client;
        this.context = context;
    }
    getPracticeId() {
        return this.context.practiceId;
    }
    buildPath(suffix = '') {
        const base = this.resourcePath.replace(/^\//, '');
        if (!suffix)
            return base;
        const cleanSuffix = suffix.startsWith('/') ? suffix.slice(1) : suffix;
        return `${base}/${cleanSuffix}`;
    }
    async getList(params) {
        const result = await this.client.get(this.buildPath(), { params });
        return Array.isArray(result) ? result : result ? [result] : [];
    }
    async getSingle(id, params) {
        return this.client.get(this.buildPath(String(id)), { params });
    }
    async getSubResource(subPath, params) {
        return this.client.get(this.buildPath(subPath), { params });
    }
    async createRecord(body, subPath = '') {
        return this.client.post(this.buildPath(subPath), { body });
    }
    async updateRecord(id, body) {
        return this.client.put(this.buildPath(String(id)), { body });
    }
    async updateSubResource(subPath, body, params) {
        return this.client.put(this.buildPath(subPath), { body, params });
    }
    async removeRecord(id) {
        await this.client.delete(this.buildPath(String(id)));
    }
    async removeSubResource(subPath) {
        await this.client.delete(this.buildPath(subPath));
    }
    async postAction(subPath, body, options) {
        return this.client.post(this.buildPath(subPath), { body, ...options });
    }
    async listPaginated(params) {
        return this.getList(params);
    }
}
exports.BaseDomainService = BaseDomainService;
//# sourceMappingURL=BaseDomainService.js.map