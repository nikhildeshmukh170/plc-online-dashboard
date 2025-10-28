import React from "react";
import PlcTable from "./components/PlcTable";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles.css";

function App() {
  return (
    <div className="App">
      <PlcTable />
      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
}

export default App;
