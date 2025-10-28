import React, { useEffect, useState } from "react";
import { getPLCData, updatePLCValue } from "../api";
import { toast } from "react-toastify";
import "./PlcTable.css";

const PlcTable = () => {
  const [data, setData] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");

  const fetchData = async () => {
    try {
      const res = await getPLCData();
      setData(res);
    } catch (err) {
      toast.error("Failed to fetch data");
    }
  };

  const handleEdit = (tag, value) => {
    setEditing(tag);
    setEditValue(value);
  };

  const handleSave = async (tag) => {
    try {
      await updatePLCValue(tag, editValue);
      toast.success("Value updated successfully");
      setEditing(null);
      fetchData();
    } catch (err) {
      toast.error("Update failed");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="table-container">
      <h2>PLC Live Dashboard</h2>
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
          {data.map((row) => (
            <tr key={row.id}>
              <td>{row.tag}</td>
              <td>
                {editing === row.tag ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                ) : (
                  row.value
                )}
              </td>
              <td>{new Date(row.updated_at).toLocaleString()}</td>
              <td>
                {editing === row.tag ? (
                  <button onClick={() => handleSave(row.tag)}>Save</button>
                ) : (
                  <button onClick={() => handleEdit(row.tag, row.value)}>
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PlcTable;
