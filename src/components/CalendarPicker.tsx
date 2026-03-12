import React, { useState, useMemo } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isWithinInterval,
    isBefore,
    startOfDay,
    endOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarPickerProps {
    startDate: string;
    endDate: string;
    onRangeSelect: (start: string, end: string) => void;
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({ startDate, endDate, onRangeSelect }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [hoverDate, setHoverDate] = useState<Date | null>(null);

    const selStart = startDate ? startOfDay(new Date(startDate + 'T00:00:00')) : null;
    const selEnd = endDate ? endOfDay(new Date(endDate + 'T23:59:59')) : null;

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [viewDate]);

    const handleDayClick = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');

        // Logical change: if we have a full range, reset it
        if (startDate && endDate) {
            onRangeSelect(dateStr, '');
            return;
        }

        if (!startDate) {
            // First click
            onRangeSelect(dateStr, '');
        } else {
            // Second click
            const startStr = startDate;
            const start = new Date(startStr + 'T00:00:00');
            if (isBefore(day, start)) {
                onRangeSelect(dateStr, startStr);
            } else {
                onRangeSelect(startStr, dateStr);
            }
        }
    };

    const isInRange = (day: Date) => {
        if (!selStart || !selEnd) return false;
        return isWithinInterval(day, { start: selStart, end: selEnd });
    };

    return (
        <div className="calendar-picker">
            <div className="calendar-picker-header">
                <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="btn-icon">
                    <ChevronLeft size={16} />
                </button>
                <div className="calendar-picker-month">
                    {format(viewDate, 'MMMM yyyy', { locale: es }).toUpperCase()}
                </div>
                <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="btn-icon">
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="calendar-picker-grid">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                    <div key={i} className="calendar-picker-weekday">{d}</div>
                ))}
                {days.map((day, i) => {
                    const isSelected = (selStart && isSameDay(day, selStart)) || (selEnd && isSameDay(day, selEnd));
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, viewDate);

                    return (
                        <div
                            key={i}
                            className={`calendar-picker-day 
                                ${!isCurrentMonth ? 'outside' : ''} 
                                ${isSelected ? 'selected' : ''} 
                                ${isToday ? 'today' : ''} 
                                ${isInRange(day) ? 'in-range' : ''}
                            `}
                            onClick={() => handleDayClick(day)}
                            onMouseEnter={() => setHoverDate(day)}
                            onMouseLeave={() => setHoverDate(null)}
                        >
                            {day.getDate()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
