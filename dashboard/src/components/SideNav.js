import React, { useState, useEffect } from 'react';
import './SideNav.css';

export default function SideNav({ onNavigate }) {
  // load collapsed state from localStorage so user preference persists
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('plc_sidenav_collapsed') === '1'; } catch (e) { return false; }
  });
  const [active, setActive] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = [
    { id: 'overview', label: 'Overview', icon: '▤' },
    { id: 'live', label: 'Live Values', icon: '◉' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
  ];

  useEffect(() => {
    try { localStorage.setItem('plc_sidenav_collapsed', collapsed ? '1' : '0'); } catch (e) {}
  }, [collapsed]);

  useEffect(() => {
    const onToggle = () => setMobileOpen((s) => !s);
    window.addEventListener('toggle-sidenav', onToggle);
    const onNavEvent = (ev) => {
      if (ev && ev.detail && ev.detail.id) setActive(ev.detail.id);
    };
    window.addEventListener('dashboard-nav', onNavEvent);
    return () => { window.removeEventListener('toggle-sidenav', onToggle); window.removeEventListener('dashboard-nav', onNavEvent); };
  }, []);

  const handleClick = (id) => {
    setActive(id);
    setMobileOpen(false);
    onNavigate && onNavigate(id);
  };

  return (
    <>
      <aside role="navigation" aria-label="Main navigation" aria-expanded={!collapsed} className={`sidenav ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidenav-top">
        <div className="brand">
          <img src="/logo.svg" alt="PLC Logo" className="brand-logo" />
          {!collapsed && <span>PLC Dashboard</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-pressed={collapsed}
            className="collapse-btn"
            onClick={() => setCollapsed((s) => !s)}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>
      </div>

      <nav className="sidenav-nav">
        {items.map((it) => (
          <button
            key={it.id}
            className={`sidenav-item ${active === it.id ? 'active' : ''}`}
            onClick={() => handleClick(it.id)}
          >
            <span className="sidenav-icon">{it.icon}</span>
            <span className="sidenav-label">{it.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidenav-footer text-muted">v1.0 • Local</div>
      </aside>
      {/* overlay to close mobile nav when open */}
      {mobileOpen && <div className="sidenav-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
    </>
  );
}
