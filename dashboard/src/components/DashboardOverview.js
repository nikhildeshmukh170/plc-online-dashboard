import React, { useEffect, useState, useRef } from "react";
import { Bar, Pie } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { getPLCData } from "../api";
import "./DashboardOverview.css";
import Loader from "./Loader";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const DashboardOverview = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getPLCData();
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 7000);

    const onRefresh = () => fetchData();
    window.addEventListener("dashboard-refresh", onRefresh);

    return () => { clearInterval(id); window.removeEventListener("dashboard-refresh", onRefresh); };
  }, []);

  // respond to nav events: scroll into view when overview nav clicked
  useEffect(() => {
    const onNav = (ev) => {
      if (!ev || !ev.detail) return;
      if (ev.detail.id === 'overview') {
        const el = document.querySelector('.overview-container');
        el && el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('dashboard-nav', onNav);
    return () => window.removeEventListener('dashboard-nav', onNav);
  }, []);

  // prepare chart data from current values — convert numeric strings where possible
  const labels = data.map((r) => r.tag);
  const values = data.map((r) => {
    const n = Number(r.value);
    return Number.isFinite(n) ? n : 0;
  });

  const barData = {
    labels,
    datasets: [
      {
        label: "Value",
        data: values,
        backgroundColor: "rgba(37,99,235,0.85)",
        borderRadius: 6,
      },
    ],
  };

  const pieData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: ["#10b981", "#60a5fa", "#f59e0b", "#ef4444", "#8b5cf6"],
      },
    ],
  };

  const totalTags = data.length;
  const lastUpdated = data.reduce((acc, r) => {
    const t = r.updated_at ? new Date(r.updated_at) : null;
    if (!t) return acc;
    return !acc || t > acc ? t : acc;
  }, null);

  // live "now" to make relative times update in real-time
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 90000);
    return () => clearInterval(id);
  }, []);

  const formatRelative = (d) => {
    if (!d) return "—";
    const diff = Math.floor((now - d) / 1000); // seconds
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
    return d.toLocaleString();
  };

  // Small CountUp component (no external deps). Animates integer values.
  const CountUp = ({ end = 0, duration = 800 }) => {
    const [value, setValue] = useState(0);
    const raf = useRef(null);
    const start = useRef(null);

    useEffect(() => {
      cancelAnimationFrame(raf.current);
      start.current = null;
      const from = value;
      const to = Number(end) || 0;
      const step = (timestamp) => {
        if (!start.current) start.current = timestamp;
        const progress = Math.min((timestamp - start.current) / duration, 1);
        const cur = Math.floor(from + (to - from) * progress);
        setValue(cur);
        if (progress < 1) {
          raf.current = requestAnimationFrame(step);
        }
      };
      raf.current = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf.current);
    }, [end]);

    return <span className="countup">{value}</span>;
  };

  return (
    <div className="overview-container">
      <div className="overview-cards">
        <div className="card">
          <div className="card-title">Tags</div>
          <div className="card-value"><CountUp end={totalTags} /></div>
        </div>
        <div className="card">
          <div className="card-title">Last updated</div>
          <div className="card-value">{lastUpdated ? formatRelative(lastUpdated) : "—"}</div>
        </div>
        <div className="card">
          <div className="card-title">Numeric values</div>
          <div className="card-value"><CountUp end={values.filter((v) => v !== 0).length} /></div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart card-chart">
          <h4>Values per Tag</h4>
          {loading ? (
            <div className="chart-center"><Loader size={36} label="Loading chart"/></div>
          ) : (
            <Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
          )}
        </div>

        <div className="chart card-chart small">
          <h4>Distribution</h4>
          {loading ? (
            <div className="chart-center"><Loader size={28} label="Loading"/></div>
          ) : (
            <Pie data={pieData} options={{ maintainAspectRatio: false }} />
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
