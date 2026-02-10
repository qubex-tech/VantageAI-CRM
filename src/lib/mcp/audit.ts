/**
 * Audit every MCP tool call: who, when, purpose, patient_id, policy_id, tool_name, fields returned (paths only).
 */
import { prisma } from '@/lib/db'

export type ActorType = 'agent' | 'user' | 'system'

export interface AuditParams {
  requestId: string
  actorId: string
  actorType: ActorType
  purpose: string
  patientId: string | null
  policyId: string | null
  toolName: string
  fieldsReturned: string[]
}

export async function writeMcpAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.mcpAccessAuditLog.create({
      data: {
        requestId: params.requestId,
        actorId: params.actorId,
        actorType: params.actorType,
        purpose: params.purpose,
        patientId: params.patientId,
        policyId: params.policyId,
        toolName: params.toolName,
        fieldsReturnedJson: params.fieldsReturned as unknown as object,
      },
    })
  } catch (err) {
    console.error('[MCP Audit] Failed to write audit log:', err)
  }
}

export function collectFieldPaths(obj: unknown, prefix = ''): string[] {
  const paths: string[] = []
  if (obj == null) return paths
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      paths.push(...collectFieldPaths(item, `${prefix}[${i}]`))
    })
    return paths
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (value != null && typeof value === 'object' && !(value instanceof Date)) {
        paths.push(...collectFieldPaths(value, path))
      } else {
        paths.push(path)
      }
    }
  }
  return paths
}
