export interface BookingService {
  service_id: string
  price_snapshot: number
  duration_min_snapshot: number
  sort_order: number
  services: { name: string; color: string | null }
}

export interface Booking {
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
  booking_services: BookingService[]
}

export interface ServiceOption {
  id: string
  label: string
  price: number
  duration_min: number
  color: string | null
}

export interface SelectOption {
  id: string
  label: string
  color?: string | null
}

export interface InvoiceInfo {
  id: string
  status: string
  total: number
  amount_paid: number
  balance_due: number
}

export type ViewMode = 'calendar' | 'list'
export type CalendarViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

export const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; color: string }> = {
  scheduled: { bg: 'rgba(56, 189, 248, 0.2)', text: '#38bdf8', label: 'Programado', color: '#0ea5e9' },
  completed: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80', label: 'Completado', color: '#22c55e' },
  no_show: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', label: 'No Asistió', color: '#ef4444' },
  cancelled: { bg: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8', label: 'Cancelado', color: '#64748b' },
}
