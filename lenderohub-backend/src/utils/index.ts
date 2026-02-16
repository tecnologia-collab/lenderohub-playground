// src/utils/index.ts - Barrel file
export * from './dayjs'

// Common logging helper
export function logError(error: any): void {
  console.error('[ERROR]', error?.message || error)
}
