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

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ 
    selectedDate, 
    selectedTime, 
    onDateTimeSelect,
    onClose 
}) => {
    const [viewDate, setViewDate] = useState(selectedDate ? new Date(selectedDate) : new Date());
    const [localTime, setLocalTime] = useState(selectedTime || '09:00');

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [viewDate]);

    const handleDayClick = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        onDateTimeSelect(dateStr, localTime);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = e.target.value;
        setLocalTime(time);
        if (selectedDate) {
            onDateTimeSelect(selectedDate, time);
        }
    };

    const parsedDate = selectedDate ? parse(selectedDate, 'yyyy-MM-dd', new Date()) : null;

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px',
            padding: '16px',
            background: 'var(--color-bg-tertiary)',
            borderRadius: '12px',
            border: '1px solid var(--color-glass-border)'
        }}>
            {/* Calendar */}
            <div>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '16px'
                }}>
                    <button 
                        onClick={() => setViewDate(subMonths(viewDate, 1))} 
                        className="btn-icon"
                        style={{ padding: '4px' }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <div style={{ 
                        fontSize: '13px', 
                        fontWeight: 600, 
                        color: 'var(--color-text-primary)',
                        textTransform: 'uppercase'
                    }}>
                        {format(viewDate, 'MMMM yyyy', { locale: es })}
                    </div>
                    <button 
                        onClick={() => setViewDate(addMonths(viewDate, 1))} 
                        className="btn-icon"
                        style={{ padding: '4px' }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '4px',
                    marginBottom: '12px'
                }}>
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                        <div 
                            key={i} 
                            style={{ 
                                textAlign: 'center',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--color-text-tertiary)',
                                padding: '4px'
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
                                onClick={() => handleDayClick(day)}
                                style={{
                                    padding: '6px',
                                    fontSize: '12px',
                                    border: isSelected ? '2px solid var(--color-accent)' : '1px solid transparent',
                                    borderRadius: '6px',
                                    background: isSelected 
                                        ? 'rgba(99, 102, 241, 0.2)' 
                                        : isToday 
                                            ? 'rgba(99, 102, 241, 0.1)'
                                            : 'transparent',
                                    color: isSelected ? 'var(--color-accent)' : isCurrentMonth ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                    cursor: 'pointer',
                                    fontWeight: isSelected || isToday ? 600 : 400,
                                    opacity: isCurrentMonth ? 1 : 0.5,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {day.getDate()}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Time Picker */}
            <div style={{ borderTop: '1px solid var(--color-glass-border)', paddingTop: '16px' }}>
                <label style={{ 
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: '8px'
                }}>
                    Hora
                </label>
                <input
                    type="time"
                    value={localTime}
                    onChange={handleTimeChange}
                    style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-glass-border)',
                        background: 'var(--color-bg-secondary)',
                        color: 'var(--color-text-primary)',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                    }}
                />
            </div>

            {/* Confirm Button */}
            {onClose && (
                <button
                    onClick={onClose}
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '8px' }}
                >
                    Confirmar
                </button>
            )}
        </div>
    );
};
