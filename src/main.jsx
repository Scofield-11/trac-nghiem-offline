import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "bootswatch/dist/zephyr/bootstrap.min.css";
import "./index.css";
import App from "./App.jsx";

// Kích hoạt Service Worker ngay lập tức để lưu cache chạy Offline
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);