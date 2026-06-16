import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

// Note: intentionally NOT wrapped in <React.StrictMode>. StrictMode double-mounts
// every component in dev, which double-spawns PTYs (Claude/terminal) and amplifies
// any effect-cleanup races. Re-enable temporarily if you want to hunt such bugs.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
