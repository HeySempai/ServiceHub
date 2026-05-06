import React, { useState, useMemo, useRef, useEffect } from 'react';
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
    parse,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DateTimePickerProps {
    selectedDate: string;
    selectedTime: string;
    onDateTimeSelect: (date: string, time: string) => void;
    onClose?: () => void;
}

const QUICK_TIMES = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00',
];

function formatTime12(t: string): string {
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
    selectedDate,
    selectedTime,
    onDateTimeSelect,
    onClose
}) => {
    const [viewDate, setViewDate] = useState(selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date());
    const [localTime, setLocalTime] = useState(selectedTime || '09:00');
    const containerRef = useRef<HTMLDivElement>(null);

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [viewDate]);

    const handleDayClick = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        onDateTimeSelect(dateStr, localTime);
    };

    const handleTimeSelect = (time: string) => {
        setLocalTime(time);
        if (selectedDate) {
            onDateTimeSelect(selectedDate, time);
        }
    };

    const parsedDate = selectedDate ? parse(selectedDate, 'yyyy-MM-dd', new Date()) : null;

    // Click outside to close
    useEffect(() => {
        if (!onClose) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div ref={containerRef} style={{
            display: 'flex',
            gap: 0,
            background: 'var(--color-bg-tertiary)',
            borderRadius: '12px',
            border: '1px solid var(--color-glass-border)',
            overflow: 'hidden',
        }}>
            {/* Calendar side */}
            <div style={{ flex: 1, padding: '14px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                }}>
                    <button
                        onClick={() => setViewDate(subMonths(viewDate, 1))}
                        className="btn-icon"
                        type="button"
                        style={{ padding: '4px' }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        textTransform: 'capitalize'
                    }}>
                        {format(viewDate, 'MMMM yyyy', { locale: es })}
                    </div>
                    <button
                        onClick={() => setViewDate(addMonths(viewDate, 1))}
                        className="btn-icon"
                        type="button"
                        style={{ padding: '4px' }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '3px',
                    marginBottom: '8px'
                }}>
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                        <div
                            key={i}
                            style={{
                                textAlign: 'center',
                                fontSize: '10px',
                                fontWeight: 600,
                                color: 'var(--color-text-tertiary)',
                                padding: '2px'
                            }}
                        >
                            {d}
                        </div>
                    ))}
                    {days.map((day, i) => {
                        const isSelected = parsedDate && isSameDay(day, parsedDate);
                        const isToday = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, viewDate);

                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => handleDayClick(day)}
                                style={{
                                    padding: '5px',
                                    fontSize: '12px',
                                    border: 'none',
                                    borderRadius: '6px',
                                    background: isSelected
                                        ? 'var(--color-accent)'
                                        : isToday
                                            ? 'rgba(99, 102, 241, 0.15)'
                                            : 'transparent',
                                    color: isSelected ? 'white' : isCurrentMonth ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                    cursor: 'pointer',
                                    fontWeight: isSelected || isToday ? 600 : 400,
                                    opacity: isCurrentMonth ? 1 : 0.4,
                                }}
                            >
                                {day.getDate()}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Time side */}
            <div style={{
                width: 90,
                borderLeft: '1px solid var(--color-glass-border)',
                display: 'flex', flexDirection: 'column',
            }}>
                <div style={{ padding: '14px 8px 8px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                    Hora
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px 8px', WebkitOverflowScrolling: 'touch' }}>
                    {QUICK_TIMES.map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => handleTimeSelect(t)}
                            style={{
                                display: 'block', width: '100%',
                                padding: '5px 6px', marginBottom: 2,
                                fontSize: '12px', textAlign: 'center',
                                border: 'none', borderRadius: '6px', cursor: 'pointer',
                                background: localTime === t ? 'var(--color-accent)' : 'transparent',
                                color: localTime === t ? 'white' : 'var(--color-text-secondary)',
                                fontWeight: localTime === t ? 600 : 400,
                            }}
                        >
                            {formatTime12(t)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
