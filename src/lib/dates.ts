/**
 * Timezone-safe date utilities.
 * Uses the browser's local timezone for all conversions.
 * Never use .toISOString().split('T')[0] — it returns the UTC date, not the local date.
 */

/** Returns today's date as 'yyyy-MM-dd' in local timezone */
export function localToday(): string {
    return new Date().toLocaleDateString('en-CA')
}

/** Converts a Date or ISO string to 'yyyy-MM-dd' in local timezone */
export function toLocalDate(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d
    return date.toLocaleDateString('en-CA')
}

/** Converts a Date or ISO string to 'HH:mm' in local timezone (24h) */
export function toLocalTime(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

/** Returns start of day in local timezone as ISO string (for DB queries) */
export function localStartOfDay(dateStr?: string): string {
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
    if (!dateStr) { d.setHours(0, 0, 0, 0) }
    return d.toISOString()
}

/** Returns end of day in local timezone as ISO string (for DB queries) */
export function localEndOfDay(dateStr?: string): string {
    const d = dateStr ? new Date(dateStr + 'T23:59:59') : new Date()
    if (!dateStr) { d.setHours(23, 59, 59, 999) }
    return d.toISOString()
}

/** Safely parse a date-only string for display (avoids UTC midnight shift) */
export function parseDateForDisplay(dateStr: string): Date {
    return new Date(dateStr + 'T12:00:00')
}
