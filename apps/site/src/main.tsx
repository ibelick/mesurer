import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./app";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

if (pathname === "/bench") {
  const Bench = lazy(() => import("../bench/main").then(({ Bench: page }) => ({ default: page })));
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Suspense fallback={null}>
        <Bench />
      </Suspense>
    </React.StrictMode>,
  );
} else {
  const app = (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  if (root.hasChildNodes()) {
    ReactDOM.hydrateRoot(root, app);
  } else {
    ReactDOM.createRoot(root).render(app);
  }
}
