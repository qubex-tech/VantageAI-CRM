"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalPracticeRegistry = exports.PracticeRegistry = void 0;
class PracticeRegistry {
    contexts = new Map();
    register(context) {
        this.contexts.set(context.practiceId, context);
    }
    unregister(practiceId) {
        return this.contexts.delete(practiceId);
    }
    get(practiceId) {
        return this.contexts.get(practiceId);
    }
    require(practiceId) {
        const context = this.get(practiceId);
        if (!context) {
            throw new Error(`No Open Dental practice context registered for practiceId: ${practiceId}`);
        }
        return context;
    }
    list() {
        return [...this.contexts.values()];
    }
    clear() {
        this.contexts.clear();
    }
    has(practiceId) {
        return this.contexts.has(practiceId);
    }
}
exports.PracticeRegistry = PracticeRegistry;
exports.globalPracticeRegistry = new PracticeRegistry();
//# sourceMappingURL=PracticeRegistry.js.map