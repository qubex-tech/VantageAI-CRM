"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConnection = void 0;
exports.validateAuthentication = validateAuthentication;
exports.createValidatedClient = createValidatedClient;
const OpenDentalClient_1 = require("../client/OpenDentalClient");
const connectionHealth_1 = require("../practice/connectionHealth");
Object.defineProperty(exports, "validateConnection", { enumerable: true, get: function () { return connectionHealth_1.validateConnection; } });
async function validateAuthentication(client) {
    const result = await (0, connectionHealth_1.validateConnection)(client);
    return result.valid;
}
function createValidatedClient(context, developerKey) {
    return (0, OpenDentalClient_1.createClientFromContext)(context, developerKey);
}
//# sourceMappingURL=validation.js.map