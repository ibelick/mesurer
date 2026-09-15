import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const App = lazy(() => import("./app").then(({ App: page }) => ({ default: page })));
const Bench = lazy(() => import("../bench/main").then(({ Bench: page }) => ({ default: page })));

const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const Page = pathname === "/bench" ? Bench : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  </React.StrictMode>,
);
