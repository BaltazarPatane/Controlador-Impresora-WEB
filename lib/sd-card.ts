/** Parsing for the text returned by Marlin M20 and M23 (not synthesized data). */
export interface SdFile { name: string; size: number | null }

export function parseSdListLine(line: string): SdFile | null {
  const value = line.replace(/^echo:\s*/i, '').trim()
  if (!value || /^\s*(Begin file list|End file list|ok\b|No media|No SD card)/i.test(value)) return null
  // M20 emits 8.3 filename and optionally file size; LONG_FILENAME_HOST_SUPPORT may
  // append a display name, but M23 must receive the first token, not a long label.
  const match = /^([^\s]+)(?:\s+(\d+))?(?:\s+.*)?$/.exec(value)
  if (!match) return null
  const name = match[1]
  if (name.includes('..') || name.startsWith('/') || !/^[A-Za-z0-9_.$~\-/]+$/.test(name)) return null
  if (!/\.(?:gcode|gco|gc|ngc)$/i.test(name)) return null
  const size = match[2] !== undefined ? Number(match[2]) : null
  return { name, size: size !== null && Number.isSafeInteger(size) ? size : null }
}

export function isSdListBegin(line: string): boolean { return /(?:^|\b)Begin file list\b/i.test(line) }
export function isSdListEnd(line: string): boolean { return /(?:^|\b)End file list\b/i.test(line) }
export function isSdFileOpened(line: string): boolean { return /File opened:/i.test(line) }
export function isSdFileOpenFailed(line: string): boolean { return /open failed|file open fail|file not found|open error|Error:.*file/i.test(line) }
