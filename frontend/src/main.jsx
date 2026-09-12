import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import { APP_NAME } from "./lib/branding";
import "./stores/theme";
import "./index.css";

// El <title> de index.html es solo el fallback estatico (un build sin
// VITE_APP_NAME no puede mostrar un placeholder sin resolver); el valor real
// sale de la misma constante que el resto de la UI.
document.title = APP_NAME;


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
