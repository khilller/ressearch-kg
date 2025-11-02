/**
 * Unicode-safe base64 encoding utilities
 * Handles encoding/decoding of strings that may contain Unicode characters
 */

export function unicodeBtoa(str: string): string {
  // Convert string to UTF-8 bytes, then to base64
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)))
}

export function unicodeAtob(base64: string): string {
  // Decode base64 to bytes, then to UTF-8 string
  const bytes = new Uint8Array([...atob(base64)].map(c => c.charCodeAt(0)))
  return new TextDecoder().decode(bytes)
}

export function encodeArrayForHeader<T>(array: T[]): string {
  return unicodeBtoa(JSON.stringify(array))
}

export function decodeArrayFromHeader<T>(base64: string): T[] {
  return JSON.parse(unicodeAtob(base64))
}