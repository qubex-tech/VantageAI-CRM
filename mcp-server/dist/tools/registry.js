"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITIONS = void 0;
exports.getTool = getTool;
exports.invokeTool = invokeTool;
const schemas = __importStar(require("./schemas.js"));
const handlers = __importStar(require("./handlers.js"));
exports.TOOL_DEFINITIONS = [
    {
        name: 'get_patient_identity',
        description: 'Get patient identity and optionally address. Minimum necessary for verification.',
        input_schema: {
            type: 'object',
            properties: {
                patient_id: { type: 'string', format: 'uuid', description: 'Patient UUID' },
                include_address: { type: 'boolean', default: false, description: 'Include address fields' },
            },
            required: ['patient_id'],
        },
        output_schema: {
            type: 'object',
            properties: {
                patient_id: { type: 'string' },
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                date_of_birth: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
                address: {
                    type: 'object',
                    properties: {
                        line1: { type: 'string' },
                        line2: { type: 'string' },
                        city: { type: 'string' },
                        state: { type: 'string' },
                        zip: { type: 'string' },
                    },
                },
            },
        },
        inputSchema: schemas.getPatientIdentityInput,
        handler: handlers.handleGetPatientIdentity,
    },
    {
        name: 'list_insurance_policies',
        description: 'List insurance policies for a patient. Returns payer, primary flag, masked member ID, completeness.',
        input_schema: {
            type: 'object',
            properties: {
                patient_id: { type: 'string', format: 'uuid' },
            },
            required: ['patient_id'],
        },
        output_schema: {
            type: 'object',
            properties: {
                policies: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            policy_id: { type: 'string' },
                            payer_name_raw: { type: 'string' },
                            is_primary: { type: 'boolean' },
                            plan_type: { type: 'string' },
                            member_id_masked: { type: 'string' },
                            completeness: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string', enum: ['READY', 'NEEDS_INFO'] },
                                    missing_fields: { type: 'array', items: { type: 'object' } },
                                },
                            },
                        },
                    },
                },
            },
        },
        inputSchema: schemas.listInsurancePoliciesInput,
        handler: handlers.handleListInsurancePolicies,
    },
    {
        name: 'get_insurance_policy_details',
        description: 'Get full policy details: payer, member/group (masked by default), subscriber, BCBS routing, optional Rx and card refs.',
        input_schema: {
            type: 'object',
            properties: {
                policy_id: { type: 'string', format: 'uuid' },
                include_rx: { type: 'boolean', default: false },
                include_card_refs: { type: 'boolean', default: false },
            },
            required: ['policy_id'],
        },
        output_schema: { type: 'object' },
        inputSchema: schemas.getInsurancePolicyDetailsInput,
        handler: handlers.handleGetInsurancePolicyDetails,
    },
    {
        name: 'get_verification_bundle',
        description: 'Get the complete minimal verification bundle for a patient and policy (or primary policy). Use for eligibility/verification workflows.',
        input_schema: {
            type: 'object',
            properties: {
                patient_id: { type: 'string', format: 'uuid' },
                policy_id: { type: 'string', format: 'uuid', description: 'Optional; if omitted, primary policy is used' },
                include_address: { type: 'boolean', default: false },
                include_rx: { type: 'boolean', default: false },
                strict_minimum_necessary: { type: 'boolean', default: true },
            },
            required: ['patient_id'],
        },
        output_schema: {
            type: 'object',
            properties: {
                patient: { type: 'object' },
                insurance: { type: 'object' },
                subscriber: { type: 'object' },
                bcbs: { type: 'object' },
                rx: { type: 'object' },
                readiness: { type: 'object' },
            },
        },
        inputSchema: schemas.getVerificationBundleInput,
        handler: handlers.handleGetVerificationBundle,
    },
    {
        name: 'search_patient_by_demographics',
        description: 'Search for patients by first name, last name, date of birth, and optional ZIP. Returns matches with masked display.',
        input_schema: {
            type: 'object',
            properties: {
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                dob: { type: 'string', description: 'YYYY-MM-DD' },
                zip: { type: 'string' },
            },
            required: ['first_name', 'last_name', 'dob'],
        },
        output_schema: {
            type: 'object',
            properties: {
                matches: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            patient_id: { type: 'string' },
                            confidence: { type: 'string' },
                            display: { type: 'object' },
                        },
                    },
                },
            },
        },
        inputSchema: schemas.searchPatientByDemographicsInput,
        handler: handlers.handleSearchPatientByDemographics,
    },
];
const toolMap = new Map(exports.TOOL_DEFINITIONS.map((t) => [t.name, t]));
function getTool(name) {
    return toolMap.get(name);
}
async function invokeTool(toolName, input, ctx) {
    const tool = toolMap.get(toolName);
    if (!tool) {
        return { output: {}, error: { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${toolName}` } };
    }
    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
        const first = parsed.error.flatten().fieldErrors;
        const msg = Object.entries(first)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
            .join('; ');
        return { output: {}, error: { code: 'VALIDATION_ERROR', message: msg } };
    }
    try {
        const result = await tool.handler(parsed.data, ctx);
        return { output: result.output };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error';
        return { output: {}, error: { code: 'EXECUTION_ERROR', message } };
    }
}
//# sourceMappingURL=registry.js.map