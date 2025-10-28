import React, { useEffect, useState } from "react";
import { getPLCData, updatePLCValue } from "./api";

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const res = await getPLCData();
    setData(res.data);
    setLoading(false);
  };

  const handleEdit = async (tag) => {
    const newValue = prompt("Enter new value:");
    if (!newValue) return;
    await updatePLCValue(tag, newValue);
    fetchData();
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "30px" }}>
      <h2>PLC Live Dashboard</h2>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Tag</th>
            <th>Value</th>
            <th>Last Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.id}>
              <td>{d.tag}</td>
              <td>{d.value}</td>
              <td>{new Date(d.updated_at).toLocaleString()}</td>
              <td>
                <button onClick={() => handleEdit(d.tag)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
