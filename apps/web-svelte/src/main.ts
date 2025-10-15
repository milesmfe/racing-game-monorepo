import { mount } from "svelte";
import App from "./App.svelte";
import TrackDesigner from "./TrackDesigner.svelte";
import "@lib/styles/global.css";
import "@lib/styles/track-designer.css";

const app = mount(App, {
  target: document.getElementById("app")!,
});

const designer = mount(TrackDesigner, {
  target: document.getElementById("designer")!,
});

export { designer };

export default app;
