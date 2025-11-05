import React, { useEffect, useState } from "react";
import { getPLCData, updatePLCValue } from "../api";
import { toast } from "react-toastify";
import "./PlcTable.css";
import Loader from "./Loader";

const PlcTable = () => {
  const [data, setData] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingTag, setSavingTag] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getPLCData();
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error("Failed to fetch data");
    }
    finally {
      setLoading(false);
    }
  };

  const handleEdit = (tag, value) => {
    setEditing(tag);
    setEditValue(value);
  };

  const handleSave = async (tag) => {
    try {
      setSavingTag(tag);
      await updatePLCValue(tag, editValue);
      toast.success("Value updated successfully");
      setEditing(null);
      setEditValue("");
      await fetchData();
    } catch (err) {
      toast.error("Update failed");
    } finally {
      setSavingTag(null);
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setEditValue("");
  };

  // live "now" to update relative times in the table
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatRelative = (d) => {
    if (!d) return "-";
    const diff = Math.floor((now - d) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
    return d.toLocaleString();
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    const onRefresh = () => fetchData();
    window.addEventListener("dashboard-refresh", onRefresh);
    // listen for nav events and scroll into view when 'live' nav is clicked
    const onNav = (ev) => {
      if (!ev || !ev.detail) return;
      if (ev.detail.id === 'live') {
        const el = document.querySelector('.table-container');
        el && el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('dashboard-nav', onNav);

    return () => { clearInterval(interval); window.removeEventListener("dashboard-refresh", onRefresh); window.removeEventListener('dashboard-nav', onNav); };
  }, []);

  return (
    <div className="table-container">
      <h2>PLC Live Dashboard</h2>
      <div className="table-top">
        <div className="legend">
          <span className="dot" /> Live values from PLC
        </div>
        {loading ? (
          <div className="loader-block"><Loader size={20} label="Fetching latest data"/></div>
        ) : null}
      </div>
      <table>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Value</th>
            <th>Updated At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="data-row skeleton">
                <td className="tag-cell"><div className="skeleton-line short" /></td>
                <td className="value-cell"><div className="skeleton-line medium" /></td>
                <td className="time-cell"><div className="skeleton-line short" /></td>
                <td className="actions-cell"><div className="skeleton-line tiny" /></td>
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={4} className="empty">No PLC data available</td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row.id} className="data-row">
                <td className="tag-cell">
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span>{row.tag}</span>
                    {row.status ? <span className="status-badge">{row.status}</span> : null}
                  </div>
                </td>
                <td className="value-cell">
                  {editing === row.tag ? (
                    <input
                      className="edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                    />
                  ) : (
                    row.value
                  )}
                </td>
                <td className="time-cell" title={row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}>
                  {row.updated_at ? formatRelative(new Date(row.updated_at)) : "-"}
                </td>
                <td className="actions-cell">
                  {editing === row.tag ? (
                    <>
                      <button
                        className="btn btn-save"
                        onClick={() => handleSave(row.tag)}
                        disabled={savingTag === row.tag}
                      >
                        {savingTag === row.tag ? "Saving..." : "Save"}
                      </button>
                      <button className="btn btn-cancel" onClick={handleCancel}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn btn-edit" onClick={() => handleEdit(row.tag, row.value)}>Edit</button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PlcTable;
