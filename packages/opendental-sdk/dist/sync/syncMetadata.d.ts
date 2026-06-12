export type SyncCapability = {
    uniqueId: string;
    search: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    bulkRead: boolean;
    incrementalRead: boolean;
    lastModifiedField: string | null;
    operations: string[];
};
export type SyncCapabilitiesMap = Record<string, SyncCapability>;
export declare function getSyncCapabilities(resource: string): SyncCapability | undefined;
export declare function getAllSyncCapabilities(): SyncCapabilitiesMap;
export declare function listSyncableResources(): string[];
export declare function supportsIncrementalSync(resource: string): boolean;
export type SyncMetadata = {
    resource: string;
    lastSyncAt?: Date;
    status: 'idle' | 'running' | 'success' | 'error';
    error?: string;
    recordsProcessed?: number;
};
export declare function createSyncMetadata(resource: string): SyncMetadata;
//# sourceMappingURL=syncMetadata.d.ts.map