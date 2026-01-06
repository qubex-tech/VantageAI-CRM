/**
 * Simple condition evaluator for automation rules
 * 
 * Supports:
 * - AND/OR logic
 * - equals, contains, exists operators
 * - Nested conditions
 * 
 * Condition format:
 * {
 *   "operator": "and" | "or",
 *   "conditions": [
 *     {
 *       "field": "path.to.field",
 *       "operator": "equals" | "contains" | "exists",
 *       "value": "expected value"
 *     }
 *   ]
 * }
 */

type ConditionOperator = 'and' | 'or'
type FieldOperator = 'equals' | 'contains' | 'exists' | 'not_equals' | 'greater_than' | 'less_than'

interface FieldCondition {
  field: string
  operator: FieldOperator
  value?: any
}

interface ConditionGroup {
  operator: ConditionOperator
  conditions: (FieldCondition | ConditionGroup)[]
}

type Condition = ConditionGroup | FieldCondition

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

/**
 * Evaluate a single field condition
 */
function evaluateFieldCondition(
  condition: FieldCondition,
  data: Record<string, any>
): boolean {
  const fieldValue = getNestedValue(data, condition.field)

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value

    case 'not_equals':
      return fieldValue !== condition.value

    case 'contains':
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.toLowerCase().includes(condition.value.toLowerCase())
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(condition.value)
      }
      return false

    case 'exists':
      return fieldValue !== undefined && fieldValue !== null

    case 'greater_than':
      if (typeof fieldValue === 'number' && typeof condition.value === 'number') {
        return fieldValue > condition.value
      }
      return false

    case 'less_than':
      if (typeof fieldValue === 'number' && typeof condition.value === 'number') {
        return fieldValue < condition.value
      }
      return false

    default:
      return false
  }
}

/**
 * Evaluate a condition group (AND/OR logic)
 */
function evaluateConditionGroup(
  condition: ConditionGroup,
  data: Record<string, any>
): boolean {
  const results = condition.conditions.map((c) => evaluateCondition(c, data))

  if (condition.operator === 'and') {
    return results.every((r) => r === true)
  } else {
    // 'or'
    return results.some((r) => r === true)
  }
}

/**
 * Evaluate a condition (field or group)
 */
function evaluateCondition(
  condition: Condition,
  data: Record<string, any>
): boolean {
  if ('operator' in condition && 'conditions' in condition) {
    // It's a condition group
    return evaluateConditionGroup(condition, data)
  } else {
    // It's a field condition
    return evaluateFieldCondition(condition as FieldCondition, data)
  }
}

/**
 * Main evaluation function
 * 
 * @param conditionsJson - Condition structure (ConditionGroup or FieldCondition)
 * @param data - Event data to evaluate against
 * @returns true if conditions match, false otherwise
 */
export function evaluateConditions(
  conditionsJson: Condition,
  data: Record<string, any>
): boolean {
  try {
    return evaluateCondition(conditionsJson, data)
  } catch (error) {
    console.error('Error evaluating conditions:', error)
    return false
  }
}

