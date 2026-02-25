import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Plus, X, UserPlus } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

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
    const [showModal, setShowModal] = useState(false)

    // Quick client creation state
    const [showNewClientForm, setShowNewClientForm] = useState(false)
    const [newClientName, setNewClientName] = useState('')
    const [newClientPhone, setNewClientPhone] = useState('')

    const [clients, setClients] = useState<SelectOption[]>([])
    const [services, setServices] = useState<SelectOption[]>([])
    const [providers, setProviders] = useState<SelectOption[]>([])

    const [form, setForm] = useState({ client_id: '', service_id: '', provider_id: '', date: '', time: '09:00', notes: '' })
    const [saving, setSaving] = useState(false)

    const orgId = orgMember?.org_id
    const calendarRef = useRef<FullCalendar>(null)

    const fetchBookings = async () => {
        if (!orgId) return

        // Fetch a broad range for the calendar (e.g. current month +/- trailing weeks)
        // For larger apps, this should be tied to FullCalendar's visible dates helper
        const start = new Date()
        start.setMonth(start.getMonth() - 1)
        const end = new Date()
        end.setMonth(end.getMonth() + 2)

        const { data } = await supabase
            .from('bookings')
            .select('id, start_at, end_at, status, notes, clients(first_name, last_name), services(name, duration_min, color), org_members(display_name, color)')
            .eq('org_id', orgId)
            .gte('start_at', start.toISOString())
            .lt('start_at', end.toISOString())

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

    useEffect(() => { fetchBookings() }, [orgId])
    useEffect(() => { fetchOptions() }, [orgId])

    const handleDateClick = (arg: any) => {
        const dateStr = arg.dateStr.split('T')[0]
        const timeStr = arg.dateStr.includes('T') ? arg.dateStr.split('T')[1].substring(0, 5) : '09:00'

        setForm(prev => ({ ...prev, date: dateStr, time: timeStr }))
        setShowNewClientForm(false)
        setShowModal(true)
    }

    const handleCreateClient = async () => {
        if (!newClientName || !orgId) return
        setSaving(true)

        const names = newClientName.split(' ')
        const firstName = names[0]
        const lastName = names.slice(1).join(' ') || ''

        const { data, error } = await supabase.from('clients').insert({
            org_id: orgId,
            first_name: firstName,
            last_name: lastName,
            phone: newClientPhone || null,
        }).select('id, first_name, last_name').single()

        if (data && !error) {
            const newOption = { id: data.id, label: `${data.first_name} ${data.last_name}` }
            setClients(prev => [...prev, newOption].sort((a, b) => a.label.localeCompare(b.label)))
            setForm(prev => ({ ...prev, client_id: data.id }))
            setShowNewClientForm(false)
            setNewClientName('')
            setNewClientPhone('')
        }
        setSaving(false)
    }

    const handleSaveBooking = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId) return
        setSaving(true)

        const startAt = new Date(`${form.date}T${form.time}:00`)
        const endAt = new Date(startAt.getTime() + 60 * 60000)

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

    // Map bookings to FullCalendar event format
    const events = bookings.map(b => ({
        id: b.id,
        title: `${b.clients?.first_name} — ${b.services?.name}`,
        start: b.start_at,
        end: b.end_at,
        backgroundColor: b.org_members?.color || 'var(--color-accent)',
        borderColor: b.org_members?.color || 'var(--color-accent)',
        extendedProps: {
            notes: b.notes,
            status: b.status,
            provider: b.org_members?.display_name
        }
    }))

    return (
        <div className="animate-in" style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
            <div className="page-header page-header-actions" style={{ marginBottom: 'var(--space-md)' }}>
                <div>
                    <h2>Agenda</h2>
                    <p>Gestiona tus citas y disponibilidad</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <button id="btn-new-booking" className="btn btn-primary" onClick={() => {
                        setShowNewClientForm(false)
                        setShowModal(true)
                    }}>
                        <Plus size={16} /> Nueva cita
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-screen" style={{ flex: 1 }}><div className="spinner" /></div>
            ) : (
                <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="calendar-container" style={{ flex: 1, padding: 'var(--space-md)' }}>
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView="timeGridWeek"
                            headerToolbar={{
                                left: 'prev,next today',
                                center: 'title',
                                right: 'dayGridMonth,timeGridWeek,timeGridDay'
                            }}
                            buttonText={{
                                today: 'Hoy',
                                month: 'Mes',
                                week: 'Semana',
                                day: 'Día'
                            }}
                            locale="es"
                            allDaySlot={false}
                            slotMinTime="07:00:00"
                            slotMaxTime="21:00:00"
                            events={events}
                            dateClick={handleDateClick}
                            eventClick={(info) => {
                                // Later: open edit modal or details popover
                                console.log('Event clicked:', info.event)
                            }}
                            height="100%"
                            expandRows={true}
                            nowIndicator={true}
                            editable={true}
                            selectable={true}
                        />
                    </div>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Nueva cita</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>

                        {/* Render Booking Form */}
                        {!showNewClientForm ? (
                            <form onSubmit={handleSaveBooking}>
                                <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                                        <label className="form-label" style={{ marginBottom: 0 }}>Cliente</label>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setShowNewClientForm(true)}
                                            style={{ padding: '4px 8px', fontSize: '12px' }}
                                        >
                                            <UserPlus size={14} style={{ marginRight: 4 }} /> Nuevo Cliente
                                        </button>
                                    </div>
                                    <select className="form-select" required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                                        <option value="">Seleccionar cliente de la base de datos</option>
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
                                        {saving ? <span className="spinner" /> : 'Guardar Cita'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* Render Quick Client Creation Form */
                            <div style={{ background: 'var(--color-glass-surface)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-glass-border)' }}>
                                <h4>Crear Nuevo Cliente Rápido</h4>
                                <p style={{ color: 'var(--color-text-tertiary)', fontSize: '13px', marginBottom: 'var(--space-md)' }}>El cliente se auto-seleccionará para esta cita tras guardarlo.</p>

                                <div className="form-group">
                                    <label className="form-label">Nombre Completo</label>
                                    <input
                                        className="form-input"
                                        autoFocus
                                        placeholder="Ej. Juan Pérez"
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                    />
                                </div>
                                <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                    <label className="form-label">Teléfono (Opcional)</label>
                                    <input
                                        className="form-input"
                                        placeholder="+52..."
                                        value={newClientPhone}
                                        onChange={(e) => setNewClientPhone(e.target.value)}
                                    />
                                </div>

                                <div className="modal-actions" style={{ marginTop: 'var(--space-lg)' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowNewClientForm(false)}>Volver a la Cita</button>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        disabled={saving || !newClientName.trim()}
                                        onClick={handleCreateClient}
                                    >
                                        {saving ? <span className="spinner" /> : 'Crear y Seleccionar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

