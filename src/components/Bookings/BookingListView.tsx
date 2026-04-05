import { Edit2, Trash2, CheckCircle, Clock, AlertCircle, MoreVertical, DollarSign } from 'lucide-react'
import { Booking, InvoiceInfo, SelectOption, STATUS_CONFIG } from './types'
import { useState } from 'react'

interface BookingListViewProps {
  bookings: Booking[]
  searchQuery: string
  statusFilter: string
  providerFilter: string
  startDate: string
  endDate: string
  showCompleted: boolean
  onEditBooking: (booking: Booking) => void
  onDeleteBooking: (id: string) => void
  onMarkStatus: (booking: Booking, status: string) => void
  bookingInvoices: Map<string, InvoiceInfo>
  setShowPayModal: (show: boolean) => void
  setPayTarget: (target: any) => void
  providers: SelectOption[]
}

export default function BookingListView({
  bookings,
  searchQuery,
  statusFilter,
  providerFilter,
  startDate,
  endDate,
  showCompleted,
  onEditBooking,
  onDeleteBooking,
  onMarkStatus,
  bookingInvoices,
  setShowPayModal,
  setPayTarget,
  providers,
}: BookingListViewProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)

  // Filter bookings
  let filtered = bookings
    .filter((b) => {
      const clientName = `${b.clients.first_name} ${b.clients.last_name}`.toLowerCase()
      if (searchQuery && !clientName.includes(searchQuery.toLowerCase())) return false

      if (statusFilter !== 'all' && b.status !== statusFilter) return false

      if (providerFilter !== 'all' && b.provider_id !== providerFilter) return false

      if (!showCompleted && b.status === 'completed') return false

      if (startDate) {
        const bookingDate = new Date(b.start_at).toISOString().split('T')[0]
        if (bookingDate < startDate) return false
      }

      if (endDate) {
        const bookingDate = new Date(b.start_at).toISOString().split('T')[0]
        if (bookingDate > endDate) return false
      }

      return true
    })
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())

  const getStatusConfig = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.scheduled

  return (
    <div className="bookings-list">
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No hay citas que mostrar</p>
        </div>
      ) : (
        <table className="bookings-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Fecha & Hora</th>
              <th>Servicios</th>
              <th>Proveedor</th>
              <th>Estado</th>
              <th>Precio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((booking) => {
              const statusConfig = getStatusConfig(booking.status)
              const invoice = bookingInvoices.get(booking.id)
              const bookingDate = new Date(booking.start_at)
              const dateStr = bookingDate.toLocaleDateString('es-MX')
              const timeStr = bookingDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

              return (
                <tr key={booking.id}>
                  <td>{`${booking.clients.first_name} ${booking.clients.last_name}`}</td>
                  <td>{`${dateStr} ${timeStr}`}</td>
                  <td>{booking.services?.name || 'Sin servicio'}</td>
                  <td>{booking.org_members?.display_name}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: statusConfig.bg, color: statusConfig.text }}
                    >
                      {statusConfig.label}
                    </span>
                  </td>
                  <td>${booking.services?.price?.toFixed(2) || '0.00'}</td>
                  <td>
                    <div className="dropdown-container">
                      <button
                        className="btn-icon"
                        onClick={() => setActiveDropdownId(activeDropdownId === booking.id ? null : booking.id)}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {activeDropdownId === booking.id && (
                        <div className="dropdown-menu">
                          <button onClick={() => onEditBooking(booking)} className="dropdown-item">
                            <Edit2 size={14} /> Editar
                          </button>

                          {booking.status !== 'completed' && (
                            <button onClick={() => onMarkStatus(booking, 'completed')} className="dropdown-item">
                              <CheckCircle size={14} /> Completar
                            </button>
                          )}

                          {booking.status === 'scheduled' && (
                            <>
                              <button onClick={() => onMarkStatus(booking, 'no_show')} className="dropdown-item">
                                <AlertCircle size={14} /> No Asistió
                              </button>
                              <button onClick={() => onMarkStatus(booking, 'cancelled')} className="dropdown-item">
                                <Clock size={14} /> Cancelar
                              </button>
                            </>
                          )}

                          {invoice && (
                            <button
                              onClick={() => {
                                setPayTarget({ booking, invoice, clientBalance: 0, clientBalanceLoading: false })
                                setShowPayModal(true)
                              }}
                              className="dropdown-item"
                            >
                              <DollarSign size={14} /> Pagar
                            </button>
                          )}

                          <button onClick={() => onDeleteBooking(booking.id)} className="dropdown-item delete">
                            <Trash2 size={14} /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
