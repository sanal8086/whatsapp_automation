import React, {useState} from "react";
import "./dashboard.css";

export const Sidebar = () => (
  <aside className="sidebar">
    <div className="brand">◔</div>
    <div className="side-icon active">♧</div>
    <div className="side-icon">◔</div>
    <div className="side-icon">⌾</div>
    <div className="side-spacer" />
    <div className="side-icon">⚙</div>
  </aside>
);

export const Header = () => (
  <div className="top">
    <div>
      <h1 className="title">Monitor health of<br />your business</h1>
      <p className="subtitle">Control and analyze your data in the easiest way</p>
    </div>
    <label className="search"><span>⌕</span><input placeholder="Search" /></label>
    <button className="calendar-btn">▣</button>
  </div>
);

export const PeriodTabs = () => {
  const [selected, setSelected] = useState("Week");
  return <div className="periods">
    {["Week","Month","Year"].map(x => <button key={x} onClick={() => setSelected(x)} className={`period ${selected===x?"selected":""}`}>{x}</button>)}
  </div>;
};

const StatCard = ({label, value, delta, tone, icon}) => (
  <article className={`stat-card ${tone||""}`}>
    <div className="stat-label">{label}<span>{icon}</span></div>
    <div className="stat-number">{value}</div>
    <div className="stat-delta">{delta}</div>
  </article>
);

export const Stats = () => (
  <div className="stats">
    <StatCard label="Views" value="31" delta="+3 last day" tone="views" icon="⌂" />
    <StatCard label="Clients" value="63" delta="+1 last day" tone="clients" icon="♙" />
    <StatCard label="Purchases" value="10" delta="+1 last day" icon="✓" />
  </div>
);

export const ProfitChart = () => (
  <section>
    <h2 className="chart-title">Total profit</h2>
    <div className="legend"><span><i className="dot-up" />income</span><span><i className="dot-down" />expense</span></div>
    <div className="chart">
      <div className="ylabels"><span>5m</span><span>1m</span><span>500k</span><span>200k</span><span>100k</span><span>50k</span></div>
      <svg viewBox="0 0 760 290" preserveAspectRatio="none">
        <path d="M0 220 C75 130 105 115 170 145 S280 175 340 100 S445 120 515 185 S640 120 760 165" fill="none" stroke="#a8e7ee" strokeWidth="2"/>
        <path d="M0 150 C75 160 110 105 175 135 S285 180 350 95 S450 180 520 165 S650 225 760 115" fill="none" stroke="#64d3e7" strokeWidth="2.2"/>
        <path d="M0 125 C75 145 115 175 180 120 S285 105 350 225 S450 120 520 150 S650 105 760 130" fill="none" stroke="#d7e6ed" strokeWidth="2"/>
        <line x1="350" y1="30" x2="350" y2="275" stroke="#ddd"/>
        <circle cx="350" cy="95" r="4" fill="#202020"/>
        <text x="350" y="57" textAnchor="middle" fontSize="28" fill="#202020">$628.00</text>
      </svg>
    </div>
    <div className="months">{["Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan"].map(m => <span className={m==="Oct"?"month-active":""} key={m}>{m}</span>)}</div>
  </section>
);

const properties = [
  ["Windmills Loft","25%","dark"],["Seaview Villa","18%",""],["Family Villa","12%",""]
];

export const PropertyList = () => (
  <section className="objects">
    <div className="object-tabs"><span className="object-tab">Objects</span><span>Realtors</span><span className="more">⋮</span></div>
    <div className="object-list">
      {properties.map(([name, percent, tone]) => (
        <div className={`object ${tone}`} key={name}>
          <div className="thumb" />
          <div className="object-name">{name}</div>
          <div className="object-percent">{percent}</div>
        </div>
      ))}
    </div>
  </section>
);

export function Dashboard() {
  return <div className="dashboard">
    <Sidebar />
    <main className="content">
      <Header />
      <PeriodTabs />
      <Stats />
      <div className="chart-row"><ProfitChart /><PropertyList /></div>
    </main>
  </div>;
}

/* ComponentGallery keeps every reusable component visible on one page. */
export default function ComponentGallery() {
  return <div className="gallery">
    <h1>Reusable Dashboard Components</h1>
    <p>Each component is rendered independently, followed by the complete dashboard.</p>
    <section><h2>Sidebar</h2><div className="preview"><Sidebar /></div></section>
    <section><h2>Header</h2><div className="preview"><Header /></div></section>
    <section><h2>Period Tabs</h2><div className="preview"><PeriodTabs /></div></section>
    <section><h2>Statistic Cards</h2><div className="preview"><Stats /></div></section>
    <section><h2>Profit Chart</h2><div className="preview"><ProfitChart /></div></section>
    <section><h2>Property List</h2><div className="preview"><PropertyList /></div></section>
    <section><h2>Complete Dashboard</h2><div className="preview"><Dashboard /></div></section>
  </div>;
}
