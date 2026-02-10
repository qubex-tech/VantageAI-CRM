import type { Request, Response, NextFunction } from 'express';
export type ActorType = 'agent' | 'user' | 'system';
export interface McpAuthLocals {
    actorId: string;
    actorType: ActorType;
    purpose: string;
    requestId: string;
    allowUnmasked: boolean;
}
export declare function requireMcpAuth(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map