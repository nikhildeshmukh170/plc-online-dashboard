import React, { useRef } from "react";
import PlcTable from "./components/PlcTable";
import DashboardOverview from "./components/DashboardOverview";
import Header from "./components/Header";
import SideNav from "./components/SideNav";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles.css";

function App() {
  const refreshRef = useRef(null);

  const onRefresh = () => {
    // dispatch a custom event the overview/table can listen to if needed
    const ev = new Event("dashboard-refresh");
    window.dispatchEvent(ev);
  };

  const handleNavigate = (id) => {
    // Small navigation hook: dispatch events for components to respond to
    const ev = new CustomEvent('dashboard-nav', { detail: { id } });
    window.dispatchEvent(ev);
  };

  return (
    <div className="App app-grid">
      <Header onRefresh={onRefresh} />

      <div className="app-body">
        <SideNav onNavigate={handleNavigate} />

        <main className="app-main">
          <DashboardOverview />
          <PlcTable />
        </main>
      </div>

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
}

export default App;
