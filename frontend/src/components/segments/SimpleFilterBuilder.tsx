import React, { useState, useEffect } from 'react';
import { SegmentRules } from './RuleBuilder';

interface FilterRow {
  id: string;
  enabled: boolean;
  label: string;
  prefix?: string;
  suffix: string;
  value: number | string;
  type: 'number' | 'select';
  options?: { value: string; label: string }[];
  field: string;
  operator: string;
  min?: number;
  step?: number;
}

const initialRows: FilterRow[] = [
  {
    id: 'visits',
    enabled: true,
    label: 'Customers who visited',
    prefix: 'at least',
    suffix: 'times',
    value: 3,
    type: 'number',
    field: 'visits_count',
    operator: 'greater_than_or_equal',
    min: 1,
    step: 1,
  },
  {
    id: 'spend',
    enabled: false,
    label: 'and spent',
    prefix: 'at least \u20B9',
    suffix: '',
    value: 5000,
    type: 'number',
    field: 'lifetime_spend',
    operator: 'greater_than_or_equal',
    min: 100,
    step: 500,
  },
  {
    id: 'points',
    enabled: false,
    label: 'and have points',
    prefix: 'at least',
    suffix: 'points',
    value: 500,
    type: 'number',
    field: 'points_balance',
    operator: 'greater_than_or_equal',
    min: 50,
    step: 50,
  },
  {
    id: 'tier',
    enabled: false,
    label: 'and are tier',
    suffix: '',
    value: 'GOLD',
    type: 'select',
    field: 'tier',
    operator: 'in',
    options: [
      { value: 'BRONZE', label: 'Bronze' },
      { value: 'SILVER', label: 'Silver' },
      { value: 'GOLD', label: 'Gold' },
      { value: 'PLATINUM', label: 'Platinum' },
      { value: 'GOLD,PLATINUM', label: 'Gold or Platinum' },
    ],
  },
];

interface SimpleFilterBuilderProps {
  onChange: (rules: SegmentRules) => void;
}

export const SimpleFilterBuilder: React.FC<SimpleFilterBuilderProps> = ({ onChange }) => {
  const [rows, setRows] = useState<FilterRow[]>(initialRows);

  const updateRow = (id: string, patch: Partial<FilterRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  useEffect(() => {
    const conditions = rows
      .filter((r) => r.enabled && String(r.value).trim() !== '' && String(r.value) !== 'NaN')
      .map((r) => ({
        field: r.field,
        operator: r.operator,
        value: r.type === 'number' ? Number(r.value) : String(r.value),
      }));

    if (conditions.length === 0) {
      onChange({ operator: 'AND', conditions: [] });
    } else {
      onChange({ operator: 'AND', conditions });
    }
  }, [rows]);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows.map((row, idx) => (
          <div
            key={row.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: row.enabled ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
              opacity: row.enabled ? 1 : 0.5,
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', flexShrink: 0 }}
            />

            <span
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-main)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                minWidth: idx === 0 ? '170px' : '100px',
              }}
            >
              {row.label}
            </span>

            {row.type === 'number' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                {row.prefix && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                    {row.prefix}
                  </span>
                )}
                <input
                  type="number"
                  className="form-input"
                  min={row.min}
                  step={row.step}
                  value={row.value}
                  onChange={(e) => updateRow(row.id, { value: Number(e.target.value) || 0 })}
                  disabled={!row.enabled}
                  style={{ width: '90px', textAlign: 'center', fontWeight: 600 }}
                />
                {row.suffix && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                    {row.suffix}
                  </span>
                )}
              </div>
            ) : (
              <select
                className="form-input"
                value={String(row.value)}
                onChange={(e) => updateRow(row.id, { value: e.target.value })}
                disabled={!row.enabled}
                style={{ flex: 1, fontWeight: 600 }}
              >
                {row.options?.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};