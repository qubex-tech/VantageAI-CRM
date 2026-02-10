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
exports.handleGetPatientIdentity = handleGetPatientIdentity;
exports.handleListInsurancePolicies = handleListInsurancePolicies;
exports.handleGetInsurancePolicyDetails = handleGetInsurancePolicyDetails;
exports.handleGetVerificationBundle = handleGetVerificationBundle;
exports.handleSearchPatientByDemographics = handleSearchPatientByDemographics;
const db = __importStar(require("../db/index.js"));
const masking_js_1 = require("../utils/masking.js");
const readiness_js_1 = require("../utils/readiness.js");
const audit_js_1 = require("../utils/audit.js");
function getPatientNameParts(patient) {
    const first = patient.firstName?.trim();
    const last = patient.lastName?.trim();
    const full = patient.name?.trim();
    let fromName = null;
    if (full) {
        const parts = full.split(/\s+/).filter(Boolean);
        if (parts.length >= 1) {
            fromName =
                parts.length === 1
                    ? { first: parts[0], last: parts[0] }
                    : { first: parts[0], last: parts.slice(1).join(' ') };
        }
    }
    return {
        firstName: first || fromName?.first || '',
        lastName: last || fromName?.last || '',
    };
}
async function handleGetPatientIdentity(input, ctx) {
    const patient = await db.getPatientById(input.patient_id);
    if (!patient) {
        return { output: { error: { code: 'NOT_FOUND', message: 'Patient not found' } }, patientId: input.patient_id };
    }
    const nameParts = getPatientNameParts(patient);
    const output = {
        patient_id: patient.id,
        first_name: nameParts.firstName || undefined,
        last_name: nameParts.lastName || undefined,
        date_of_birth: patient.dateOfBirth?.toISOString().slice(0, 10),
        phone: patient.primaryPhone || patient.phone || undefined,
        email: patient.email || undefined,
    };
    if (input.include_address) {
        output.address = {
            line1: patient.addressLine1 || undefined,
            line2: patient.addressLine2 || undefined,
            city: patient.city || undefined,
            state: patient.state || undefined,
            zip: patient.postalCode || undefined,
        };
    }
    await (0, audit_js_1.writeMcpAuditLog)({
        ...ctx,
        patientId: patient.id,
        policyId: null,
        toolName: 'get_patient_identity',
        fieldsReturned: (0, audit_js_1.collectFieldPaths)(output),
    });
    return { output, patientId: patient.id };
}
async function handleListInsurancePolicies(input, ctx) {
    const patient = await db.getPatientById(input.patient_id);
    if (!patient) {
        return { output: { error: { code: 'NOT_FOUND', message: 'Patient not found' } }, patientId: input.patient_id };
    }
    const policies = await db.getInsurancePoliciesByPatientId(input.patient_id);
    const readiness = policies.map((p) => (0, readiness_js_1.computeReadiness)(p, patient));
    const policiesOut = policies.map((p, i) => ({
        policy_id: p.id,
        payer_name_raw: p.payerNameRaw,
        is_primary: p.isPrimary,
        plan_type: p.planType ?? undefined,
        member_id_masked: (0, masking_js_1.maskLast4)(p.memberId),
        completeness: {
            status: readiness[i].status,
            missing_fields: readiness[i].missing_fields,
        },
    }));
    const output = { policies: policiesOut };
    await (0, audit_js_1.writeMcpAuditLog)({
        ...ctx,
        patientId: patient.id,
        policyId: null,
        toolName: 'list_insurance_policies',
        fieldsReturned: (0, audit_js_1.collectFieldPaths)(output),
    });
    return { output, patientId: patient.id };
}
async function handleGetInsurancePolicyDetails(input, ctx) {
    const policy = await db.getInsurancePolicyById(input.policy_id);
    if (!policy) {
        return {
            output: { error: { code: 'NOT_FOUND', message: 'Policy not found' } },
            patientId: null,
            policyId: input.policy_id,
        };
    }
    const memberIdDisplay = ctx.allowUnmasked ? policy.memberId : (0, masking_js_1.maskLast4)(policy.memberId);
    const groupNumberDisplay = ctx.allowUnmasked
        ? (policy.groupNumber ?? undefined)
        : (policy.groupNumber ? (0, masking_js_1.maskLast4)(policy.groupNumber) : undefined);
    const output = {
        policy_id: policy.id,
        patient_id: policy.patientId,
        payer_name_raw: policy.payerNameRaw,
        plan_name: policy.planName ?? undefined,
        plan_type: policy.planType ?? undefined,
        is_primary: policy.isPrimary,
        member_id_masked: memberIdDisplay,
        group_number_masked: groupNumberDisplay,
        subscriber: {
            subscriber_is_patient: policy.subscriberIsPatient,
            first_name: policy.subscriberFirstName ?? undefined,
            last_name: policy.subscriberLastName ?? undefined,
            dob: policy.subscriberDob?.toISOString().slice(0, 10),
            relationship_to_patient: policy.relationshipToPatient ?? undefined,
        },
        bcbs: {
            alpha_prefix: policy.bcbsAlphaPrefix ?? undefined,
            state_plan: policy.bcbsStatePlan ?? undefined,
        },
    };
    if (input.include_rx) {
        output.rx = {
            rx_bin: policy.rxBin ?? undefined,
            rx_pcn: policy.rxPcn ?? undefined,
            rx_group: policy.rxGroup ?? undefined,
        };
    }
    if (input.include_card_refs) {
        output.card_refs = {
            front_ref: policy.cardFrontRef ?? undefined,
            back_ref: policy.cardBackRef ?? undefined,
        };
    }
    await (0, audit_js_1.writeMcpAuditLog)({
        ...ctx,
        patientId: policy.patientId,
        policyId: policy.id,
        toolName: 'get_insurance_policy_details',
        fieldsReturned: (0, audit_js_1.collectFieldPaths)(output),
    });
    return { output, patientId: policy.patientId, policyId: policy.id };
}
async function handleGetVerificationBundle(input, ctx) {
    let policy;
    let patient;
    if (input.policy_id) {
        const row = await db.getInsurancePolicyById(input.policy_id);
        policy = row;
        patient = row?.patient ?? null;
    }
    else {
        const row = await db.getPrimaryPolicyForPatient(input.patient_id);
        policy = row;
        patient = row?.patient ?? null;
    }
    if (!patient) {
        const p = await db.getPatientById(input.patient_id);
        if (!p) {
            return {
                output: { error: { code: 'NOT_FOUND', message: 'Patient not found' } },
                patientId: input.patient_id,
                policyId: null,
            };
        }
        return {
            output: { error: { code: 'NOT_FOUND', message: 'No insurance policy found for patient' } },
            patientId: input.patient_id,
            policyId: null,
        };
    }
    if (!policy) {
        return {
            output: { error: { code: 'NOT_FOUND', message: 'No insurance policy found for patient' } },
            patientId: patient.id,
            policyId: null,
        };
    }
    const memberIdDisplay = ctx.allowUnmasked ? policy.memberId : (0, masking_js_1.maskLast4)(policy.memberId);
    const groupNumberDisplay = ctx.allowUnmasked
        ? (policy.groupNumber ?? undefined)
        : (policy.groupNumber ? (0, masking_js_1.maskLast4)(policy.groupNumber) : undefined);
    const nameParts = getPatientNameParts(patient);
    const readiness = (0, readiness_js_1.computeReadiness)(policy, patient);
    const output = {
        patient: {
            first_name: nameParts.firstName || undefined,
            last_name: nameParts.lastName || undefined,
            dob: patient.dateOfBirth?.toISOString().slice(0, 10),
            phone: patient.primaryPhone || patient.phone || undefined,
        },
        insurance: {
            payer_name_raw: policy.payerNameRaw,
            member_id_masked: memberIdDisplay,
            group_number_masked: groupNumberDisplay,
            plan_name: policy.planName ?? undefined,
            plan_type: policy.planType ?? undefined,
            is_primary: policy.isPrimary,
        },
        subscriber: {
            subscriber_is_patient: policy.subscriberIsPatient,
            first_name: policy.subscriberFirstName ?? undefined,
            last_name: policy.subscriberLastName ?? undefined,
            dob: policy.subscriberDob?.toISOString().slice(0, 10),
            relationship_to_patient: policy.relationshipToPatient ?? undefined,
        },
        bcbs: {
            alpha_prefix: policy.bcbsAlphaPrefix ?? undefined,
            state_plan: policy.bcbsStatePlan ?? undefined,
        },
        readiness: {
            status: readiness.status,
            missing_fields: readiness.missing_fields,
            warnings: readiness.warnings,
        },
    };
    if (input.include_address) {
        ;
        output.patient.address = {
            line1: patient.addressLine1 ?? undefined,
            city: patient.city ?? undefined,
            state: patient.state ?? undefined,
            zip: patient.postalCode ?? undefined,
        };
    }
    if (input.include_rx) {
        output.rx = {
            rx_bin: policy.rxBin ?? undefined,
            rx_pcn: policy.rxPcn ?? undefined,
            rx_group: policy.rxGroup ?? undefined,
        };
    }
    await (0, audit_js_1.writeMcpAuditLog)({
        ...ctx,
        patientId: patient.id,
        policyId: policy.id,
        toolName: 'get_verification_bundle',
        fieldsReturned: (0, audit_js_1.collectFieldPaths)(output),
    });
    return { output, patientId: patient.id, policyId: policy.id };
}
async function handleSearchPatientByDemographics(input, ctx) {
    const matches = await db.searchPatientsByDemographics({
        firstName: input.first_name,
        lastName: input.last_name,
        dob: input.dob,
        zip: input.zip,
    });
    const output = { matches };
    await (0, audit_js_1.writeMcpAuditLog)({
        ...ctx,
        patientId: null,
        policyId: null,
        toolName: 'search_patient_by_demographics',
        fieldsReturned: (0, audit_js_1.collectFieldPaths)(output),
    });
    return { output, patientId: null };
}
//# sourceMappingURL=handlers.js.map