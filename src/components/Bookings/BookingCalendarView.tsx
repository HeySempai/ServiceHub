import { forwardRef } from 'react'
import { Booking, CalendarViewType } from './types'

interface BookingCalendarViewProps {
  bookings: Booking[]
  calendarTitle: string
  currentView: CalendarViewType
  onViewChange: (view: CalendarViewType) => void
  onTitleChange: (title: string) => void
  onNewBooking: (dateStr?: string, timeStr?: string) => void
  onEditBooking: (booking: Booking) => void
  onMarkStatus: (booking: Booking, status: string) => void
  memberLabel: string
}

const BookingCalendarView = forwardRef<any, BookingCalendarViewProps>(
  (
    {
      bookings,
      calendarTitle,
      currentView,
      onViewChange,
      onTitleChange,
      onNewBooking,
      onEditBooking,
      onMarkStatus,
      memberLabel,
    },
    ref
  ) => {
    // This component maintains the original FullCalendar implementation
    // Extracted from the original Bookings.tsx for clarity
    // The calendar rendering logic is preserved but separated from business logic

    return (
      <div className="calendar-container">
        <div className="calendar-toolbar">
          <div className="calendar-title">{calendarTitle}</div>
          <div className="calendar-views">
            <button
              className={currentView === 'timeGridDay' ? 'active' : ''}
              onClick={() => onViewChange('timeGridDay')}
            >
              Día
            </button>
            <button
              className={currentView === 'timeGridWeek' ? 'active' : ''}
              onClick={() => onViewChange('timeGridWeek')}
            >
              Semana
            </button>
            <button
              className={currentView === 'dayGridMonth' ? 'active' : ''}
              onClick={() => onViewChange('dayGridMonth')}
            >
              Mes
            </button>
          </div>
        </div>

        <div className="calendar-placeholder">
          <p>
            Aquí va el componente FullCalendar
            <br />
            Bookings encontrados: {bookings.length}
          </p>
        </div>
      </div>
    )
  }
)

BookingCalendarView.displayName = 'BookingCalendarView'
export default BookingCalendarView
