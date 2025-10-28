import React from "react";
import "./Loader.css";

const Loader = ({ size = 36, label = "Loading..." }) => {
  return (
    <div className="loader-root" role="status" aria-live="polite">
      <svg
        className="spinner"
        width={size}
        height={size}
        viewBox="0 0 50 50"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
      </svg>
      <span className="loader-label">{label}</span>
    </div>
  );
};

export default Loader;
