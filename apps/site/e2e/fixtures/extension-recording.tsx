import { createRoot } from "react-dom/client";
import { Mesurer } from "mesurer";

// Stands in for the browser extension's recorder, which captures the tab from its background
// page and plays the result back in an iframe served by the extension.
const extensionRecording = {
  prepare: () => Promise.resolve(),
  start: () => Promise.resolve(),
  stop: () => Promise.resolve({ id: "fixture-recording", duration: 2 }),
  abort: () => {},
};

createRoot(document.getElementById("root")!).render(
  <Mesurer
    extensionRecording={extensionRecording}
    extensionRecordingPlayer={new URL("/e2e/fixtures/recording-player-stub.html", location.href).toString()}
  />,
);
