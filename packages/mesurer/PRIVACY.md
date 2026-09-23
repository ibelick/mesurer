# Privacy Policy

## Mesurer

Mesurer is a lightweight tool to measure distances, check alignment, and display visual guides directly on web pages in the browser.

## Data Collection

Mesurer does not collect, store, or transmit personal data.

Mesurer does not collect:

- personally identifiable information
- authentication credentials
- financial or health information
- web history
- user activity analytics
- website content for external processing

## Permissions

### activeTab

Used only when the user explicitly activates the extension, to run Mesurer on the current tab.

### optional host access

After you turn Mesurer on, Chrome may ask for access to that site so the toolbar can stay on
through reloads and in-site navigations. This is not used to read or send page content off-device.

### scripting

Used to inject the extension script into the active page to render measurement overlays and guides.
After you turn Mesurer on for a tab, the same script may be re-injected when that tab navigates so
the toolbar can stay available.

### storage

Used to store Mesurer settings and page workspaces locally in Chrome. This data stays in the
browser and is not sent to Mesurer servers. This includes comment threads and their replies.

### clipboardWrite

Used when the user chooses to copy a selected screenshot or sampled color to the clipboard.

## Screenshot Capture

Screenshot captures are initiated by the user and contain only the selected region of the
currently visible tab. In the Chrome extension, capture is performed locally through Chrome's
visible-tab capture API. In a React integration without the extension, Chrome may show its native
tab-sharing prompt through `getDisplayMedia()`.

Screenshots are copied to the local clipboard or downloaded locally according to the user's
settings. Mesurer does not upload or externally process screenshots.

## Remote Code

Mesurer does not use remote code.

All JavaScript/Wasm executed by the extension is packaged with the extension bundle.

## Data Sharing

Mesurer does not sell or transfer user data to third parties.

## Contact

For questions, open an issue on GitHub:

https://github.com/ibelick/mesurer/issues
