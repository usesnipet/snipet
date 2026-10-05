import { createRoot } from "react-dom/client";

import css from "./index.css?inline";
import { Widget } from "./widget";

const HOST_TAG = "snipet-widget";

// Guard against the script being included twice on the same page.
if (!document.querySelector(HOST_TAG)) {
  // A custom tag (not a <div>) so the host page's element selectors don't match it;
  // inline `all: initial` beats its universal (`*`) rules.
  const host = document.createElement(HOST_TAG);
  host.style.all = "initial";
  document.body.appendChild(host);

  // Shadow DOM isolates the widget's styles from the host page, in both directions.
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const container = document.createElement("div");
  shadow.append(style, container);

  createRoot(container).render(<Widget />);
}
