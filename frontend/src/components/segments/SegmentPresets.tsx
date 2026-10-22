import React, { useState } from 'react';
import {
  Crown,
  Repeat,
  Banknote,
  Clock,
  Sparkles,
  Star,
  Users,
  SlidersHorizontal,
} from 'lucide-react';
import { SegmentRules } from './RuleBuilder';

export interface SegmentPreset {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  rules: SegmentRules;
  tweakable: {
    field: string;
    label: string;
    suffix: string;
    min: number;
    step: number;
    defaultValue: number;
    prefix?: string;
  } | null;
}

export const SEGMENT_PRESETS: SegmentPreset[] = [
  {
    id: 'vip',
    title: 'VIP Customers',
    subtitle: 'Gold & Platinum tier members',
    icon: React.createElement(Crown, { size: 20 }),
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.1)',
    rules: { operator: 'AND', conditions: [{ field: 'tier', operator: 'in', value: 'GOLD,PLATINUM' }] },
    tweakable: null,
  },
  {
    id: 'frequent',
    title: 'Frequent Visitors',
    subtitle: 'Visited multiple times',
    icon: React.createElement(Repeat, { size: 20 }),
    color: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.1)',
    rules: { operator: 'AND', conditions: [{ field: 'visits_count', operator: 'greater_than_or_equal', value: 5 }] },
    tweakable: { field: 'visits_count', label: 'Visited at least', suffix: 'times', min: 2, step: 1, defaultValue: 5 },
  },
  {
    id: 'big_spender',
    title: 'Big Spenders',
    subtitle: 'High lifetime spend',
    icon: React.createElement(Banknote, { size: 20 }),
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.1)',
    rules: { operator: 'AND', conditions: [{ field: 'lifetime_spend', operator: 'greater_than_or_equal', value: 5000 }] },
    tweakable: { field: 'lifetime_spend', label: 'Spent at least', suffix: '', min: 100, step: 500, defaultValue: 5000, prefix: '\u20B9' },
  },
  {
    id: 'inactive',
    title: 'Inactive Customers',
    subtitle: 'Haven\'t visited recently',
    icon: React.createElement(Clock, { size: 20 }),
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.1)',
    rules: { operator: 'AND', conditions: [{ field: 'inactivity_days', operator: 'greater_than', value: 30 }] },
    tweakable: { field: 'inactivity_days', label: 'No visit for at least', suffix: 'days', min: 7, step: 1, defaultValue: 30 },
  },
  {
    id: 'new',
    title: 'New Customers',
    subtitle: 'Just joined, 1-2 visits',
    icon: React.createElement(Sparkles, { size: 20 }),
    color: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.1)',
    rules: { operator: 'AND', conditions: [{ field: 'visits_count', operator: 'less_than', value: 3 }] },
    tweakable: null,
  },
  {
    id: 'high_points',
    title: 'High Points Balance',
    subtitle: 'Ready to redeem rewards',
    icon: React.createElement(Star, { size: 20 }),
    color: '#EC4899',
    bg: 'rgba(236, 72, 153, 0.1)',
    rules: { operator: 'AND', conditions: [{ field: 'points_balance', operator: 'greater_than_or_equal', value: 500 }] },
    tweakable: { field: 'points_balance', label: 'Points at least', suffix: 'points', min: 50, step: 50, defaultValue: 500 },
  },
  {
    id: 'all',
    title: 'All Customers',
    subtitle: 'Everyone, no filter applied',
    icon: React.createElement(Users, { size: 20 }),
    color: '#6B7280',
    bg: 'rgba(107, 114, 128, 0.1)',
    rules: { operator: 'AND', conditions: [] },
    tweakable: null,
  },
];

interface PresetPickerProps {
  onChange: (rules: SegmentRules) => void;
  onBuildCustom?: () => void;
}

export const PresetPicker: React.FC<PresetPickerProps> = ({ onChange, onBuildCustom }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tweakValue, setTweakValue] = useState<number>(0);

  const selectedPreset = SEGMENT_PRESETS.find((p) => p.id === selectedId);

  const handleSelect = (preset: SegmentPreset) => {
    setSelectedId(preset.id);
    if (preset.tweakable) {
      setTweakValue(preset.tweakable.defaultValue);
      onChange({
        ...preset.rules,
        conditions: [{ ...preset.rules.conditions[0], value: preset.tweakable.defaultValue }],
      });
    } else {
      onChange(preset.rules);
    }
  };

  const handleTweakChange = (val: number) => {
    setTweakValue(val);
    if (selectedPreset?.tweakable) {
      onChange({
        ...selectedPreset.rules,
        conditions: [{ ...selectedPreset.rules.conditions[0], value: val }],
      });
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {SEGMENT_PRESETS.map((preset) => (
          <div
            key={preset.id}
            onClick={() => handleSelect(preset)}
            style={{
              padding: '14px 12px',
              borderRadius: '10px',
              border: `2px solid ${selectedId === preset.id ? preset.color : 'var(--border-subtle)'}`,
              backgroundColor: selectedId === preset.id ? preset.bg : 'transparent',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: preset.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 8px',
                color: preset.color,
              }}
            >
              {preset.icon}
            </div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.8rem', marginBottom: '2px' }}>
              {preset.title}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{preset.subtitle}</div>
          </div>
        ))}
      </div>

      {selectedPreset?.tweakable && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>
            {selectedPreset.tweakable.label}
          </span>
          {selectedPreset.tweakable.prefix && (
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: selectedPreset.color }}>
              {selectedPreset.tweakable.prefix}
            </span>
          )}
          <input
            type="number"
            className="form-input"
            min={selectedPreset.tweakable.min}
            step={selectedPreset.tweakable.step}
            value={tweakValue}
            onChange={(e) => handleTweakChange(Number(e.target.value) || 0)}
            style={{ width: '100px', textAlign: 'center', fontWeight: 700 }}
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            {selectedPreset.tweakable.suffix}
          </span>
        </div>
      )}

      {onBuildCustom && (
        <button
          type="button"
          onClick={onBuildCustom}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 0',
          }}
        >
          <SlidersHorizontal size={14} />
          Build Custom (advanced)
        </button>
      )}
    </div>
  );
};