import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./app";
import { Bench } from "../bench/main";

const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const Page = pathname === "/bench" ? Bench : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
