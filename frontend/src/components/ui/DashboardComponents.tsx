import React, { useState } from 'react';
import {
  Home,
  Users,
  TrendingUp,
  CheckCircle,
  Calendar,
  Search,
  MoreVertical,
  ArrowUpRight
} from 'lucide-react';

/* ================================================================
   STAT CARD
   A metric card with label, big number, delta text, and optional gradient.
   Pastel tones: 'lavender' | 'aqua-mint' | 'sky-aqua' | 'electric-ice' | 'cornflower'
                 | 'periwinkle' | 'orchid-mist' | 'rose-milk' | 'peach-blush' | 'apricot'
                 | 'butter' | 'lemon-sorbet' | 'pistachio' | 'mint-ice' | 'turquoise'
                 | 'dusty-teal' | 'blue-lilac' | 'cool-lilac' | 'mauve' | 'dusty-rose'
                 | 'views' | 'clients' | 'purchases' | 'neutral'
   ================================================================ */
export type StatCardTone =
  | 'views' | 'clients' | 'purchases' | 'neutral'
  | 'sky-aqua' | 'aqua'
  | 'electric-ice' | 'ice'
  | 'cornflower'
  | 'periwinkle'
  | 'lavender'
  | 'orchid-mist' | 'orchid'
  | 'rose-milk' | 'rose'
  | 'peach-blush' | 'peach'
  | 'apricot-cream' | 'apricot'
  | 'butter-yellow' | 'butter'
  | 'lemon-sorbet' | 'lemon'
  | 'pistachio'
  | 'mint-ice' | 'mint'
  | 'aqua-mint'
  | 'turquoise-mist' | 'turquoise'
  | 'dusty-teal' | 'teal'
  | 'blue-lilac' | 'lilac'
  | 'cool-lilac'
  | 'mauve-cream' | 'mauve'
  | 'dusty-rose'
  | (string & {});

export interface StatCardProps {
  label: string;
  value: string | number;
  delta: string;
  tone?: StatCardTone;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, delta, tone = '', icon, style }) => {
  const iconMap: Record<string, React.ReactNode> = {
    views: <Home size={18} />,
    clients: <Users size={18} />,
    purchases: <CheckCircle size={18} />,
  };

  const isLong = typeof value === 'string' && value.length > 14;

  return (
    <article className={`stat-card ${tone}`} style={style}>
      <div className="stat-label">
        <span>{label}</span>
        <span style={{ opacity: 0.75, display: 'flex', alignItems: 'center' }}>{icon || iconMap[tone] || null}</span>
      </div>
      <div className="stat-body">
        <div
          className="stat-number"
          style={isLong ? { fontSize: '24px', letterSpacing: '-0.7px', lineHeight: 1.25 } : undefined}
        >
          {value}
        </div>
        {delta && <div className="stat-delta">{delta}</div>}
      </div>
    </article>
  );
};

/* ================================================================
   STATS ROW — 3 stat cards in a grid
   ================================================================ */
interface StatsRowProps {
  cards: StatCardProps[];
}

export const StatsRow: React.FC<StatsRowProps> = ({ cards }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cards.length, 4)}, 1fr)`, gap: '18px' }}>
    {cards.map((c, i) => (
      <StatCard key={i} {...c} />
    ))}
  </div>
);

/* ================================================================
   PERIOD TABS
   Week / Month / Year selector
   ================================================================ */
interface PeriodTabsProps {
  options?: string[];
  selected?: string;
  onChange?: (value: string) => void;
}

export const PeriodTabs: React.FC<PeriodTabsProps> = ({
  options = ['Week', 'Month', 'Year'],
  selected: controlledSelected,
  onChange,
}) => {
  const [internal, setInternal] = useState(options[0]);
  const selected = controlledSelected ?? internal;

  const handleClick = (val: string) => {
    setInternal(val);
    onChange?.(val);
  };

  return (
    <div className="period-tabs">
      {options.map((x) => (
        <button
          key={x}
          onClick={() => handleClick(x)}
          className={`period-tab ${selected === x ? 'active' : ''}`}
        >
          {x}
        </button>
      ))}
    </div>
  );
};

/* ================================================================
   SEARCH BAR — Search input with icon
   ================================================================ */
interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search',
  value,
  onChange,
  style,
}) => (
  <label className="search-input" style={style}>
    <Search size={16} />
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  </label>
);

/* ================================================================
   CALENDAR BUTTON
   ================================================================ */
interface CalendarButtonProps {
  onClick?: () => void;
}

export const CalendarButton: React.FC<CalendarButtonProps> = ({ onClick }) => (
  <button className="calendar-btn" onClick={onClick} title="Calendar">
    <Calendar size={20} />
  </button>
);

/* ================================================================
   PROFIT CHART — SVG area chart
   ================================================================ */
interface ProfitChartProps {
  totalProfit?: string;
}

export const ProfitChart: React.FC<ProfitChartProps> = ({ totalProfit = '$628.00' }) => (
  <section>
    <h2 className="chart-title">Total profit</h2>
    <div className="chart-legend" style={{ marginTop: -47, marginBottom: 27 }}>
      <span><i className="dot-up" />income</span>
      <span><i className="dot-down" />expense</span>
    </div>
    <div className="chart-area">
      <div className="chart-ylabels">
        <span>5m</span><span>1m</span><span>500k</span><span>200k</span><span>100k</span><span>50k</span>
      </div>
      <svg viewBox="0 0 760 290" preserveAspectRatio="none">
        <path d="M0 220 C75 130 105 115 170 145 S280 175 340 100 S445 120 515 185 S640 120 760 165" fill="none" stroke="#a8e7ee" strokeWidth="2"/>
        <path d="M0 150 C75 160 110 105 175 135 S285 180 350 95 S450 180 520 165 S650 225 760 115" fill="none" stroke="#64d3e7" strokeWidth="2.2"/>
        <path d="M0 125 C75 145 115 175 180 120 S285 105 350 225 S450 120 520 150 S650 105 760 130" fill="none" stroke="#d7e6ed" strokeWidth="2"/>
        <line x1="350" y1="30" x2="350" y2="275" stroke="#ddd"/>
        <circle cx="350" cy="95" r="4" fill="#202020"/>
        <text x="350" y="57" textAnchor="middle" fontSize="28" fill="#202020">{totalProfit}</text>
      </svg>
    </div>
    <div className="chart-months">
      {['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan'].map(m => (
        <span className={m === 'Oct' ? 'month-active' : ''} key={m}>{m}</span>
      ))}
    </div>
  </section>
);

/* ================================================================
   PROPERTY / OBJECT LIST ITEM
   ================================================================ */
interface ObjectItemProps {
  name: string;
  percent: string;
  dark?: boolean;
  thumbColor?: string;
  thumbImage?: string;
}

export const ObjectItem: React.FC<ObjectItemProps> = ({
  name,
  percent,
  dark = false,
  thumbColor,
  thumbImage,
}) => (
  <div className={`object-item ${dark ? 'dark' : ''}`}>
    <div className="object-thumb" style={thumbColor ? { background: thumbColor } : undefined}>
      {thumbImage && <img src={thumbImage} alt={name} />}
    </div>
    <div className="object-name">{name}</div>
    <div className="object-percent">
      <ArrowUpRight size={12} style={{ color: '#9be8ef' }} />
      {percent}
    </div>
  </div>
);

/* ================================================================
   PROPERTY LIST — Complete list with tabs
   ================================================================ */
interface PropertyListProps {
  items?: { name: string; percent: string; dark?: boolean; thumbColor?: string }[];
  tabs?: string[];
}

export const PropertyList: React.FC<PropertyListProps> = ({
  items = [
    { name: 'Windmills Loft', percent: '25%', dark: true, thumbColor: '#89e0ed' },
    { name: 'Seaview Villa', percent: '18%', thumbColor: '#d7c7ff' },
    { name: 'Family Villa', percent: '12%', thumbColor: '#8edfe9' },
  ],
  tabs = ['Objects', 'Realtors'],
}) => {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <section>
      <div className="object-tabs" style={{ marginBottom: 24 }}>
        {tabs.map((t) => (
          <button
            key={t}
            className={`object-tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
        <button
          className="btn-ghost btn-icon"
          style={{ marginLeft: 'auto', width: 32, height: 32 }}
        >
          <MoreVertical size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((item) => (
          <ObjectItem key={item.name} {...item} />
        ))}
      </div>
    </section>
  );
};

/* ================================================================
   DASHBOARD HEADER — Title, search bar, calendar button
   ================================================================ */
interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title = 'Monitor health of\nyour business',
  subtitle = 'Control and analyze your data in the easiest way',
  children,
}) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 28, alignItems: 'start' }}>
    <div>
      <h1 style={{ fontSize: 34, lineHeight: 1.08, letterSpacing: -1.1, fontWeight: 500, whiteSpace: 'pre-line' }}>
        {title}
      </h1>
      <p style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 12 }}>
        {subtitle}
      </p>
    </div>
    {children || (
      <>
        <SearchBar style={{ width: 190 }} />
        <CalendarButton />
      </>
    )}
  </div>
);

/* ================================================================
   EMPTY STATE — Placeholder for empty data
   ================================================================ */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="empty-state">
    {icon && <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.5 }}>{icon}</div>}
    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</h3>
    {description && <p>{description}</p>}
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);

/* ================================================================
   LOADING SPINNER
   ================================================================ */
export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 36,
          height: 36,
          border: '3px solid var(--border-default)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 12px',
        }}
      />
      <p style={{ fontSize: '0.9rem' }}>{message}</p>
    </div>
  </div>
);
