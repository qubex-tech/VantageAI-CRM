import { z } from 'zod';
import * as handlers from './handlers.js';
import type { RequestContext } from './handlers.js';
export declare const TOOL_DEFINITIONS: readonly [{
    readonly name: "get_patient_identity";
    readonly description: "Get patient identity and optionally address. Minimum necessary for verification.";
    readonly input_schema: {
        readonly type: "object";
        readonly properties: {
            readonly patient_id: {
                readonly type: "string";
                readonly format: "uuid";
                readonly description: "Patient UUID";
            };
            readonly include_address: {
                readonly type: "boolean";
                readonly default: false;
                readonly description: "Include address fields";
            };
        };
        readonly required: readonly ["patient_id"];
    };
    readonly output_schema: {
        readonly type: "object";
        readonly properties: {
            readonly patient_id: {
                readonly type: "string";
            };
            readonly first_name: {
                readonly type: "string";
            };
            readonly last_name: {
                readonly type: "string";
            };
            readonly date_of_birth: {
                readonly type: "string";
            };
            readonly phone: {
                readonly type: "string";
            };
            readonly email: {
                readonly type: "string";
            };
            readonly address: {
                readonly type: "object";
                readonly properties: {
                    readonly line1: {
                        readonly type: "string";
                    };
                    readonly line2: {
                        readonly type: "string";
                    };
                    readonly city: {
                        readonly type: "string";
                    };
                    readonly state: {
                        readonly type: "string";
                    };
                    readonly zip: {
                        readonly type: "string";
                    };
                };
            };
        };
    };
    readonly inputSchema: z.ZodObject<{
        patient_id: z.ZodString;
        include_address: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        patient_id: string;
        include_address: boolean;
    }, {
        patient_id: string;
        include_address?: boolean | undefined;
    }>;
    readonly handler: typeof handlers.handleGetPatientIdentity;
}, {
    readonly name: "list_insurance_policies";
    readonly description: "List insurance policies for a patient. Returns payer, primary flag, masked member ID, completeness.";
    readonly input_schema: {
        readonly type: "object";
        readonly properties: {
            readonly patient_id: {
                readonly type: "string";
                readonly format: "uuid";
            };
        };
        readonly required: readonly ["patient_id"];
    };
    readonly output_schema: {
        readonly type: "object";
        readonly properties: {
            readonly policies: {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly properties: {
                        readonly policy_id: {
                            readonly type: "string";
                        };
                        readonly payer_name_raw: {
                            readonly type: "string";
                        };
                        readonly is_primary: {
                            readonly type: "boolean";
                        };
                        readonly plan_type: {
                            readonly type: "string";
                        };
                        readonly member_id_masked: {
                            readonly type: "string";
                        };
                        readonly completeness: {
                            readonly type: "object";
                            readonly properties: {
                                readonly status: {
                                    readonly type: "string";
                                    readonly enum: readonly ["READY", "NEEDS_INFO"];
                                };
                                readonly missing_fields: {
                                    readonly type: "array";
                                    readonly items: {
                                        readonly type: "object";
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    };
    readonly inputSchema: z.ZodObject<{
        patient_id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        patient_id: string;
    }, {
        patient_id: string;
    }>;
    readonly handler: typeof handlers.handleListInsurancePolicies;
}, {
    readonly name: "get_insurance_policy_details";
    readonly description: "Get full policy details: payer, member/group (masked by default), subscriber, BCBS routing, optional Rx and card refs.";
    readonly input_schema: {
        readonly type: "object";
        readonly properties: {
            readonly policy_id: {
                readonly type: "string";
                readonly format: "uuid";
            };
            readonly include_rx: {
                readonly type: "boolean";
                readonly default: false;
            };
            readonly include_card_refs: {
                readonly type: "boolean";
                readonly default: false;
            };
        };
        readonly required: readonly ["policy_id"];
    };
    readonly output_schema: {
        readonly type: "object";
    };
    readonly inputSchema: z.ZodObject<{
        policy_id: z.ZodString;
        include_rx: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        include_card_refs: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        policy_id: string;
        include_rx: boolean;
        include_card_refs: boolean;
    }, {
        policy_id: string;
        include_rx?: boolean | undefined;
        include_card_refs?: boolean | undefined;
    }>;
    readonly handler: typeof handlers.handleGetInsurancePolicyDetails;
}, {
    readonly name: "get_verification_bundle";
    readonly description: "Get the complete minimal verification bundle for a patient and policy (or primary policy). Use for eligibility/verification workflows.";
    readonly input_schema: {
        readonly type: "object";
        readonly properties: {
            readonly patient_id: {
                readonly type: "string";
                readonly format: "uuid";
            };
            readonly policy_id: {
                readonly type: "string";
                readonly format: "uuid";
                readonly description: "Optional; if omitted, primary policy is used";
            };
            readonly include_address: {
                readonly type: "boolean";
                readonly default: false;
            };
            readonly include_rx: {
                readonly type: "boolean";
                readonly default: false;
            };
            readonly strict_minimum_necessary: {
                readonly type: "boolean";
                readonly default: true;
            };
        };
        readonly required: readonly ["patient_id"];
    };
    readonly output_schema: {
        readonly type: "object";
        readonly properties: {
            readonly patient: {
                readonly type: "object";
            };
            readonly insurance: {
                readonly type: "object";
            };
            readonly subscriber: {
                readonly type: "object";
            };
            readonly bcbs: {
                readonly type: "object";
            };
            readonly rx: {
                readonly type: "object";
            };
            readonly readiness: {
                readonly type: "object";
            };
        };
    };
    readonly inputSchema: z.ZodObject<{
        patient_id: z.ZodString;
        policy_id: z.ZodOptional<z.ZodString>;
        include_address: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        include_rx: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        strict_minimum_necessary: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        patient_id: string;
        include_address: boolean;
        include_rx: boolean;
        strict_minimum_necessary: boolean;
        policy_id?: string | undefined;
    }, {
        patient_id: string;
        include_address?: boolean | undefined;
        policy_id?: string | undefined;
        include_rx?: boolean | undefined;
        strict_minimum_necessary?: boolean | undefined;
    }>;
    readonly handler: typeof handlers.handleGetVerificationBundle;
}, {
    readonly name: "search_patient_by_demographics";
    readonly description: "Search for patients by first name, last name, date of birth, and optional ZIP. Returns matches with masked display.";
    readonly input_schema: {
        readonly type: "object";
        readonly properties: {
            readonly first_name: {
                readonly type: "string";
            };
            readonly last_name: {
                readonly type: "string";
            };
            readonly dob: {
                readonly type: "string";
                readonly description: "YYYY-MM-DD";
            };
            readonly zip: {
                readonly type: "string";
            };
        };
        readonly required: readonly ["first_name", "last_name", "dob"];
    };
    readonly output_schema: {
        readonly type: "object";
        readonly properties: {
            readonly matches: {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly properties: {
                        readonly patient_id: {
                            readonly type: "string";
                        };
                        readonly confidence: {
                            readonly type: "string";
                        };
                        readonly display: {
                            readonly type: "object";
                        };
                    };
                };
            };
        };
    };
    readonly inputSchema: z.ZodObject<{
        first_name: z.ZodString;
        last_name: z.ZodString;
        dob: z.ZodString;
        zip: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        first_name: string;
        last_name: string;
        dob: string;
        zip?: string | undefined;
    }, {
        first_name: string;
        last_name: string;
        dob: string;
        zip?: string | undefined;
    }>;
    readonly handler: typeof handlers.handleSearchPatientByDemographics;
}];
export declare function getTool(name: string): (typeof TOOL_DEFINITIONS)[number] | undefined;
export declare function invokeTool(toolName: string, input: unknown, ctx: RequestContext): Promise<{
    output: object;
    error?: {
        code: string;
        message: string;
    };
}>;
//# sourceMappingURL=registry.d.ts.map