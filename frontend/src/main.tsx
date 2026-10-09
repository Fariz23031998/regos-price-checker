import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AdminPage } from "./admin";
import { App } from "./App";
import "./index.css";
import "./App.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing");

const isAdmin = window.location.pathname.replace(/\/+$/, "") === "/admin";

createRoot(root).render(
  <StrictMode>
    {isAdmin ? <AdminPage /> : <App />}
  </StrictMode>,
);
