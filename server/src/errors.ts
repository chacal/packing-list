import type { ZodType } from 'zod'

export class HttpError extends Error {
  statusCode: number
  details?: unknown
  constructor(statusCode: number, message: string, details?: unknown) {
    super(message)
    this.statusCode = statusCode
    this.details = details
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`)
export const conflict = (msg: string) => new HttpError(409, msg)

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data)
  if (!r.success) throw new HttpError(400, 'Invalid request', r.error.issues)
  return r.data
}

export function parseId(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id')
  return n
}

/** Map SQLite constraint failures to HTTP 409 with a readable message. */
export function translateSqliteError(err: unknown): unknown {
  const e = err as { code?: string; errstr?: string; message?: string }
  if (e?.code === 'ERR_SQLITE_ERROR') {
    const msg = `${e.message ?? ''} ${e.errstr ?? ''}`
    if (msg.includes('UNIQUE')) return conflict('A record with that name already exists')
    if (msg.includes('FOREIGN KEY')) return conflict('Referenced record does not exist or is still in use')
    if (msg.includes('CHECK')) return new HttpError(400, 'Value out of range')
  }
  return err
}
