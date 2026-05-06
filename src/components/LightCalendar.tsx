import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

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

interface Provider {
    id: string
    label: string
    color?: string | null
}

const STATUS_COLORS: Record<string, string> = {
    'scheduled': '#0ea5e9',
    'completed': '#22c55e',
    'no_show': '#ef4444',
    'cancelled': '#64748b',
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 8am to 9pm

type LightView = 'day' | 'week'

function getWeekDays(date: Date): Date[] {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
    const monday = new Date(d)
    monday.setDate(diff)
    return Array.from({ length: 7 }, (_, i) => {
        const dd = new Date(monday)
        dd.setDate(monday.getDate() + i)
        return dd
    })
}

function toDateStr(d: Date): string {
    return d.toISOString().split('T')[0]
}

interface LightCalendarProps {
    date: Date
    bookings: Booking[]
    onPrev: () => void
    onNext: () => void
    onToday: () => void
    onEventClick: (booking: Booking) => void
    showCompleted: boolean
    providerFilter: string
    onProviderFilterChange: (id: string) => void
    providers: Provider[]
    memberLabelPlural: string
    onDateChange: (d: Date) => void
}

export function LightCalendar({ date, bookings, onPrev, onNext, onToday, onEventClick, showCompleted, providerFilter, onProviderFilterChange, providers, memberLabelPlural, onDateChange }: LightCalendarProps) {
    const [view, setView] = useState<LightView>('day')
    const [showProviderDropdown, setShowProviderDropdown] = useState(false)

    const weekDays = useMemo(() => getWeekDays(date), [date.toISOString()])
    const dateStr = toDateStr(date)

    const filteredBookings = useMemo(() => {
        return bookings
            .filter(b => showCompleted || b.status !== 'completed')
            .filter(b => providerFilter === 'all' || b.provider_id === providerFilter)
            .sort((a, b) => a.start_at.localeCompare(b.start_at))
    }, [bookings, showCompleted, providerFilter])

    const dayBookings = useMemo(() => {
        return filteredBookings.filter(b => b.start_at.startsWith(dateStr))
    }, [filteredBookings, dateStr])

    const title = view === 'day'
        ? date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
        : (() => {
            const s = weekDays[0]
            const e = weekDays[6]
            const sMonth = s.toLocaleDateString('es-MX', { month: 'short' })
            const eMonth = e.toLocaleDateString('es-MX', { month: 'short' })
            if (sMonth === eMonth) return `${s.getDate()} – ${e.getDate()} ${sMonth}`
            return `${s.getDate()} ${sMonth} – ${e.getDate()} ${eMonth}`
        })()

    const handlePrev = () => {
        if (view === 'week') {
            const d = new Date(date)
            d.setDate(d.getDate() - 7)
            onDateChange(d)
        } else {
            onPrev()
        }
    }

    const handleNext = () => {
        if (view === 'week') {
            const d = new Date(date)
            d.setDate(d.getDate() + 7)
            onDateChange(d)
        } else {
            onNext()
        }
    }

    const providerLabel = providerFilter === 'all'
        ? `Todos`
        : (providers.find(p => p.id === providerFilter)?.label || '')

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--color-glass-border)', flexWrap: 'wrap' }}>
                <button onClick={handlePrev} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}>
                    <ChevronLeft size={20} color="var(--color-text-primary)" />
                </button>
                <button onClick={onToday} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-glass-border)', borderRadius: '12px', padding: '4px 10px', fontSize: '12px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Hoy
                </button>
                <button onClick={handleNext} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}>
                    <ChevronRight size={20} color="var(--color-text-primary)" />
                </button>
                <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-primary)', textTransform: 'capitalize', flex: 1, minWidth: 0 }}>{title}</span>

                {/* Provider filter */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                        style={{ background: providerFilter !== 'all' ? 'var(--color-accent-soft)' : 'var(--color-bg-secondary)', border: '1px solid var(--color-glass-border)', borderRadius: '12px', padding: '4px 10px', fontSize: '12px', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                    >
                        {providerFilter !== 'all' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: providers.find(p => p.id === providerFilter)?.color || 'var(--color-accent)' }} />}
                        {providerLabel}
                        <ChevronDown size={12} />
                    </button>
                    {showProviderDropdown && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: '200px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-glass-border)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 50, overflow: 'hidden' }}>
                            <button className="dropdown-item" style={{ fontSize: '13px' }} onClick={() => { onProviderFilterChange('all'); setShowProviderDropdown(false) }}>
                                Todos los {memberLabelPlural.toLowerCase()}
                            </button>
                            {providers.map(p => (
                                <button key={p.id} className="dropdown-item" style={{ fontSize: '13px' }} onClick={() => { onProviderFilterChange(p.id); setShowProviderDropdown(false) }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color || 'var(--color-accent)' }} />
                                        {p.label}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* View toggle */}
                <div style={{ display: 'flex', background: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px solid var(--color-glass-border)' }}>
                    <button
                        onClick={() => setView('day')}
                        style={{ padding: '4px 10px', fontSize: '12px', border: 'none', borderRadius: '12px', cursor: 'pointer', background: view === 'day' ? 'var(--color-accent)' : 'transparent', color: view === 'day' ? 'white' : 'var(--color-text-secondary)' }}
                    >
                        Día
                    </button>
                    <button
                        onClick={() => setView('week')}
                        style={{ padding: '4px 10px', fontSize: '12px', border: 'none', borderRadius: '12px', cursor: 'pointer', background: view === 'week' ? 'var(--color-accent)' : 'transparent', color: view === 'week' ? 'white' : 'var(--color-text-secondary)' }}
                    >
                        Semana
                    </button>
                </div>
            </div>

            {/* Content */}
            {view === 'day' ? (
                <DayView bookings={dayBookings} dateStr={dateStr} onEventClick={onEventClick} />
            ) : (
                <WeekView weekDays={weekDays} bookings={filteredBookings} onEventClick={onEventClick} onDayClick={(d) => { onDateChange(d); setView('day') }} />
            )}
        </div>
    )
}

/* ─── Day View ─── */
function DayView({ bookings, dateStr, onEventClick }: { bookings: Booking[]; dateStr: string; onEventClick: (b: Booking) => void }) {
    return (
        <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ position: 'relative', minHeight: HOURS.length * 60 }}>
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

                {bookings.map(b => <EventBlock key={b.id} booking={b} onClick={onEventClick} left={56} right={8} />)}

                <NowIndicator dateStr={dateStr} />
            </div>
        </div>
    )
}

/* ─── Week View ─── */
function WeekView({ weekDays, bookings, onEventClick, onDayClick }: { weekDays: Date[]; bookings: Booking[]; onEventClick: (b: Booking) => void; onDayClick: (d: Date) => void }) {
    const todayStr = toDateStr(new Date())

    const bookingsByDay = useMemo(() => {
        const map: Record<string, Booking[]> = {}
        for (const d of weekDays) map[toDateStr(d)] = []
        for (const b of bookings) {
            const ds = b.start_at.split('T')[0]
            if (map[ds]) map[ds].push(b)
        }
        return map
    }, [weekDays, bookings])

    return (
        <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {weekDays.map(d => {
                    const ds = toDateStr(d)
                    const isToday = ds === todayStr
                    const dayBookings = bookingsByDay[ds] || []
                    const weekday = d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '').toUpperCase()
                    const dayNum = d.getDate()

                    return (
                        <div key={ds} style={{ borderBottom: '1px solid var(--color-glass-border)' }}>
                            {/* Day header */}
                            <div
                                onClick={() => onDayClick(d)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', background: isToday ? 'var(--color-accent-soft)' : undefined }}
                            >
                                <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', width: 30 }}>{weekday}</span>
                                <span style={{
                                    fontSize: '14px', fontWeight: 600,
                                    color: isToday ? 'white' : 'var(--color-text-primary)',
                                    background: isToday ? 'var(--color-accent)' : undefined,
                                    borderRadius: '50%', width: 28, height: 28,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>{dayNum}</span>
                                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>
                                    {dayBookings.length > 0 && `${dayBookings.length} cita${dayBookings.length > 1 ? 's' : ''}`}
                                </span>
                            </div>
                            {/* Events list */}
                            {dayBookings.length > 0 && (
                                <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {dayBookings.map(b => {
                                        const start = new Date(b.start_at)
                                        const color = STATUS_COLORS[b.status] || b.org_members?.color || 'var(--color-accent)'
                                        const timeStr = start.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
                                        const serviceName = b.booking_services?.length > 0
                                            ? [...b.booking_services].sort((a, x) => a.sort_order - x.sort_order).map(bs => bs.services?.name).join(', ')
                                            : (b.services?.name || '')

                                        return (
                                            <div
                                                key={b.id}
                                                onClick={(e) => { e.stopPropagation(); onEventClick(b) }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '6px 10px', borderRadius: '6px',
                                                    background: color + '18', borderLeft: `3px solid ${color}`,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', minWidth: 55 }}>{timeStr}</span>
                                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {b.clients?.first_name}
                                                </span>
                                                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                    {serviceName}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ─── Shared Components ─── */
function EventBlock({ booking: b, onClick, left, right }: { booking: Booking; onClick: (b: Booking) => void; left: number; right: number }) {
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
            onClick={() => onClick(b)}
            style={{
                position: 'absolute', top: Math.max(startMin, 0), left, right,
                height: Math.max(duration, 30),
                background: color + '22', borderLeft: `3px solid ${color}`,
                borderRadius: '4px', padding: '4px 8px',
                cursor: 'pointer', overflow: 'hidden', zIndex: 1,
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
}

function NowIndicator({ dateStr }: { dateStr: string }) {
    const todayStr = new Date().toISOString().split('T')[0]
    if (dateStr !== todayStr) return null
    const now = new Date()
    const nowMin = (now.getHours() - 8) * 60 + now.getMinutes()
    if (nowMin < 0 || nowMin > HOURS.length * 60) return null
    return (
        <div style={{ position: 'absolute', top: nowMin, left: 52, right: 0, height: 2, background: '#ef4444', zIndex: 2, borderRadius: 1 }}>
            <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
        </div>
    )
}
