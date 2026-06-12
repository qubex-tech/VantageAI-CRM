import { OpenDentalClient } from '../client/OpenDentalClient';
import type { PracticeContext } from './types';
export type ConnectionHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type ConnectionHealthResult = {
    status: ConnectionHealthStatus;
    checkedAt: Date;
    baseUrlUsed: string;
    latencyMs: number;
    odVersion?: string;
    error?: string;
};
export declare function checkConnectionHealth(client: OpenDentalClient, context: PracticeContext): Promise<ConnectionHealthResult>;
export declare function validateConnection(client: OpenDentalClient): Promise<{
    valid: boolean;
    message: string;
}>;
//# sourceMappingURL=connectionHealth.d.ts.map