const link = document.createElement("link");
link.rel = "stylesheet";
link.href =
  "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css";
document.head.appendChild(link);
import React from "react";
import ReactDOM from "react-dom";
import "./index.css"; // ← esta línea es nueva
import App from "./App";

ReactDOM.render(<App />, document.getElementById("root"));
