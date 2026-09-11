export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

const BASE = '/api/v1'

export async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(BASE + url, init)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : undefined
  if (!res.ok) {
    const err = data as { error?: string; details?: unknown } | undefined
    throw new ApiError(res.status, err?.error ?? res.statusText, err?.details)
  }
  return data as T
}

export const get = <T>(url: string) => request<T>('GET', url)
export const post = <T>(url: string, body?: unknown) => request<T>('POST', url, body)
export const patch = <T>(url: string, body: unknown) => request<T>('PATCH', url, body)
export const put = <T>(url: string, body: unknown) => request<T>('PUT', url, body)
export const del = (url: string) => request<void>('DELETE', url)

export const exportUrl = `${BASE}/export`
