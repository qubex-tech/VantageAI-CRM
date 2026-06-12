import type { OdDateTime } from '../models/common';
export type SignalodRecord = {
    SignalodNum?: number;
    SigDateTime?: OdDateTime;
    FKey?: number;
    FKeyType?: string;
    ItemName?: string;
    [key: string]: unknown;
};
export type WatchSignalodsOptions = {
    since?: OdDateTime | string;
    types?: string[];
    params?: Record<string, string | number | boolean | undefined | null>;
};
export type SignalodsWatcher = {
    list: (params?: Record<string, string | number | boolean | undefined | null>) => Promise<SignalodRecord[]>;
};
export declare function watchSignalods(signalods: SignalodsWatcher, options?: WatchSignalodsOptions): Promise<SignalodRecord[]>;
//# sourceMappingURL=signalodsWatcher.d.ts.map