import { Search, ChevronDown } from 'lucide-react'
import { ViewMode, SelectOption } from './types'

interface BookingFiltersProps {
  viewMode: ViewMode
  searchQuery: string
  onSearchChange: (q: string) => void
  statusFilter: string
  onStatusChange: (s: string) => void
  providerFilter: string
  onProviderChange: (p: string) => void
  startDate: string
  onStartDateChange: (d: string) => void
  endDate: string
  onEndDateChange: (d: string) => void
  showWeekends: boolean
  onShowWeekendsChange: (show: boolean) => void
  showCompleted: boolean
  onShowCompletedChange: (show: boolean) => void
  providers: SelectOption[]
}

export default function BookingFilters({
  viewMode,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  providerFilter,
  onProviderChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  showWeekends,
  onShowWeekendsChange,
  showCompleted,
  onShowCompletedChange,
  providers,
}: BookingFiltersProps) {
  if (viewMode === 'calendar') {
    return null // Filters are embedded in calendar view
  }

  return (
    <div className="filters-section">
      <div className="filter-search">
        <Search size={18} />
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="filter-group">
        <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="scheduled">Programado</option>
          <option value="completed">Completado</option>
          <option value="no_show">No Asistió</option>
          <option value="cancelled">Cancelado</option>
        </select>

        {providers.length > 0 && (
          <select value={providerFilter} onChange={(e) => onProviderChange(e.target.value)}>
            <option value="all">Todos los proveedores</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}

        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          placeholder="Desde"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          placeholder="Hasta"
        />
      </div>

      <div className="filter-toggles">
        <label>
          <input
            type="checkbox"
            checked={showWeekends}
            onChange={(e) => onShowWeekendsChange(e.target.checked)}
          />
          Ver fines de semana
        </label>
        <label>
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => onShowCompletedChange(e.target.checked)}
          />
          Ver completadas
        </label>
      </div>
    </div>
  )
}
