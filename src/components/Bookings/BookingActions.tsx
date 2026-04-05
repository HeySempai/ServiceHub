import { Plus, List as ListIcon, Calendar as CalendarIcon } from 'lucide-react'
import { ViewMode } from './types'

interface BookingActionsProps {
  onNewBooking: () => void
  viewMode: ViewMode
  onViewChange: (mode: ViewMode) => void
}

export default function BookingActions({
  onNewBooking,
  viewMode,
  onViewChange,
}: BookingActionsProps) {
  return (
    <div className="page-actions">
      <div className="view-toggle">
        <button
          className={`btn-view ${viewMode === 'calendar' ? 'active' : ''}`}
          onClick={() => onViewChange('calendar')}
          title="Vista calendario (Ctrl+C)"
        >
          <CalendarIcon size={18} />
          Calendario
        </button>
        <button
          className={`btn-view ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => onViewChange('list')}
          title="Vista lista (Ctrl+L)"
        >
          <ListIcon size={18} />
          Lista
        </button>
      </div>
      <button className="btn-primary" onClick={onNewBooking}>
        <Plus size={18} />
        Nueva Cita
      </button>
    </div>
  )
}
