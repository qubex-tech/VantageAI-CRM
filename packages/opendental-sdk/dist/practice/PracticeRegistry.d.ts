import type { PracticeContext } from './types';
export declare class PracticeRegistry {
    private readonly contexts;
    register(context: PracticeContext): void;
    unregister(practiceId: string): boolean;
    get(practiceId: string): PracticeContext | undefined;
    require(practiceId: string): PracticeContext;
    list(): PracticeContext[];
    clear(): void;
    has(practiceId: string): boolean;
}
export declare const globalPracticeRegistry: PracticeRegistry;
//# sourceMappingURL=PracticeRegistry.d.ts.map