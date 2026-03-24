import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Plus, X, UserPlus, ChevronLeft, ChevronRight, ChevronDown, Search, List as ListIcon, Calendar as CalendarIcon, MoreVertical, Edit2, Trash2, CheckCircle, Clock, Smartphone, CalendarDays, DollarSign, AlertCircle } from 'lucide-react'
import { CalendarPicker } from '../components/CalendarPicker'
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
    client_id: string
    service_id: string
    provider_id: string
    clients: { first_name: string; last_name: string; phone?: string; email?: string }
    services: { name: string; duration_min: number; color: string | null; price?: number }
    org_members: { display_name: string; color: string | null }
}

interface SelectOption { id: string; label: string; color?: string | null }

interface InvoiceInfo {
    id: string
    status: string
    total: number
    amount_paid: number
    balance_due: number
}

type ViewMode = 'calendar' | 'list'
type CalendarViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

const STATUS_CONFIG: Record<string, { bg: string, text: string, label: string, color: string }> = {
    'scheduled': { bg: 'rgba(56, 189, 248, 0.2)', text: '#38bdf8', label: 'Programado', color: '#0ea5e9' },
    'completed': { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80', label: 'Completado', color: '#22c55e' },
    'no_show': { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', label: 'No Asistió', color: '#ef4444' },
    'cancelled': { bg: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8', label: 'Cancelado', color: '#64748b' },
}

export function BookingsPage() {
    const { orgMember, memberLabel, memberLabelPlural } = useAuth()
    const calendarRef = useRef<FullCalendar>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)


    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    // View state
    const [viewMode, setViewMode] = useState<ViewMode>('list')
    const [calendarTitle, setCalendarTitle] = useState('')
    const [currentCalView, setCurrentCalView] = useState<CalendarViewType>('timeGridWeek')

    // List view filters
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [providerFilter, setProviderFilter] = useState('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Calendar view options
    const [showViewDropdown, setShowViewDropdown] = useState(false)
    const [showDateDropdown, setShowDateDropdown] = useState(false)
    const dateDropdownRef = useRef<HTMLDivElement>(null)
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)
    const [showWeekends, setShowWeekends] = useState(true)
    const [showCompleted, setShowCompleted] = useState(true)

    // Edit/Create state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [showNewClientForm, setShowNewClientForm] = useState(false)
    const [newClientName, setNewClientName] = useState('')
    const [newClientPhone, setNewClientPhone] = useState('')

    const [clients, setClients] = useState<SelectOption[]>([])
    const [services, setServices] = useState<SelectOption[]>([])
    const [providers, setProviders] = useState<SelectOption[]>([])
    const [paymentMethods, setPaymentMethods] = useState<SelectOption[]>([])

    // Invoice map: bookingId → InvoiceInfo
    const [bookingInvoices, setBookingInvoices] = useState<Map<string, InvoiceInfo>>(new Map())

    // Quick-Pay modal
    const [showPayModal, setShowPayModal] = useState(false)
    const [payTarget, setPayTarget] = useState<{ booking: Booking; invoice: InvoiceInfo | null; clientBalance: number; clientBalanceLoading: boolean } | null>(null)
    const [payMode, setPayMode] = useState<'new' | 'balance'>('new')
    const [payAmount, setPayAmount] = useState('')
    const [payMethodId, setPayMethodId] = useState('')
    const [payNotes, setPayNotes] = useState('')
    const [payingSaving, setPayingSaving] = useState(false)

    const [form, setForm] = useState({ client_id: '', service_id: '', provider_id: '', date: '', time: '09:00', notes: '', status: 'scheduled' })
    const [saving, setSaving] = useState(false)

    // Toast state
    const [toast, setToast] = useState<{ message: string; visible: boolean; isSaving?: boolean }>({ message: '', visible: false })
    const [toastTimeout, setToastTimeout] = useState<NodeJS.Timeout | null>(null)
    const [lastBookingState, setLastBookingState] = useState<{ id: string; start: string; end: string } | null>(null)

    const orgId = orgMember?.org_id

    const fetchBookings = async () => {
        if (!orgId) return

        const start = new Date()
        start.setMonth(start.getMonth() - 6)
        const end = new Date()
        end.setMonth(end.getMonth() + 6)

        const { data } = await supabase
            .from('bookings')
            .select('id, start_at, end_at, status, notes, client_id, service_id, provider_id, clients(first_name, last_name, phone, email), services(name, duration_min, color, price), org_members(display_name, color)')
            .eq('org_id', orgId)
            .gte('start_at', start.toISOString())
            .lt('start_at', end.toISOString())
            .order('start_at', { ascending: false })

        const loaded = (data as unknown as Booking[]) || []
        setBookings(loaded)
        setLoading(false)

        // Fetch invoice info for each booking
        if (loaded.length > 0) {
            const bookingIds = loaded.map(b => b.id)
            const { data: lines } = await supabase
                .from('invoice_lines')
                .select('booking_id, invoices(id, status, total, amount_paid, balance_due)')
                .in('booking_id', bookingIds)

            const map = new Map<string, InvoiceInfo>()
            lines?.forEach((line: any) => {
                if (line.invoices && line.booking_id && !map.has(line.booking_id)) {
                    map.set(line.booking_id, {
                        id: line.invoices.id,
                        status: line.invoices.status,
                        total: parseFloat(line.invoices.total),
                        amount_paid: parseFloat(line.invoices.amount_paid),
                        balance_due: parseFloat(line.invoices.balance_due),
                    })
                }
            })
            setBookingInvoices(map)
        }
    }

    const fetchOptions = async () => {
        if (!orgId) return
        const [c, s, p, pm] = await Promise.all([
            supabase.from('clients').select('id, first_name, last_name').eq('org_id', orgId).eq('active', true).order('last_name'),
            supabase.from('services').select('id, name, duration_min, price').eq('org_id', orgId).eq('active', true).order('name'),
            supabase.from('org_members').select('id, display_name, color').eq('org_id', orgId).eq('can_be_booked', true).eq('active', true),
            supabase.from('payment_methods').select('id, name').eq('org_id', orgId).order('sort_order'),
        ])
        setClients(c.data?.map((x) => ({ id: x.id, label: `${x.first_name} ${x.last_name}` })) || [])
        setServices(s.data?.map((x) => ({ id: x.id, label: x.name })) || [])
        setProviders(p.data?.map((x) => ({ id: x.id, label: x.display_name, color: x.color })) || [])
        setPaymentMethods(pm.data?.map((x) => ({ id: x.id, label: x.name })) || [])
    }

    useEffect(() => { fetchBookings() }, [orgId])
    useEffect(() => { fetchOptions() }, [orgId])

    // Supabase Realtime Subscription
    useEffect(() => {
        if (!orgId) return

        const channel = supabase
            .channel('bookings-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bookings',
                    filter: `org_id=eq.${orgId}`
                },
                (payload) => {
                    console.log('Realtime change received:', payload)
                    if (payload.eventType === 'INSERT') {
                        // For INSERT we might need to fetch the related data (clients, services, org_members)
                        // because the payload only contains the 'bookings' table record.
                        // However, for UX simplicity we can just trigger a fetchBookings()
                        // OR we can try to find if we already have it.
                        // To keep it clean and ensure all relations are there, we fetch.
                        fetchBookings()
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedRecord = payload.new as any
                        setBookings(prev => prev.map(b =>
                            b.id === updatedRecord.id
                                ? { ...b, ...updatedRecord }
                                : b
                        ))
                    } else if (payload.eventType === 'DELETE') {
                        setBookings(prev => prev.filter(b => b.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [orgId])

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if focus is in an input or textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

            const api = calendarRef.current?.getApi()
            if (!api && viewMode === 'calendar') return

            switch (e.key.toLowerCase()) {
                case 'd':
                    if (viewMode === 'calendar') { api?.changeView('timeGridDay'); setCurrentCalView('timeGridDay') }
                    break;
                case 'w':
                    if (viewMode === 'calendar') { api?.changeView('timeGridWeek'); setCurrentCalView('timeGridWeek') }
                    break;
                case 'm':
                    if (viewMode === 'calendar') { api?.changeView('dayGridMonth'); setCurrentCalView('dayGridMonth') }
                    break;
                case 't':
                    if (viewMode === 'calendar') { api?.today() }
                    break;
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [viewMode])

    // Update calendar title hook
    const updateTitle = useCallback(() => {
        const api = calendarRef.current?.getApi()
        if (api) {
            setCalendarTitle(api.view.title || '')
        }
    }, [])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (dropdownRef.current && !dropdownRef.current.contains(target)) {
                setShowViewDropdown(false)
            }
            if (dateDropdownRef.current && !dateDropdownRef.current.contains(target)) {
                setShowDateDropdown(false)
            }
            // Close table action dropdown if clicking outside
            if (activeDropdownId && !(target as HTMLElement).closest('.dropdown-container')) {
                setActiveDropdownId(null)
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeDropdownId])

    // Fix: Update title on initial load and view mode change
    useEffect(() => {
        if (!loading && viewMode === 'calendar') {
            const timer = setTimeout(updateTitle, 200); // Wait for FC to initialize
            return () => clearTimeout(timer);
        }
    }, [loading, viewMode, updateTitle])

    // Form handlers
    const openNewBooking = (dateStr?: string, timeStr?: string) => {
        setEditingId(null)
        setForm({
            client_id: '',
            service_id: '',
            provider_id: orgMember?.id || '',
            date: dateStr || new Date().toISOString().split('T')[0],
            time: timeStr || '09:00',
            notes: '',
            status: 'scheduled'
        })
        setShowNewClientForm(false)
        setShowModal(true)
    }

    const openEditBooking = (b: Booking) => {
        setEditingId(b.id)
        const d = new Date(b.start_at)
        // Adjust for local timezone for the input fields
        const localDate = d.toLocaleDateString('en-CA') // YYYY-MM-DD format
        const localTime = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

        setForm({
            client_id: b.client_id,
            service_id: b.service_id,
            provider_id: b.provider_id,
            date: localDate,
            time: localTime,
            notes: b.notes || '',
            status: b.status
        })
        setShowNewClientForm(false)
        setShowModal(true)
    }

    const handleDeleteBooking = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta cita?')) return
        await supabase.from('bookings').delete().eq('id', id)
        setShowModal(false)
        fetchBookings()
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
        // Default to 1 hr if service not found, real app should look up service duration
        const serviceDuration = 60
        const endAt = new Date(startAt.getTime() + serviceDuration * 60000)

        const payload = {
            org_id: orgId,
            client_id: form.client_id,
            service_id: form.service_id,
            provider_id: form.provider_id,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: form.status,
            notes: form.notes || null,
        }

        if (editingId) {
            await supabase.from('bookings').update(payload).eq('id', editingId)
        } else {
            await supabase.from('bookings').insert(payload)
        }

        setShowModal(false)
        setSaving(false)
        fetchBookings()
    }

    const handleMarkStatus = async (booking: Booking, newStatus: string) => {
        if (!orgId) return
        setToast({ message: 'Actualizando estado...', visible: true, isSaving: true })

        const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id)
        if (error) {
            setToast({ message: 'Error al actualizar', visible: true, isSaving: false })
            return
        }

        // Auto-generate invoice if completed and no invoice exists
        if (newStatus === 'completed' && !bookingInvoices.has(booking.id)) {
            const servicePrice = booking.services?.price || 0
            const dateStr = new Date().toISOString().split('T')[0]
            const yearStr = dateStr.split('-')[0]
            const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true })
            const nextNum = (count || 0) + 1
            const invNumber = `INV-${yearStr}-${nextNum.toString().padStart(4, '0')}`

            const taxRate = 0.16
            const subtotal = servicePrice
            const tax = subtotal * taxRate
            const total = subtotal + tax

            const { data: invData, error: invError } = await supabase.from('invoices').insert({
                org_id: orgId,
                client_id: booking.client_id,
                invoice_number: invNumber,
                status: 'open',
                subtotal,
                tax_total: tax,
                total,
                amount_paid: 0,
                issued_at: dateStr,
                due_at: dateStr
            }).select('id').single()

            if (invData && !invError) {
                await supabase.from('invoice_lines').insert({
                    invoice_id: invData.id,
                    booking_id: booking.id,
                    description: booking.services?.name || 'Servicio',
                    quantity: 1,
                    unit_price: servicePrice,
                    tax_rate: taxRate,
                    tax,
                    total,
                    sort_order: 1
                })
            }
        }

        setToast({ message: 'Estado actualizado', visible: true, isSaving: false })
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000)
        fetchBookings()
    }

    const openPayModal = async (booking: Booking, invoice: InvoiceInfo) => {
        setPayTarget({ booking, invoice, clientBalance: 0, clientBalanceLoading: true })
        setShowPayModal(true)
        setPayAmount(invoice.balance_due.toString())
        setPayMethodId(paymentMethods.length > 0 ? paymentMethods[0].id : '')
        setPayMode('new')
        setPayNotes('')

        // Compute client balance
        const [paymentsRes, invoicesRes] = await Promise.all([
            supabase.from('payments').select('amount').eq('client_id', booking.client_id),
            supabase.from('invoices').select('total').eq('client_id', booking.client_id)
        ])

        const totalPaid = paymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
        const totalInvoiced = invoicesRes.data?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
        const balance = Math.max(0, totalPaid - totalInvoiced)

        setPayTarget({ booking, invoice, clientBalance: balance, clientBalanceLoading: false })
    }

    const handlePayClick = async (booking: Booking, existingInvoice?: InvoiceInfo) => {
        if (!orgId) return

        if (existingInvoice) {
            openPayModal(booking, existingInvoice)
            return
        }

        // Auto-generate invoice if missing (e.g. older completed appointments before quick-pay feature)
        setToast({ message: 'Generando comprobante...', visible: true, isSaving: true })

        const servicePrice = booking.services?.price || 0
        const dateStr = new Date().toISOString().split('T')[0]
        const yearStr = dateStr.split('-')[0]
        const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true })
        const nextNum = (count || 0) + 1
        const invNumber = `INV-${yearStr}-${nextNum.toString().padStart(4, '0')}`

        const taxRate = 0.16
        const subtotal = servicePrice
        const tax = subtotal * taxRate
        const total = subtotal + tax

        const { data: invData, error: invError } = await supabase.from('invoices').insert({
            org_id: orgId,
            client_id: booking.client_id,
            invoice_number: invNumber,
            status: 'open',
            subtotal,
            tax_total: tax,
            total,
            amount_paid: 0,
            issued_at: dateStr,
            due_at: dateStr
        }).select('id, status, total, amount_paid, balance_due').single()

        if (invData && !invError) {
            await supabase.from('invoice_lines').insert({
                invoice_id: invData.id,
                booking_id: booking.id,
                description: booking.services?.name || 'Servicio',
                quantity: 1,
                unit_price: servicePrice,
                tax_rate: taxRate,
                tax,
                total,
                sort_order: 1
            })

            // Fetch to update map so it persists
            fetchBookings()

            const newInvoiceInfo: InvoiceInfo = {
                id: invData.id,
                status: invData.status,
                total: parseFloat(invData.total),
                amount_paid: parseFloat(invData.amount_paid),
                balance_due: parseFloat(invData.balance_due)
            }

            setToast({ ...toast, visible: false })
            openPayModal(booking, newInvoiceInfo)
        } else {
            setToast({ message: 'Error generando comprobante', visible: true, isSaving: false })
        }
    }

    const handlePaySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!payTarget || !payTarget.invoice || !orgId) return

        setPayingSaving(true)
        const invoice = payTarget.invoice
        const amountToPay = payMode === 'balance'
            ? Math.min(payTarget.clientBalance, invoice.balance_due)
            : parseFloat(payAmount)

        if (amountToPay <= 0) {
            setPayingSaving(false)
            return
        }

        await supabase.from('payments').insert({
            org_id: orgId,
            invoice_id: invoice.id,
            client_id: payTarget.booking.client_id,
            method_id: payMode === 'balance' ? null : payMethodId,
            amount: amountToPay,
            date: new Date().toISOString().split('T')[0],
            notes: payMode === 'balance' ? 'Pago con saldo a favor' : payNotes
        })

        const newPaid = invoice.amount_paid + amountToPay
        const newStatus = newPaid >= invoice.total ? 'paid' : 'partial'

        await supabase.from('invoices').update({
            amount_paid: newPaid,
            status: newStatus
        }).eq('id', invoice.id)

        setPayingSaving(false)
        setShowPayModal(false)
        fetchBookings()
    }

    // Filtered bookings for List View
    const filteredBookings = bookings.filter(b => {
        const matchesSearch = b.clients?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.clients?.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.services?.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === 'all' || b.status === statusFilter
        const matchesProvider = providerFilter === 'all' || b.provider_id === providerFilter

        const bookingDate = b.start_at.split('T')[0]
        const matchesStart = !startDate || bookingDate >= startDate
        const matchesEnd = !endDate || bookingDate <= endDate

        return matchesSearch && matchesStatus && matchesProvider && matchesStart && matchesEnd
    })

    // Map bookings to FullCalendar event format
    const events = bookings
        .filter(b => showCompleted || b.status !== 'completed')
        .map(b => ({
            id: b.id,
            title: `${b.clients?.first_name} — ${b.services?.name}`,
            start: b.start_at,
            end: b.end_at,
            backgroundColor: STATUS_CONFIG[b.status]?.color || b.org_members?.color || 'var(--color-accent)',
            borderColor: STATUS_CONFIG[b.status]?.color || b.org_members?.color || 'var(--color-accent)',
            extendedProps: {
                raw: b,
                notes: b.notes,
                status: b.status,
                provider: b.org_members?.display_name
            }
        }))


    return (
        <div style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>

            {/* Custom Google Calendar Style Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>

                {/* Left Controls: View Toggle, Arrows, and Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 10 }}>
                    <div style={{ display: 'flex', background: 'var(--color-bg-secondary)', borderRadius: '20px', padding: '4px', border: '1px solid var(--color-glass-border)' }}>
                        <button
                            style={{ background: viewMode === 'calendar' ? 'var(--color-accent)' : 'transparent', border: 'none', padding: '4px 16px', height: '28px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s ease' }}
                            onClick={() => setViewMode('calendar')}
                            title="Vista Calendario"
                        >
                            <CalendarIcon size={16} color="#ffffff" />
                        </button>
                        <button
                            style={{ background: viewMode === 'list' ? 'var(--color-accent)' : 'transparent', border: 'none', padding: '4px 16px', height: '28px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s ease' }}
                            onClick={() => setViewMode('list')}
                            title="Vista Lista"
                        >
                            <ListIcon size={16} color="#ffffff" />
                        </button>
                    </div>

                    {viewMode === 'calendar' && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn-icon-clear" style={{ height: '36px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }} onClick={() => { calendarRef.current?.getApi().prev(); updateTitle() }}>
                                <ChevronLeft size={20} color="var(--color-text-primary)" />
                            </button>
                            <button className="btn-icon-clear" style={{ height: '36px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }} onClick={() => { calendarRef.current?.getApi().next(); updateTitle() }}>
                                <ChevronRight size={20} color="var(--color-text-primary)" />
                            </button>
                        </div>
                    )}

                    <h2 style={{ fontSize: '22px', fontWeight: 400, margin: 0, minWidth: '200px', textTransform: 'capitalize' }}>
                        {viewMode === 'calendar' ? calendarTitle : 'Todas las Citas'}
                    </h2>
                </div>

                {/* Right Controls: Navigation and Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    {viewMode === 'calendar' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    calendarRef.current?.getApi().today()
                                    updateTitle()
                                }}
                                style={{ padding: '6px 16px', borderRadius: '16px', fontSize: '14px', height: '36px', border: 'none' }}
                            >
                                Hoy
                            </button>
                        </div>
                    )}

                    {viewMode === 'calendar' ? (
                        <div style={{ position: 'relative' }} ref={dropdownRef}>
                            <button
                                className="btn btn-secondary"
                                style={{ borderRadius: '16px', height: '36px', minWidth: '110px', justifyContent: 'space-between', border: 'none' }}
                                onClick={() => setShowViewDropdown(!showViewDropdown)}
                            >
                                {currentCalView === 'timeGridDay' ? 'Día' : currentCalView === 'timeGridWeek' ? 'Semana' : 'Mes'}
                                <ChevronDown size={14} style={{ marginLeft: 8 }} />
                            </button>
                            {showViewDropdown && (
                                <div className="dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '240px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-glass-border)', borderRadius: 'var(--radius-md)', padding: '8px 0', zIndex: 100, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
                                    <button className="dropdown-item" onClick={() => { setCurrentCalView('timeGridDay'); calendarRef.current?.getApi().changeView('timeGridDay'); updateTitle(); setShowViewDropdown(false) }}>
                                        <span style={{ flex: 1 }}>Día</span><span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>D</span>
                                    </button>
                                    <button className="dropdown-item" onClick={() => { setCurrentCalView('timeGridWeek'); calendarRef.current?.getApi().changeView('timeGridWeek'); updateTitle(); setShowViewDropdown(false) }}>
                                        <span style={{ flex: 1 }}>Semana</span><span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>W</span>
                                    </button>
                                    <button className="dropdown-item" onClick={() => { setCurrentCalView('dayGridMonth'); calendarRef.current?.getApi().changeView('dayGridMonth'); updateTitle(); setShowViewDropdown(false) }}>
                                        <span style={{ flex: 1 }}>Mes</span><span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>M</span>
                                    </button>

                                    <div style={{ height: '1px', background: 'var(--color-glass-border)', margin: '8px 0' }} />

                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                        <span>Mostrar fines de semana</span>
                                        <input type="checkbox" checked={showWeekends} onChange={(e) => setShowWeekends(e.target.checked)} />
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                        <span>Mostrar citas completadas</span>
                                        <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />
                                    </label>
                                </div>
                            )}
                        </div>
                    ) : null}

                    <button id="btn-new-booking" className="btn btn-glass-primary" style={{ borderRadius: '16px', height: '36px', border: 'none', padding: '0 16px' }} onClick={() => openNewBooking()}>
                        <Plus size={16} /> Nueva cita
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-screen" style={{ flex: 1 }}><div className="spinner" /></div>
            ) : viewMode === 'calendar' ? (
                <div key="calendar" className="card animate-in" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)' }}>
                    <div className="calendar-container" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'transparent' }}>
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView={currentCalView}
                            headerToolbar={false} // Custom header takes over
                            locale="es"
                            allDaySlot={false}
                            slotMinTime="08:00:00"
                            slotMaxTime="22:00:00"
                            weekends={showWeekends}
                            dayMaxEvents={3}
                            dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
                            dayHeaderContent={(args) => {
                                if (currentCalView === 'dayGridMonth') {
                                    return <span className="fc-custom-weekday" style={{ padding: '8px 0' }}>{args.text.toUpperCase()}</span>
                                }

                                // Proper date parsing for Physio Pulse style
                                const date = args.date;
                                const weekday = date.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '').toUpperCase();
                                const dayNum = date.getDate();

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px 0' }}>
                                        <span className="fc-custom-weekday">{weekday}</span>
                                        <span className="fc-custom-daynum">{dayNum}</span>
                                    </div>
                                )
                            }}
                            slotLabelContent={(args) => {
                                const hour = args.date.getHours();
                                const ampm = hour >= 12 ? 'PM' : 'AM';
                                const h = hour % 12 || 12;
                                return (
                                    <div className="fc-timegrid-slot-label-frame">
                                        <div className="fc-custom-time">{h} {ampm}</div>
                                    </div>
                                );
                            }}
                            events={events}
                            dateClick={(arg) => {
                                const dateStr = arg.dateStr.split('T')[0]
                                const timeStr = arg.dateStr.includes('T') ? arg.dateStr.split('T')[1].substring(0, 5) : '09:00'
                                openNewBooking(dateStr, timeStr)
                            }}
                            eventClick={(info) => {
                                openEditBooking(info.event.extendedProps.raw)
                            }}
                            eventDrop={async (info) => {
                                const newStart = info.event.start?.toISOString()
                                const newEnd = info.event.end?.toISOString()

                                if (newStart && newEnd) {
                                    const oldStart = info.oldEvent.start?.toISOString()
                                    const oldEnd = info.oldEvent.end?.toISOString()

                                    // Save state for Undo
                                    if (oldStart && oldEnd) {
                                        setLastBookingState({ id: info.event.id, start: oldStart, end: oldEnd })
                                    }

                                    // 1. Show "Saving" Toast
                                    setToast({ message: 'Guardando...', visible: true, isSaving: true })
                                    if (toastTimeout) clearTimeout(toastTimeout)

                                    // 2. Optimistic Update
                                    setBookings(prev => prev.map(b =>
                                        b.id === info.event.id
                                            ? { ...b, start_at: newStart, end_at: newEnd }
                                            : b
                                    ))

                                    // 3. Background Update
                                    const { error } = await supabase.from('bookings').update({
                                        start_at: newStart,
                                        end_at: newEnd
                                    }).eq('id', info.event.id)

                                    if (error) {
                                        console.error('Error updating booking:', error)
                                        setToast({ message: 'Error al guardar', visible: true })
                                        // Revert on error
                                        fetchBookings()
                                    } else {
                                        // Update toast with formatted time
                                        const timeStr = info.event.start?.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
                                        setToast({ message: `Se reprogramó el evento para las ${timeStr}`, visible: true, isSaving: false })

                                        const timeout = setTimeout(() => {
                                            setToast(prev => ({ ...prev, visible: false }))
                                        }, 5000)
                                        setToastTimeout(timeout)
                                    }
                                }
                            }}
                            height="100%"
                            expandRows={true}
                            nowIndicator={true}
                            editable={true}
                            selectable={true}
                            datesSet={updateTitle}
                        />
                    </div>
                </div>
            ) : (
                <div key="list" className="card animate-in" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)', padding: 'var(--space-md)' }}>

                    {/* List View Filters */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-glass-border)', marginBottom: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                                <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--color-text-tertiary)' }} />
                                <input
                                    className="form-input"
                                    style={{ paddingLeft: 36 }}
                                    placeholder="Buscar paciente o servicio..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <button
                                style={{ borderRadius: '16px', height: '36px', gap: '8px' }}
                                className={`btn ${startDate === new Date().toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0] ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    if (startDate === today && endDate === today) {
                                        setStartDate('');
                                        setEndDate('');
                                    } else {
                                        setStartDate(today);
                                        setEndDate(today);
                                    }
                                }}
                            >
                                <CalendarDays size={16} /> Hoy
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                {/* Status Filter Dropdown */}
                                <div className="dropdown-container" style={{ position: 'relative' }}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ borderRadius: '16px', height: '36px', gap: '8px', minWidth: '160px', justifyContent: 'space-between' }}
                                        onClick={() => setActiveDropdownId(activeDropdownId === 'status' ? null : 'status')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                            {statusFilter !== 'all' && (
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_CONFIG[statusFilter]?.color, flexShrink: 0 }} />
                                            )}
                                            <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {statusFilter === 'all' ? 'Todos los estados' : (STATUS_CONFIG[statusFilter]?.label || statusFilter)}
                                            </span>
                                        </div>
                                        <ChevronDown size={14} />
                                    </button>
                                    {activeDropdownId === 'status' && (
                                        <div className="dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '200px', zIndex: 100 }}>
                                            <button className="dropdown-item" onClick={() => { setStatusFilter('all'); setActiveDropdownId(null); }}>
                                                Todos los estados
                                            </button>
                                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                                <button key={key} className="dropdown-item" onClick={() => { setStatusFilter(key); setActiveDropdownId(null); }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: config.color }} />
                                                        {config.label}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Provider Filter Dropdown */}
                                <div className="dropdown-container" style={{ position: 'relative' }}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ borderRadius: '16px', height: '36px', gap: '8px', minWidth: '180px', justifyContent: 'space-between' }}
                                        onClick={() => setActiveDropdownId(activeDropdownId === 'provider' ? null : 'provider')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                            {providerFilter !== 'all' && (
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: providers.find(p => p.id === providerFilter)?.color || 'var(--color-accent)', flexShrink: 0 }} />
                                            )}
                                            <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {providerFilter === 'all' ? `Todos los ${memberLabelPlural.toLowerCase()}` : (providers.find(p => p.id === providerFilter)?.label || providerFilter)}
                                            </span>
                                        </div>
                                        <ChevronDown size={14} />
                                    </button>
                                    {activeDropdownId === 'provider' && (
                                        <div className="dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '220px', zIndex: 100 }}>
                                            <button className="dropdown-item" onClick={() => { setProviderFilter('all'); setActiveDropdownId(null); }}>
                                                Todos los {memberLabelPlural.toLowerCase()}
                                            </button>
                                            {providers.map(p => (
                                                <button key={p.id} className="dropdown-item" onClick={() => { setProviderFilter(p.id); setActiveDropdownId(null); }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || 'var(--color-accent)' }} />
                                                        {p.label}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ height: '24px', width: '1px', background: 'var(--color-glass-border)' }} />

                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ position: 'relative' }} ref={dateDropdownRef}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ borderRadius: '16px', height: '36px', gap: '8px', minWidth: '220px', justifyContent: 'space-between' }}
                                        onClick={() => setShowDateDropdown(!showDateDropdown)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CalendarDays size={14} className="text-tertiary" />
                                            <span style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                {(() => {
                                                    if (!startDate) return 'Seleccionar rango';

                                                    const start = new Date(startDate + 'T00:00:00');
                                                    const month = start.toLocaleString('es-MX', { month: 'short' }).replace('.', '');
                                                    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);

                                                    if (!endDate) return `${capitalizedMonth} ${start.getDate()}, ${start.getFullYear()}`;

                                                    const end = new Date(endDate + 'T00:00:00');
                                                    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
                                                        return `${capitalizedMonth}${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
                                                    }

                                                    const endMonth = end.toLocaleString('es-MX', { month: 'short' }).replace('.', '');
                                                    const capitalizedEndMonth = endMonth.charAt(0).toUpperCase() + endMonth.slice(1);

                                                    return `${capitalizedMonth}${start.getDate()}-${capitalizedEndMonth}${end.getDate()}, ${start.getFullYear()}`;
                                                })()}
                                            </span>
                                        </div>
                                        <ChevronDown size={14} />
                                    </button>
                                    {showDateDropdown && (
                                        <div className="dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '310px', zIndex: 100, paddingBottom: '8px' }}>
                                            <CalendarPicker
                                                startDate={startDate}
                                                endDate={endDate}
                                                onRangeSelect={(start, end) => {
                                                    setStartDate(start);
                                                    setEndDate(end);
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {(searchQuery || statusFilter !== 'all' || providerFilter !== 'all' || startDate || endDate) && (
                                    <button
                                        className="btn btn-secondary"
                                        style={{ borderRadius: '16px', height: '36px', fontSize: '13px', padding: '0 16px', gap: '8px' }}
                                        onClick={() => {
                                            setSearchQuery('')
                                            setStatusFilter('all')
                                            setProviderFilter('all')
                                            setStartDate('')
                                            setEndDate('')
                                        }}
                                    >
                                        <X size={14} /> Limpiar Filtros
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="table-container" style={{ flex: 1 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ borderBottom: '1px solid var(--color-glass-border)', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                                <tr>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Fecha y Hora</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Cliente</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Servicio</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>{memberLabel}</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Estado</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Pago</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBookings.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>No se encontraron citas.</td></tr>
                                ) : filteredBookings.map(b => (
                                    <tr key={b.id} style={{ borderBottom: '1px solid var(--color-glass-border)', transition: 'background 0.2s', cursor: 'default' }}>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                                <CalendarDays size={14} className="text-tertiary" />
                                                {new Date(b.start_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Clock size={12} />
                                                {new Date(b.start_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - {new Date(b.end_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 500 }}>{b.clients?.first_name} {b.clients?.last_name}</div>
                                            {b.clients?.phone && (
                                                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Smartphone size={12} />
                                                    {b.clients?.phone}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.services?.color || 'var(--color-accent)' }} />
                                                <span style={{ fontWeight: 500 }}>{b.services?.name}</span>
                                            </div>
                                            {b.services?.price && (
                                                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2, marginLeft: 16 }}>
                                                    ${b.services.price.toLocaleString()}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--color-text-secondary)' }}>
                                            {b.org_members?.display_name}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500,
                                                background: STATUS_CONFIG[b.status]?.bg || 'rgba(255,255,255,0.1)',
                                                color: STATUS_CONFIG[b.status]?.text || 'white'
                                            }}>
                                                {STATUS_CONFIG[b.status]?.label || b.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            {(() => {
                                                if (b.status === 'scheduled' || b.status === 'cancelled' || b.status === 'no_show') {
                                                    return <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-tertiary)' }}>—</span>
                                                }
                                                const inv = bookingInvoices.get(b.id)
                                                if (!inv || inv.status === 'open') {
                                                    return <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d' }}>Abierta</span>
                                                }
                                                if (inv.status === 'partial') {
                                                    return <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: 'rgba(249, 115, 22, 0.15)', color: '#fdba74' }}>Parcial</span>
                                                }
                                                if (inv.status === 'paid') {
                                                    return <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>Pagada</span>
                                                }
                                                if (inv.status === 'void') {
                                                    return <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>Anulada</span>
                                                }
                                                return <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-tertiary)' }}>—</span>
                                            })()}
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                {b.status === 'scheduled' && (
                                                    <button className="btn btn-icon btn-hover-success" title="Marcar como Completado" onClick={() => handleMarkStatus(b, 'completed')}>
                                                        <CheckCircle size={18} />
                                                    </button>
                                                )}
                                                {b.status === 'completed' && (!bookingInvoices.get(b.id) || ['open', 'partial'].includes(bookingInvoices.get(b.id)!.status)) && (
                                                    <button className="btn btn-icon btn-hover-success" title="Cobrar / Registrar Pago" onClick={(e) => { e.stopPropagation(); handlePayClick(b, bookingInvoices.get(b.id)); }}>
                                                        <DollarSign size={18} />
                                                    </button>
                                                )}
                                                <div className="dropdown-container" style={{ position: 'relative' }}>
                                                    <button
                                                        className="btn btn-icon btn-hover-accent"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setActiveDropdownId(activeDropdownId === b.id ? null : b.id)
                                                        }}
                                                    >
                                                        <MoreVertical size={18} />
                                                    </button>
                                                    {activeDropdownId === b.id && (
                                                        <div className="dropdown" style={{ position: 'absolute', top: '100%', right: 0, width: '160px', zIndex: 100 }}>
                                                            {/* Dropdown options */}
                                                            {b.status === 'completed' && (!bookingInvoices.get(b.id) || ['open', 'partial'].includes(bookingInvoices.get(b.id)!.status)) && (
                                                                <>
                                                                    <button className="dropdown-item text-success" style={{ color: '#10b981' }} onClick={() => { handlePayClick(b, bookingInvoices.get(b.id)); setActiveDropdownId(null) }}>
                                                                        <DollarSign size={14} style={{ opacity: 1 }} /> Cobrar cita
                                                                    </button>
                                                                    <div style={{ height: '1px', background: 'var(--color-glass-border)', margin: '4px 0' }} />
                                                                </>
                                                            )}
                                                            <button className="dropdown-item" onClick={() => { openEditBooking(b); setActiveDropdownId(null) }}>
                                                                <Edit2 size={14} /> Editar
                                                            </button>
                                                            <div style={{ height: '1px', background: 'var(--color-glass-border)', margin: '4px 0' }} />
                                                            <button className="dropdown-item text-danger" onClick={() => { handleDeleteBooking(b.id); setActiveDropdownId(null) }}>
                                                                <Trash2 size={14} /> Eliminar
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>
            )
            }

            {/* Shared Create/Edit Modal */}
            {
                showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">{editingId ? 'Editar Cita' : 'Nueva Cita'}</h3>
                                <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
                            </div>

                            {/* Render Booking Form */}
                            {!showNewClientForm ? (
                                <form onSubmit={handleSaveBooking}>
                                    <div className="form-group">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                                            <label className="form-label" style={{ marginBottom: 0 }}>Cliente</label>
                                            {!editingId && (
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setShowNewClientForm(true)}
                                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                                >
                                                    <UserPlus size={14} style={{ marginRight: 4 }} /> Nuevo Cliente
                                                </button>
                                            )}
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
                                        <label className="form-label">{memberLabel}</label>
                                        <select className="form-select" required value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
                                            <option value="">Seleccionar {memberLabel.toLowerCase()}</option>
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
                                    {editingId && (
                                        <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                            <label className="form-label">Estado de Cita</label>
                                            <select className="form-select" required value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                                <option value="scheduled">Programado</option>
                                                <option value="completed">Completado</option>
                                                <option value="no_show">No Asistió</option>
                                                <option value="cancelled">Cancelado</option>
                                            </select>
                                        </div>
                                    )}
                                    <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                        <label className="form-label">Notas</label>
                                        <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                                    </div>

                                    <div className="modal-actions" style={{ justifyContent: editingId ? 'space-between' : 'flex-end', marginTop: 'var(--space-xl)' }}>
                                        {editingId ? (
                                            <button type="button" className="btn btn-secondary" style={{ color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)', background: 'rgba(239, 68, 68, 0.1)' }} onClick={() => handleDeleteBooking(editingId)}>
                                                <Trash2 size={16} style={{ marginRight: 6 }} /> Eliminar
                                            </button>
                                        ) : <div />}

                                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                                {saving ? <span className="spinner" /> : 'Guardar'}
                                            </button>
                                        </div>
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
                )
            }

            {/* Quick Pay Modal */}
            {showPayModal && payTarget && payTarget.invoice && (
                <div className="modal-overlay" onClick={() => !payingSaving && setShowPayModal(false)}>
                    <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Registrar Pago</h3>
                            <button className="modal-close" onClick={() => !payingSaving && setShowPayModal(false)}><X size={16} /></button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-md)' }}>
                            <button
                                type="button"
                                className={`btn ${payMode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1 }}
                                onClick={() => setPayMode('new')}
                            >
                                Nuevo Pago
                            </button>
                            <button
                                type="button"
                                className={`btn ${payMode === 'balance' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1 }}
                                disabled={payTarget.clientBalanceLoading || payTarget.clientBalance <= 0}
                                onClick={() => setPayMode('balance')}
                                title={payTarget.clientBalance <= 0 ? "El cliente no tiene saldo a favor" : ""}
                            >
                                Usar Balance
                            </button>
                        </div>

                        <form onSubmit={handlePaySubmit}>
                            <div style={{ background: 'var(--color-glass-surface)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-glass-border)', marginBottom: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Total Comprobante:</span>
                                    <span style={{ fontWeight: 500 }}>${payTarget.invoice.total.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Monto Pagado:</span>
                                    <span style={{ fontWeight: 500 }}>${payTarget.invoice.amount_paid.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Saldo Pendiente:</span>
                                    <span style={{ color: '#f87171', fontWeight: 600 }}>${payTarget.invoice.balance_due.toLocaleString()}</span>
                                </div>
                            </div>

                            {payMode === 'new' ? (
                                <>
                                    <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                                        <label className="form-label">Monto a Pagar</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}>$</span>
                                            <input
                                                type="number"
                                                className="form-input"
                                                style={{ paddingLeft: '28px' }}
                                                required
                                                min="0.01"
                                                step="0.01"
                                                max={payTarget.invoice.balance_due}
                                                value={payAmount}
                                                onChange={e => setPayAmount(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                                        <label className="form-label">Método de Pago</label>
                                        <select className="form-select" required value={payMethodId} onChange={e => setPayMethodId(e.target.value)}>
                                            {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Notas (Opcional)</label>
                                        <textarea className="form-textarea" value={payNotes} onChange={e => setPayNotes(e.target.value)} rows={2} />
                                    </div>
                                </>
                            ) : (
                                <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(52, 211, 153, 0.2)', marginBottom: 'var(--space-md)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '8px', fontWeight: 500 }}>
                                        <AlertCircle size={16} />
                                        Saldo a Favor Disponible
                                    </div>
                                    <div style={{ fontSize: '24px', fontWeight: 600, color: 'white', marginBottom: '16px' }}>
                                        ${payTarget.clientBalance.toLocaleString()}
                                    </div>
                                    <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', margin: 0 }}>
                                        Se aplicarán <strong>${Math.min(payTarget.clientBalance, payTarget.invoice.balance_due).toLocaleString()}</strong> de este saldo para {Math.min(payTarget.clientBalance, payTarget.invoice.balance_due) >= payTarget.invoice.balance_due ? 'liquidar' : 'abonar a'} esta cita.
                                    </p>
                                </div>
                            )}

                            <div className="modal-actions" style={{ marginTop: 'var(--space-xl)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={payingSaving}>
                                    {payingSaving ? <span className="spinner" /> : 'Confirmar Pago'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Toast Notifications */}
            {toast.visible && (
                <div className="toast-container">
                    <div className="toast">
                        <span className="toast-message">{toast.message}</span>
                        {!toast.isSaving && lastBookingState && (
                            <button
                                className="toast-undo"
                                onClick={async () => {
                                    if (!lastBookingState) return
                                    const { id, start, end } = lastBookingState

                                    // Close toast immediately
                                    setToast({ ...toast, visible: false })

                                    // Optimistic Revert
                                    setBookings(prev => prev.map(b =>
                                        b.id === id ? { ...b, start_at: start, end_at: end } : b
                                    ))

                                    // Background Revert
                                    await supabase.from('bookings').update({
                                        start_at: start,
                                        end_at: end
                                    }).eq('id', id)

                                    setLastBookingState(null)
                                }}
                            >
                                Deshacer
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
