/**
 * Bookings Page Container
 *
 * This component manages all booking-related functionality including:
 * - Fetching bookings and related data
 * - Calendar and list view rendering
 * - Booking creation/editing/deletion
 * - Quick payments modal
 * - Realtime updates via Supabase
 *
 * NOTE: This is a refactored version from the original BookingsPage.
 * Logic has been preserved but split into reusable sub-components.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Booking, ServiceOption, SelectOption, InvoiceInfo, ViewMode, CalendarViewType, STATUS_CONFIG } from './types'
import BookingCalendarView from './BookingCalendarView'
import BookingListView from './BookingListView'
import BookingForm from './BookingForm'
import BookingFilters from './BookingFilters'
import BookingActions from './BookingActions'
import QuickPayModal from './QuickPayModal'

export default function BookingsContainer() {
  const { orgMember, memberLabel } = useAuth()
  const calendarRef = useRef<any>(null)

  // Main state
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [calendarTitle, setCalendarTitle] = useState('')
  const [currentCalView, setCurrentCalView] = useState<CalendarViewType>('timeGridWeek')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showWeekends, setShowWeekends] = useState(true)
  const [showCompleted, setShowCompleted] = useState(true)

  // Options
  const [clients, setClients] = useState<SelectOption[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [providers, setProviders] = useState<SelectOption[]>([])
  const [paymentMethods, setPaymentMethods] = useState<SelectOption[]>([])
  const [selectedServices, setSelectedServices] = useState<ServiceOption[]>([])

  // Form
  const [form, setForm] = useState({
    client_id: '',
    provider_id: '',
    date: '',
    time: '09:00',
    notes: '',
    status: 'scheduled',
  })
  const [showNewClientForm, setShowNewClientForm] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [saving, setSaving] = useState(false)

  // Invoices
  const [bookingInvoices, setBookingInvoices] = useState<Map<string, InvoiceInfo>>(new Map())

  // Quick pay modal
  const [showPayModal, setShowPayModal] = useState(false)
  const [payTarget, setPayTarget] = useState<any>(null)
  const [payMode, setPayMode] = useState<'new' | 'balance' | ''>('')
  const [payAmount, setPayAmount] = useState('')
  const [payMethodId, setPayMethodId] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [payingSaving, setPayingSaving] = useState(false)

  // Toast
  const [toast, setToast] = useState({ message: '', visible: false, isSaving: false })

  const orgId = orgMember?.org_id

  // ===== DATA FETCHING =====

  const fetchBookings = useCallback(async () => {
    if (!orgId) return

    const start = new Date()
    start.setMonth(start.getMonth() - 6)
    const end = new Date()
    end.setMonth(end.getMonth() + 6)

    const { data } = await supabase
      .from('bookings')
      .select(
        'id, start_at, end_at, status, notes, client_id, service_id, provider_id, clients(first_name, last_name, phone, email), services(name, duration_min, color, price), org_members(display_name, color), booking_services(service_id, price_snapshot, duration_min_snapshot, sort_order, services(name, color))'
      )
      .eq('org_id', orgId)
      .gte('start_at', start.toISOString())
      .lt('start_at', end.toISOString())
      .order('start_at', { ascending: false })

    const loaded = (data as unknown as Booking[]) || []
    setBookings(loaded)
    setLoading(false)

    // Fetch invoice info for each booking
    if (loaded.length > 0) {
      const bookingIds = loaded.map((b) => b.id)
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
  }, [orgId])

  const fetchOptions = useCallback(async () => {
    if (!orgId) return
    const [c, s, p, pm] = await Promise.all([
      supabase.from('clients').select('id, first_name, last_name').eq('org_id', orgId).eq('active', true).order('last_name'),
      supabase.from('services').select('id, name, duration_min, price, color').eq('org_id', orgId).eq('active', true).order('sort_order'),
      supabase.from('org_members').select('id, display_name, color').eq('org_id', orgId).eq('can_be_booked', true).eq('active', true),
      supabase.from('payment_methods').select('id, name').eq('org_id', orgId).order('sort_order'),
    ])
    setClients(c.data?.map((x) => ({ id: x.id, label: `${x.first_name} ${x.last_name}` })) || [])
    setServices(
      s.data?.map((x: any) => ({
        id: x.id,
        label: x.name,
        price: x.price,
        duration_min: x.duration_min,
        color: x.color,
      })) || []
    )
    setProviders(p.data?.map((x) => ({ id: x.id, label: x.display_name, color: x.color })) || [])
    setPaymentMethods(pm.data?.map((x) => ({ id: x.id, label: x.name })) || [])
  }, [orgId])

  // ===== EFFECTS =====

  useEffect(() => {
    fetchBookings()
  }, [orgId, fetchBookings])

  useEffect(() => {
    fetchOptions()
  }, [orgId, fetchOptions])

  // Realtime subscription
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
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            fetchBookings()
          } else if (payload.eventType === 'UPDATE') {
            const updatedRecord = payload.new as any
            setBookings((prev) =>
              prev.map((b) => (b.id === updatedRecord.id ? { ...b, ...updatedRecord } : b))
            )
          } else if (payload.eventType === 'DELETE') {
            setBookings((prev) => prev.filter((b) => b.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, fetchBookings])

  // ===== HANDLERS =====

  const handleOpenNewBooking = (dateStr?: string, timeStr?: string) => {
    setEditingId(null)
    setSelectedServices([])
    setForm({
      client_id: '',
      provider_id: orgMember?.id || '',
      date: dateStr || new Date().toISOString().split('T')[0],
      time: timeStr || '09:00',
      notes: '',
      status: 'scheduled',
    })
    setShowNewClientForm(false)
    setShowModal(true)
  }

  const handleOpenEditBooking = (b: Booking) => {
    setEditingId(b.id)
    const d = new Date(b.start_at)
    const localDate = d.toLocaleDateString('en-CA')
    const localTime = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

    if (b.booking_services?.length > 0) {
      const sorted = [...b.booking_services].sort((a, x) => a.sort_order - x.sort_order)
      setSelectedServices(
        sorted.map((bs) => {
          const found = services.find((s) => s.id === bs.service_id)
          return (
            found || {
              id: bs.service_id,
              label: bs.services?.name || 'Servicio',
              price: Number(bs.price_snapshot),
              duration_min: Number(bs.duration_min_snapshot),
              color: bs.services?.color || null,
            }
          )
        })
      )
    } else if (b.service_id) {
      const found = services.find((s) => s.id === b.service_id)
      setSelectedServices(
        found
          ? [found]
          : [
              {
                id: b.service_id,
                label: b.services?.name || 'Servicio',
                price: b.services?.price || 0,
                duration_min: b.services?.duration_min || 30,
                color: b.services?.color || null,
              },
            ]
      )
    } else {
      setSelectedServices([])
    }

    setForm({
      client_id: b.client_id,
      provider_id: b.provider_id,
      date: localDate,
      time: localTime,
      notes: b.notes || '',
      status: Object.keys(STATUS_CONFIG).includes(b.status) ? b.status : 'scheduled',
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

    const { data, error } = await supabase
      .from('clients')
      .insert({
        org_id: orgId,
        first_name: firstName,
        last_name: lastName,
        phone: newClientPhone || null,
      })
      .select('id, first_name, last_name')
      .single()

    if (data && !error) {
      const newOption = { id: data.id, label: `${data.first_name} ${data.last_name}` }
      setClients((prev) => [...prev, newOption].sort((a, b) => a.label.localeCompare(b.label)))
      setForm((prev) => ({ ...prev, client_id: data.id }))
      setShowNewClientForm(false)
      setNewClientName('')
      setNewClientPhone('')
    }
    setSaving(false)
  }

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || selectedServices.length === 0) return
    setSaving(true)

    const startAt = new Date(`${form.date}T${form.time}:00`)

    const { error } = await supabase.rpc('save_booking', {
      p_booking_id: editingId || null,
      p_org_id: orgId,
      p_client_id: form.client_id,
      p_provider_id: form.provider_id,
      p_start_at: startAt.toISOString(),
      p_status: form.status,
      p_notes: form.notes || null,
      p_service_ids: selectedServices.map((s) => s.id),
      p_prices: selectedServices.map((s) => s.price),
      p_durations: selectedServices.map((s) => s.duration_min),
    })

    if (error) console.error('save_booking error:', error)
    setShowModal(false)
    setSaving(false)
    fetchBookings()
  }

  const handleMarkStatus = async (booking: Booking, newStatus: string) => {
    if (!orgId) return
    setToast({ message: 'Actualizando estado...', visible: true, isSaving: true })

    if (newStatus === 'completed' && !bookingInvoices.has(booking.id)) {
      const { error } = await supabase.rpc('mark_booking_complete', {
        p_booking_id: booking.id,
        p_org_id: orgId,
      })
      if (error) {
        console.error(error)
        setToast({ message: 'Error al completar', visible: true, isSaving: false })
        return
      }
    } else {
      const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id)
      if (error) {
        setToast({ message: 'Error al actualizar', visible: true, isSaving: false })
        return
      }
    }

    setToast({ message: 'Estado actualizado', visible: true, isSaving: false })
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000)
    fetchBookings()
  }

  // ===== RENDER =====

  return (
    <main className="page">
      <div className="page-header">
        <h1>Citas</h1>
        <BookingActions
          onNewBooking={handleOpenNewBooking}
          viewMode={viewMode}
          onViewChange={setViewMode}
        />
      </div>

      <BookingFilters
        viewMode={viewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        providerFilter={providerFilter}
        onProviderChange={setProviderFilter}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        showWeekends={showWeekends}
        onShowWeekendsChange={setShowWeekends}
        showCompleted={showCompleted}
        onShowCompletedChange={setShowCompleted}
        providers={providers}
      />

      {loading ? (
        <div className="loading">Cargando citas...</div>
      ) : viewMode === 'calendar' ? (
        <BookingCalendarView
          ref={calendarRef}
          bookings={bookings}
          calendarTitle={calendarTitle}
          currentView={currentCalView}
          onViewChange={setCurrentCalView}
          onTitleChange={setCalendarTitle}
          onNewBooking={handleOpenNewBooking}
          onEditBooking={handleOpenEditBooking}
          onMarkStatus={handleMarkStatus}
          memberLabel={memberLabel}
        />
      ) : (
        <BookingListView
          bookings={bookings}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          providerFilter={providerFilter}
          startDate={startDate}
          endDate={endDate}
          showCompleted={showCompleted}
          onEditBooking={handleOpenEditBooking}
          onDeleteBooking={handleDeleteBooking}
          onMarkStatus={handleMarkStatus}
          bookingInvoices={bookingInvoices}
          setShowPayModal={setShowPayModal}
          setPayTarget={setPayTarget}
          providers={providers}
        />
      )}

      {showModal && (
        <BookingForm
          editing={editingId}
          form={form}
          onFormChange={setForm}
          selectedServices={selectedServices}
          onServicesChange={setSelectedServices}
          clients={clients}
          services={services}
          providers={providers}
          showNewClientForm={showNewClientForm}
          onShowNewClientForm={setShowNewClientForm}
          newClientName={newClientName}
          onNewClientNameChange={setNewClientName}
          newClientPhone={newClientPhone}
          onNewClientPhoneChange={setNewClientPhone}
          onCreateClient={handleCreateClient}
          onSaveBooking={handleSaveBooking}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}

      {showPayModal && payTarget && (
        <QuickPayModal
          booking={payTarget.booking}
          invoice={payTarget.invoice}
          paymentMethods={paymentMethods}
          payMode={payMode}
          onPayModeChange={setPayMode}
          payAmount={payAmount}
          onPayAmountChange={setPayAmount}
          payMethodId={payMethodId}
          onPayMethodChange={setPayMethodId}
          payNotes={payNotes}
          onPayNotesChange={setPayNotes}
          onClose={() => setShowPayModal(false)}
          saving={payingSaving}
        />
      )}

      {toast.visible && (
        <div className="toast">
          {toast.isSaving ? 'Guardando...' : toast.message}
        </div>
      )}
    </main>
  )
}
