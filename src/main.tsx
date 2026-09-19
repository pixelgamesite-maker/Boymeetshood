import { createRoot } from "react-dom/client";
import App from "./App";

// Order matters: index.css sets up Tailwind and the shadcn tokens, hood.css
// layers the BoyMeetsHood brand tokens on top. Without the second import,
// every var(--lime) / var(--ink) below resolves to nothing and branded
// backgrounds render transparent.
import "./index.css";
import "@/styles/hood.css";

createRoot(document.getElementById("root")!).render(<App />);
