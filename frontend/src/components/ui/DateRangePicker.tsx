import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export type RangeMode = 'day' | 'week' | 'month' | 'year';

/* ── Pure date helpers (local time, no external libs) ────────────── */

export const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number): Date => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const startOfWeek = (d: Date): Date => {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  return addDays(x, -dow);
};

export const endOfWeek = (d: Date): Date => addDays(startOfWeek(d), 6);

export const startOfMonth = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), 1);

export const endOfMonth = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0);

export const startOfYear = (d: Date): Date => new Date(d.getFullYear(), 0, 1);

export const endOfYear = (d: Date): Date => new Date(d.getFullYear(), 11, 31);

export const rangeForMode = (mode: RangeMode, anchor: Date): [Date, Date] => {
  switch (mode) {
    case 'week':
      return [startOfWeek(anchor), endOfWeek(anchor)];
    case 'month':
      return [startOfMonth(anchor), endOfMonth(anchor)];
    case 'year':
      return [startOfYear(anchor), endOfYear(anchor)];
    case 'day':
    default:
      return [startOfDay(anchor), startOfDay(anchor)];
  }
};

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtDay = (d: Date) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

export const formatRangeLabel = (start: Date, end: Date): string => {
  if (start.getFullYear() === end.getFullYear()
      && start.getMonth() === 0 && start.getDate() === 1
      && end.getMonth() === 11 && end.getDate() === 31) {
    return String(start.getFullYear());
  }
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
      && start.getDate() === 1 && end.getDate() === endOfMonth(start).getDate()) {
    return `${MONTHS_LONG[start.getMonth()]} ${start.getFullYear()}`;
  }
  if (sameDay(start, end)) return fmtDay(start);
  const sameYear = start.getFullYear() === end.getFullYear();
  const endStr = sameYear ? `${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}` : fmtDay(end);
  return `${fmtDay(start)} – ${endStr}`;
};

/* ── Icon-trigger dropdown calendar ──────────────────────────────── */

interface DateRangePickerProps {
  mode: RangeMode;
  startDate: Date;
  endDate: Date;
  onModeChange: (mode: RangeMode) => void;
  onRangeChange: (start: Date, end: Date) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  mode,
  startDate,
  endDate,
  onModeChange,
  onRangeChange,
}) => {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(startDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(startDate.getMonth());
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Keep calendar view in sync when range changes externally
  useEffect(() => {
    setViewYear(startDate.getFullYear());
    setViewMonth(startDate.getMonth());
  }, [startDate]);

  const label = formatRangeLabel(startDate, endDate);

  const applyRange = (s: Date, e: Date) => {
    onRangeChange(s, e);
    setViewYear(s.getFullYear());
    setViewMonth(s.getMonth());
  };

  const handleModeChange = (m: RangeMode) => {
    onModeChange(m);
    const [s, e] = rangeForMode(m, startDate);
    applyRange(s, e);
  };

  const selectDay = (day: Date) => {
    const [s, e] = rangeForMode(mode, day);
    applyRange(s, e);
    setOpen(false);
  };

  const selectYear = (year: number) => {
    applyRange(new Date(year, 0, 1), new Date(year, 11, 31));
    setOpen(false);
  };

  // Day-grid cells for the viewed month (Monday-first)
  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const leadBlanks = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < leadBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const isDaySelected = (day: Date): boolean => {
    if (mode === 'day') return sameDay(day, startDate);
    if (mode === 'week') return sameDay(day, startDate) || sameDay(day, endDate);
    return false;
  };

  const isDayInRange = (day: Date): boolean => {
    if (mode === 'week') return day >= startDate && day <= endDate;
    if (mode === 'month')
      return day.getMonth() === startDate.getMonth() && day.getFullYear() === startDate.getFullYear();
    return false;
  };

  const isYearSelected = (year: number): boolean =>
    mode === 'year' && startDate.getFullYear() === year;

  const handleNavPrev = () => {
    if (mode === 'year') {
      setViewYear(viewYear - 1);
    } else {
      const d = new Date(viewYear, viewMonth - 1, 1);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  const handleNavNext = () => {
    if (mode === 'year') {
      setViewYear(viewYear + 1);
    } else {
      const d = new Date(viewYear, viewMonth + 1, 1);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  const handleToday = () => {
    const [s, e] = rangeForMode(mode, new Date());
    applyRange(s, e);
    setOpen(false);
  };

  const navLabel =
    mode === 'year'
      ? String(viewYear)
      : `${MONTHS_LONG[viewMonth]} ${viewYear}`;

  const modeOptions: { value: RangeMode; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];

  return (
    <div className="date-range-picker" ref={rootRef}>
      {/* Icon trigger — drops the calendar down on click */}
      <button
        type="button"
        className={`date-range-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <Calendar size={15} />
        <span>{label}</span>
        <span className="date-range-trigger-mode">{mode}</span>
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="date-range-popover">
          {/* Mode selector */}
          <div className="period-tabs" style={{ marginBottom: 14 }}>
            {modeOptions.map((opt) => (
              <button
                key={opt.value}
                className={`period-tab ${mode === opt.value ? 'active' : ''}`}
                onClick={() => handleModeChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Month / year navigation */}
          <div className="cal-header">
            <button type="button" className="cal-nav" onClick={handleNavPrev} aria-label="Previous">
              <ChevronLeft size={16} />
            </button>
            <span className="cal-title">{navLabel}</span>
            <button type="button" className="cal-nav" onClick={handleNavNext} aria-label="Next">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Year mode: pick a year. Other modes: pick a day. */}
          {mode === 'year' ? (
            <div className="cal-year-grid">
              {Array.from({ length: 12 }, (_, i) => {
                const year = viewYear - 4 + i;
                return (
                  <button
                    key={year}
                    type="button"
                    className={`cal-year-cell ${isYearSelected(year) ? 'is-selected' : ''} ${
                      year === new Date().getFullYear() ? 'is-current' : ''
                    }`}
                    onClick={() => selectYear(year)}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="cal-dow-row">
                {DOW_LABELS.map((d) => (
                  <span key={d} className="cal-dow">{d}</span>
                ))}
              </div>
              <div className="cal-grid">
                {calendarDays.map((day, i) => {
                  if (!day) return <span key={`b${i}`} className="cal-cell-blank" />;
                  const selected = isDaySelected(day);
                  const inRange = isDayInRange(day) && !selected;
                  const isToday = sameDay(day, startOfDay(new Date()));
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      className={[
                        'cal-day',
                        selected ? 'is-selected' : '',
                        inRange ? 'in-range' : '',
                        isToday ? 'is-today' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => selectDay(day)}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Selection summary */}
          <div className="cal-footer">
            <span className="cal-hint">
              {mode === 'week' && 'Click any day to select its week'}
              {mode === 'month' && 'Click any day to select its month'}
              {mode === 'day' && 'Click any day to select it'}
              {mode === 'year' && 'Click a year'}
            </span>
            <span className="cal-selected-label">{label}</span>
            <button type="button" className="cal-today-btn" onClick={handleToday}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
