import type { ApiMode, OpenDentalCredentials } from '../models/common';
export type PracticeContext = {
    practiceId: string;
    connectionId: string;
    credentials: OpenDentalCredentials;
    baseUrl: string;
    fallbackBaseUrls?: string[];
    apiMode: ApiMode;
    enabledPermissions?: string[];
    displayName?: string;
};
export type OpenDentalPracticeConfig = {
    practiceId: string;
    connectionId: string;
    displayName: string;
    customerKey: string;
    developerKey: string;
    apiMode?: ApiMode;
    baseUrl?: string;
    fallbackBaseUrls?: string[];
    enabledPermissions?: string[];
};
export declare function toPracticeContext(config: OpenDentalPracticeConfig): PracticeContext;
//# sourceMappingURL=types.d.ts.map