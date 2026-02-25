import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Calendar, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Booking {
    id: string
    start_at: string
    end_at: string
    status: string
    notes: string | null
    clients: { first_name: string; last_name: string }
    services: { name: string; duration_min: number; color: string | null }
    org_members: { display_name: string; color: string | null }
}

interface SelectOption { id: string; label: string }

export function BookingsPage() {
    const { orgMember } = useAuth()
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [showModal, setShowModal] = useState(false)
    const [clients, setClients] = useState<SelectOption[]>([])
    const [services, setServices] = useState<SelectOption[]>([])
    const [providers, setProviders] = useState<SelectOption[]>([])
    const [form, setForm] = useState({ client_id: '', service_id: '', provider_id: '', date: '', time: '09:00', notes: '' })
    const [saving, setSaving] = useState(false)

    const orgId = orgMember?.org_id

    const fetchBookings = async () => {
        if (!orgId) return
        const weekStart = getWeekStart(currentDate)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)

        const { data } = await supabase
            .from('bookings')
            .select('id, start_at, end_at, status, notes, clients(first_name, last_name), services(name, duration_min, color), org_members(display_name, color)')
            .eq('org_id', orgId)
            .gte('start_at', weekStart.toISOString())
            .lt('start_at', weekEnd.toISOString())
            .order('start_at')

        setBookings((data as unknown as Booking[]) || [])
        setLoading(false)
    }

    const fetchOptions = async () => {
        if (!orgId) return
        const [c, s, p] = await Promise.all([
            supabase.from('clients').select('id, first_name, last_name').eq('org_id', orgId).eq('active', true).order('last_name'),
            supabase.from('services').select('id, name').eq('org_id', orgId).eq('active', true).order('name'),
            supabase.from('org_members').select('id, display_name').eq('org_id', orgId).eq('can_be_booked', true).eq('active', true),
        ])
        setClients(c.data?.map((x) => ({ id: x.id, label: `${x.first_name} ${x.last_name}` })) || [])
        setServices(s.data?.map((x) => ({ id: x.id, label: x.name })) || [])
        setProviders(p.data?.map((x) => ({ id: x.id, label: x.display_name })) || [])
    }

    useEffect(() => { fetchBookings() }, [orgId, currentDate])
    useEffect(() => { fetchOptions() }, [orgId])

    const getWeekStart = (date: Date) => {
        const d = new Date(date)
        const day = d.getDay()
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
        d.setHours(0, 0, 0, 0)
        return d
    }

    const weekStart = getWeekStart(currentDate)
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + i)
        return d
    })

    const navigateWeek = (dir: number) => {
        const d = new Date(currentDate)
        d.setDate(d.getDate() + dir * 7)
        setCurrentDate(d)
    }

    const statusLabel: Record<string, string> = {
        scheduled: 'Programada', confirmed: 'Confirmada', completed: 'Completada',
        cancelled: 'Cancelada', no_show: 'No Show',
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId) return
        setSaving(true)

        const svc = services.find(s => s.id === form.service_id)
        const startAt = new Date(`${form.date}T${form.time}:00`)
        const endAt = new Date(startAt.getTime() + 60 * 60000) // default 1hr

        await supabase.from('bookings').insert({
            org_id: orgId,
            client_id: form.client_id,
            service_id: form.service_id,
            provider_id: form.provider_id,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: 'scheduled',
            notes: form.notes || null,
        })
        setShowModal(false)
        setForm({ client_id: '', service_id: '', provider_id: '', date: '', time: '09:00', notes: '' })
        setSaving(false)
        fetchBookings()
    }

    const isToday = (d: Date) => {
        const t = new Date()
        return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
    }

    const getBookingsForDay = (day: Date) => {
        return bookings.filter((b) => {
            const bd = new Date(b.start_at)
            return bd.getDate() === day.getDate() && bd.getMonth() === day.getMonth()
        })
    }

    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    return (
        <div className="animate-in">
            <div className="page-header page-header-actions">
                <div>
                    <h2>Agenda</h2>
                    <p>Semana del {weekStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigateWeek(-1)}><ChevronLeft size={16} /></button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date())}>Hoy</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigateWeek(1)}><ChevronRight size={16} /></button>
                    <button id="btn-new-booking" className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Nueva cita
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-screen" style={{ minHeight: 400 }}><div className="spinner" /></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-sm)' }}>
                    {weekDays.map((day, i) => (
                        <div key={i} className="card" style={{
                            minHeight: 300,
                            borderColor: isToday(day) ? 'var(--color-accent)' : undefined,
                            background: isToday(day) ? 'var(--color-accent-soft)' : undefined,
                        }}>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-glass-border)' }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{dayNames[i]}</div>
                                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: isToday(day) ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>{day.getDate()}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                {getBookingsForDay(day).map((b) => (
                                    <div key={b.id} style={{
                                        padding: '6px 8px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: `${b.org_members?.color || 'var(--color-accent)'}18`,
                                        borderLeft: `3px solid ${b.org_members?.color || 'var(--color-accent)'}`,
                                        fontSize: 'var(--font-size-xs)',
                                        cursor: 'pointer',
                                        transition: 'all var(--transition-fast)',
                                    }}>
                                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                            {new Date(b.start_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>
                                            {b.clients?.first_name} {b.clients?.last_name?.charAt(0)}.
                                        </div>
                                        <div style={{ color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                                            {b.services?.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Nueva cita</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Cliente</label>
                                <select className="form-select" required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                                    <option value="">Seleccionar cliente</option>
                                    {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Servicio</label>
                                <select className="form-select" required value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
                                    <option value="">Seleccionar servicio</option>
                                    {services.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Proveedor</label>
                                <select className="form-select" required value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
                                    <option value="">Seleccionar proveedor</option>
                                    {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Fecha</label>
                                    <input className="form-input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hora</label>
                                    <input className="form-input" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Notas</label>
                                <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <span className="spinner" /> : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
