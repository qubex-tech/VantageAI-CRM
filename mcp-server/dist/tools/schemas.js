"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchPatientByDemographicsInput = exports.getVerificationBundleInput = exports.getInsurancePolicyDetailsInput = exports.listInsurancePoliciesInput = exports.getPatientIdentityInput = void 0;
const zod_1 = require("zod");
const uuid = zod_1.z.string().uuid();
exports.getPatientIdentityInput = zod_1.z.object({
    patient_id: uuid,
    include_address: zod_1.z.boolean().optional().default(false),
});
exports.listInsurancePoliciesInput = zod_1.z.object({
    patient_id: uuid,
});
exports.getInsurancePolicyDetailsInput = zod_1.z.object({
    policy_id: uuid,
    include_rx: zod_1.z.boolean().optional().default(false),
    include_card_refs: zod_1.z.boolean().optional().default(false),
});
exports.getVerificationBundleInput = zod_1.z.object({
    patient_id: uuid,
    policy_id: uuid.optional(),
    include_address: zod_1.z.boolean().optional().default(false),
    include_rx: zod_1.z.boolean().optional().default(false),
    strict_minimum_necessary: zod_1.z.boolean().optional().default(true),
});
exports.searchPatientByDemographicsInput = zod_1.z.object({
    first_name: zod_1.z.string().min(1),
    last_name: zod_1.z.string().min(1),
    dob: zod_1.z.string().min(1), // YYYY-MM-DD
    zip: zod_1.z.string().optional(),
});
//# sourceMappingURL=schemas.js.map