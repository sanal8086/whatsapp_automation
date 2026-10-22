import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface SegmentCondition {
  field: string;
  operator: string;
  value: string | number;
}

export interface SegmentRules {
  operator: 'AND' | 'OR';
  conditions: SegmentCondition[];
}

type FieldType = 'number' | 'select' | 'text';

interface FieldDef {
  label: string;
  shortLabel: string;
  type: FieldType;
  operators: string[];
  options?: { value: string; label: string }[];
}

export const RULE_FIELDS: Record<string, FieldDef> = {
  visits_count: {
    label: 'Visit Count',
    shortLabel: 'Visits',
    type: 'number',
    operators: ['greater_than_or_equal', 'greater_than', 'less_than', 'equals'],
  },
  lifetime_spend: {
    label: 'Lifetime Spend (₹)',
    shortLabel: 'Spend ₹',
    type: 'number',
    operators: ['greater_than_or_equal', 'greater_than', 'less_than', 'equals'],
  },
  points_balance: {
    label: 'Points Balance',
    shortLabel: 'Points',
    type: 'number',
    operators: ['greater_than_or_equal', 'greater_than', 'less_than', 'equals'],
  },
  tier: {
    label: 'Loyalty Tier',
    shortLabel: 'Tier',
    type: 'select',
    operators: ['equals'],
    options: [
      { value: 'BRONZE', label: 'Bronze' },
      { value: 'SILVER', label: 'Silver' },
      { value: 'GOLD', label: 'Gold' },
      { value: 'PLATINUM', label: 'Platinum' },
    ],
  },
  inactivity_days: {
    label: 'Days Since Last Visit',
    shortLabel: 'Inactive days',
    type: 'number',
    operators: ['greater_than', 'less_than'],
  },
};

const OPERATOR_LABELS: Record<string, string> = {
  greater_than_or_equal: '≥ is at least',
  greater_than: '> is more than',
  less_than: '< is less than',
  equals: '= is exactly',
  contains: 'contains',
};

const OPERATOR_SYMBOLS: Record<string, string> = {
  greater_than_or_equal: '≥',
  greater_than: '>',
  less_than: '<',
  equals: '=',
  contains: 'contains',
};

export const defaultRules = (): SegmentRules => ({
  operator: 'AND',
  conditions: [{ field: 'visits_count', operator: 'greater_than_or_equal', value: '1' }],
});

export const coerceRules = (rules: SegmentRules): SegmentRules => ({
  operator: rules.operator,
  conditions: rules.conditions.map((c) => ({
    field: c.field,
    operator: c.operator,
    value: RULE_FIELDS[c.field]?.type === 'number' ? Number(c.value) || 0 : String(c.value),
  })),
});

export const describeRules = (rules: SegmentRules): string => {
  if (!rules.conditions.length) return 'All customers';
  const parts = rules.conditions.map((c) => {
    const def = RULE_FIELDS[c.field];
    const label = def?.shortLabel || c.field;
    const symbol = OPERATOR_SYMBOLS[c.operator] || c.operator;
    return `${label} ${symbol} ${c.value}`;
  });
  return parts.join(rules.operator === 'OR' ? ' OR ' : ' AND ');
};

export const hasCompleteRules = (rules: SegmentRules): boolean =>
  rules.conditions.length > 0 &&
  rules.conditions.every((c) => String(c.value).trim() !== '' && String(c.value) !== 'NaN');

interface RuleBuilderProps {
  rules: SegmentRules;
  onChange: (rules: SegmentRules) => void;
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({ rules, onChange }) => {
  const updateCondition = (idx: number, patch: Partial<SegmentCondition>) => {
    const conditions = rules.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ ...rules, conditions });
  };

  const handleFieldChange = (idx: number, field: string) => {
    const def = RULE_FIELDS[field];
    if (!def) return;
    const value = def.type === 'select' ? def.options![0].value : '';
    updateCondition(idx, { field, operator: def.operators[0], value });
  };

  const addCondition = () => {
    onChange({
      ...rules,
      conditions: [...rules.conditions, { field: 'lifetime_spend', operator: 'greater_than_or_equal', value: '' }],
    });
  };

  const removeCondition = (idx: number) => {
    if (rules.conditions.length <= 1) return;
    onChange({ ...rules, conditions: rules.conditions.filter((_, i) => i !== idx) });
  };

  const inputStyle: React.CSSProperties = { minWidth: '0' };

  return (
    <div>
      {/* AND / OR toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {(['AND', 'OR'] as const).map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => onChange({ ...rules, operator: op })}
            className={`btn ${rules.operator === op ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '5px 12px', fontSize: '0.75rem', flex: 1 }}
          >
            {op === 'AND' ? 'Match ALL conditions' : 'Match ANY condition'}
          </button>
        ))}
      </div>

      {/* Condition rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rules.conditions.map((cond, idx) => {
          const def = RULE_FIELDS[cond.field] || RULE_FIELDS.visits_count;
          return (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1.3fr 1fr 1fr 34px', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', width: '52px' }}>
                {idx === 0 ? 'Where' : rules.operator}
              </span>

              <select
                className="form-input"
                style={inputStyle}
                value={cond.field}
                onChange={(e) => handleFieldChange(idx, e.target.value)}
                aria-label="Rule field"
              >
                {Object.entries(RULE_FIELDS).map(([key, f]) => (
                  <option key={key} value={key}>{f.label}</option>
                ))}
              </select>

              <select
                className="form-input"
                style={inputStyle}
                value={cond.operator}
                onChange={(e) => updateCondition(idx, { operator: e.target.value })}
                aria-label="Rule operator"
              >
                {def.operators.map((op) => (
                  <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>
                ))}
              </select>

              {def.type === 'select' ? (
                <select
                  className="form-input"
                  style={inputStyle}
                  value={String(cond.value)}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                  aria-label="Rule value"
                >
                  {def.options!.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={def.type === 'number' ? 'number' : 'text'}
                  className="form-input"
                  style={inputStyle}
                  min={def.type === 'number' ? 0 : undefined}
                  placeholder={def.type === 'number' ? 'e.g. 3' : 'e.g. Mumbai'}
                  value={cond.value}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                  aria-label="Rule value"
                  required
                />
              )}

              <button
                type="button"
                onClick={() => removeCondition(idx)}
                disabled={rules.conditions.length <= 1}
                title="Remove condition"
                style={{
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-dim)',
                  cursor: rules.conditions.length <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '38px',
                  opacity: rules.conditions.length <= 1 ? 0.4 : 1,
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addCondition}
        className="btn btn-secondary"
        style={{ marginTop: '10px', padding: '6px 12px', fontSize: '0.78rem' }}
      >
        <Plus size={14} />
        Add Condition
      </button>
    </div>
  );
};
