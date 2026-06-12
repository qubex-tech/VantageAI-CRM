export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogContext = {
  practiceId?: string
  connectionId?: string
  method?: string
  path?: string
  status?: number
  durationMs?: number
  attempt?: number
  event?: string
  [key: string]: unknown
}

export type Logger = {
  debug: (message: string, context?: LogContext) => void
  info: (message: string, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
  error: (message: string, context?: LogContext) => void
}

const PHI_SENSITIVE_RESOURCES = new Set([
  'patients',
  'patientnotes',
  'commlogs',
  'documents',
  'payments',
  'claims',
  'procedures',
  'procedurelogs',
  'accountmodules',
])

function isPhiPath(path?: string): boolean {
  if (!path) return false
  const segment = path.split('/').filter(Boolean)[0]?.toLowerCase()
  return segment ? PHI_SENSITIVE_RESOURCES.has(segment) : false
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  }
  return JSON.stringify(payload)
}

export const defaultLogger: Logger = {
  debug(message, context) {
    if (process.env.OPEN_DENTAL_DEBUG === '1') {
      console.debug(formatLog('debug', message, sanitizeContext(context)))
    }
  },
  info(message, context) {
    console.log(formatLog('info', message, sanitizeContext(context)))
  },
  warn(message, context) {
    console.warn(formatLog('warn', message, sanitizeContext(context)))
  },
  error(message, context) {
    console.error(formatLog('error', message, sanitizeContext(context)))
  },
}

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return context
  const sanitized = { ...context }
  if (isPhiPath(context.path)) {
    delete sanitized.body
    delete sanitized.responseBody
  }
  return sanitized
}

let activeLogger: Logger = defaultLogger

export function setLogger(logger: Logger): void {
  activeLogger = logger
}

export function getLogger(): Logger {
  return activeLogger
}
