import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Booking {
    id: string
    start_at: string
    end_at: string
    status: string
    notes: string | null
    client_id: string
    service_id: string | null
    provider_id: string
    clients: { first_name: string; last_name: string; phone?: string; email?: string }
    services: { name: string; duration_min: number; color: string | null; price?: number } | null
    org_members: { display_name: string; color: string | null }
    booking_services: { service_id: string; price_snapshot: number; duration_min_snapshot: number; sort_order: number; services: { name: string; color: string | null } }[]
}

const STATUS_COLORS: Record<string, string> = {
    'scheduled': '#0ea5e9',
    'completed': '#22c55e',
    'no_show': '#ef4444',
    'cancelled': '#64748b',
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 8am to 9pm

interface LightCalendarProps {
    date: Date
    bookings: Booking[]
    onPrev: () => void
    onNext: () => void
    onToday: () => void
    onEventClick: (booking: Booking) => void
    showCompleted: boolean
    providerFilter: string
}

export function LightCalendar({ date, bookings, onPrev, onNext, onToday, onEventClick, showCompleted, providerFilter }: LightCalendarProps) {
    const dateStr = date.toISOString().split('T')[0]

    const dayBookings = useMemo(() => {
        return bookings
            .filter(b => b.start_at.startsWith(dateStr))
            .filter(b => showCompleted || b.status !== 'completed')
            .filter(b => providerFilter === 'all' || b.provider_id === providerFilter)
            .sort((a, b) => a.start_at.localeCompare(b.start_at))
    }, [bookings, dateStr, showCompleted, providerFilter])

    const title = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Day header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--color-glass-border)' }}>
                <button onClick={onPrev} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}>
                    <ChevronLeft size={20} color="var(--color-text-primary)" />
                </button>
                <button onClick={onToday} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-glass-border)', borderRadius: '12px', padding: '4px 12px', fontSize: '13px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Hoy
                </button>
                <button onClick={onNext} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}>
                    <ChevronRight size={20} color="var(--color-text-primary)" />
                </button>
                <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>{title}</span>
            </div>

            {/* Time grid */}
            <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ position: 'relative', minHeight: HOURS.length * 60 }}>
                    {/* Hour lines */}
                    {HOURS.map(hour => {
                        const h = hour % 12 || 12
                        const ampm = hour >= 12 ? 'PM' : 'AM'
                        return (
                            <div key={hour} style={{ position: 'absolute', top: (hour - 8) * 60, left: 0, right: 0, height: 60 }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: '1px solid var(--color-glass-border)' }} />
                                <span style={{ position: 'absolute', top: -8, left: 8, fontSize: '11px', color: 'var(--color-text-tertiary)', background: 'var(--color-bg-primary)', padding: '0 4px' }}>
                                    {h} {ampm}
                                </span>
                            </div>
                        )
                    })}

                    {/* Events */}
                    {dayBookings.map(b => {
                        const start = new Date(b.start_at)
                        const end = new Date(b.end_at)
                        const startMin = (start.getHours() - 8) * 60 + start.getMinutes()
                        const duration = Math.max((end.getTime() - start.getTime()) / 60000, 20)
                        const color = STATUS_COLORS[b.status] || b.org_members?.color || 'var(--color-accent)'

                        const serviceName = b.booking_services?.length > 0
                            ? [...b.booking_services].sort((a, x) => a.sort_order - x.sort_order).map(bs => bs.services?.name).join(', ')
                            : (b.services?.name || '')

                        const timeStr = start.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })

                        return (
                            <div
                                key={b.id}
                                onClick={() => onEventClick(b)}
                                style={{
                                    position: 'absolute',
                                    top: Math.max(startMin, 0),
                                    left: 56,
                                    right: 8,
                                    height: Math.max(duration, 30),
                                    background: color + '22',
                                    borderLeft: `3px solid ${color}`,
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    zIndex: 1,
                                }}
                            >
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {b.clients?.first_name} {b.clients?.last_name}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {timeStr} · {serviceName}
                                </div>
                            </div>
                        )
                    })}

                    {/* Now indicator */}
                    {dateStr === new Date().toISOString().split('T')[0] && (() => {
                        const now = new Date()
                        const nowMin = (now.getHours() - 8) * 60 + now.getMinutes()
                        if (nowMin < 0 || nowMin > HOURS.length * 60) return null
                        return (
                            <div style={{ position: 'absolute', top: nowMin, left: 52, right: 0, height: 2, background: '#ef4444', zIndex: 2, borderRadius: 1 }}>
                                <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                            </div>
                        )
                    })()}
                </div>
            </div>
        </div>
    )
}
