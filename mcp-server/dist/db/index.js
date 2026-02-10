"use strict";
/**
 * Data access for Patient and InsurancePolicy. Read-only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.getPatientById = getPatientById;
exports.getInsurancePoliciesByPatientId = getInsurancePoliciesByPatientId;
exports.getInsurancePolicyById = getInsurancePolicyById;
exports.getPrimaryPolicyForPatient = getPrimaryPolicyForPatient;
exports.searchPatientsByDemographics = searchPatientsByDemographics;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.db = prisma;
async function getPatientById(patientId) {
    return prisma.patient.findFirst({
        where: { id: patientId, deletedAt: null },
        select: {
            id: true,
            practiceId: true,
            name: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            primaryPhone: true,
            phone: true,
            email: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
        },
    });
}
async function getInsurancePoliciesByPatientId(patientId) {
    return prisma.insurancePolicy.findMany({
        where: { patientId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
}
async function getInsurancePolicyById(policyId) {
    return prisma.insurancePolicy.findFirst({
        where: { id: policyId },
        include: {
            patient: {
                select: {
                    id: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    dateOfBirth: true,
                    addressLine1: true,
                    city: true,
                    state: true,
                    postalCode: true,
                },
            },
        },
    });
}
async function getPrimaryPolicyForPatient(patientId) {
    return prisma.insurancePolicy.findFirst({
        where: { patientId, isPrimary: true },
        include: {
            patient: {
                select: {
                    id: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    dateOfBirth: true,
                    primaryPhone: true,
                    phone: true,
                    email: true,
                    addressLine1: true,
                    addressLine2: true,
                    city: true,
                    state: true,
                    postalCode: true,
                },
            },
        },
    });
}
/**
 * Search patients by demographics (first_name, last_name, dob; optional zip).
 * Returns matches with confidence and masked display.
 */
async function searchPatientsByDemographics(params) {
    const dob = new Date(params.dob);
    if (isNaN(dob.getTime()))
        return [];
    const dobStart = new Date(dob);
    dobStart.setUTCHours(0, 0, 0, 0);
    const dobEnd = new Date(dobStart);
    dobEnd.setUTCDate(dobEnd.getUTCDate() + 1);
    const where = {
        deletedAt: null,
        dateOfBirth: { gte: dobStart, lt: dobEnd },
    };
    where.firstName = { equals: params.firstName.trim(), mode: 'insensitive' };
    where.lastName = { equals: params.lastName.trim(), mode: 'insensitive' };
    if (params.zip?.trim()) {
        where.postalCode = params.zip.trim();
    }
    const patients = await prisma.patient.findMany({
        where,
        select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            postalCode: true,
        },
        take: 20,
    });
    return patients.map((p) => ({
        patient_id: p.id,
        confidence: params.zip ? 'high' : 'medium',
        display: {
            first_name: p.firstName ?? undefined,
            last_name: p.lastName ?? undefined,
            dob: p.dateOfBirth?.toISOString().slice(0, 10),
            zip_masked: p.postalCode ? `****${p.postalCode.slice(-4)}` : undefined,
        },
    }));
}
//# sourceMappingURL=index.js.map