import React from "react";
import "./Header.css";

const Header = ({ onRefresh }) => {
  const [theme, setTheme] = React.useState(() => {
    try {
      return localStorage.getItem("plc_theme") || "light";
    } catch (e) {
      return "light";
    }
  });

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("plc_theme", theme); } catch (e) {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <header className="app-header">
      <div className="brand">
        <div className="logo">PLC</div>
        <div className="title-wrap">
          <div className="title">PLC Online Dashboard</div>
          <div className="subtitle">Real-time telemetry & control</div>
        </div>
      </div>
      <div className="header-actions">
        <button className="mobile-nav" onClick={() => window.dispatchEvent(new Event('toggle-sidenav'))} aria-label="Toggle navigation">☰</button>
        <button className="refresh" onClick={onRefresh}>Refresh</button>
        <button className="theme-toggle" onClick={toggleTheme} aria-pressed={theme === "dark"}>
          {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>
    </header>
  );
};

export default Header;
