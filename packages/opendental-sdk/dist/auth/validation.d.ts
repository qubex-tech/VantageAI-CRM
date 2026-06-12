import { OpenDentalClient } from '../client/OpenDentalClient';
import { validateConnection } from '../practice/connectionHealth';
import type { PracticeContext } from '../practice/types';
export declare function validateAuthentication(client: OpenDentalClient): Promise<boolean>;
export { validateConnection };
export declare function createValidatedClient(context: PracticeContext, developerKey?: string): OpenDentalClient;
//# sourceMappingURL=validation.d.ts.map