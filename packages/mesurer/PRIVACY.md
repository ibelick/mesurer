# Privacy Policy

Last updated: 30 September 2026

## Mesurer

Mesurer includes a browser tool, an npm package, a Chrome extension, and hosted platform features for reviewing deployed web projects.

## Local browser features

The browser tool and Chrome extension store settings, guides, measurements, comments, and page workspaces locally in your browser where possible. This local data is not sent to Mesurer servers by the extension's local features.

Mesurer does not use the extension to sell or transfer your browsing history or website content for advertising.

## Platform data

When you use hosted platform features, Mesurer may process:

- account details provided by your authentication provider, such as your name, email address, and profile image
- project, deployment, and website origin information
- comments, screenshots, review data, and content you choose to share
- subscription and billing status

This information is used to authenticate you, provide projects and reviews, share content at your direction, secure the service, and manage subscriptions.

## Authentication and payments

Mesurer may use GitHub or Google for sign-in. Those providers process information under their own privacy policies.

Payments may be handled by third-party payment providers. Mesurer does not intend to store full payment card details on its own systems.

## Permissions

### activeTab

Used when you explicitly activate the extension to run Mesurer on the current tab.

### host permissions

Mesurer requests access to HTTP and HTTPS pages so it can run on regular websites and restore the toolbar across reloads and in-site navigations. This access is not used to send page content off-device by the local extension features.

### scripting

Used to inject the extension script into the active page to render measurement overlays and guides. The script may be re-injected when a tab navigates so the toolbar can stay available.

### storage

Used to store Mesurer settings and page workspaces locally in Chrome. This includes comment threads and replies created through local features.

### clipboardWrite

Used when you choose to copy a selected screenshot or sampled color to the clipboard.

### tabCapture

Used only after you explicitly choose the video recording feature. It captures the active browser tab so Mesurer can record the region you select. The captured stream is processed locally in the browser and is not sent to Mesurer or any third party.

### offscreen

Used to create the offscreen document required by Chrome Manifest V3 to process tab recordings. The offscreen document crops and encodes the selected region locally after you start recording. It does not collect or transmit page content.

## Screenshot and recording capture

Captures are initiated by you and contain only the region you select. In the Chrome extension, screenshots are captured locally through Chrome's visible-tab capture API. In a React integration without the extension, Chrome may show its native tab-sharing prompt through `getDisplayMedia()`.

Screenshots and recordings are processed locally and are copied to the local clipboard, stored temporarily in local extension storage, or downloaded locally according to your actions. Mesurer does not upload or externally process these captures unless you explicitly share them through a hosted platform feature.

Video recordings are stored temporarily in the extension's local IndexedDB storage so they can be previewed, trimmed, and exported. Recordings remain on the device and are not uploaded. They can be removed through the recording editor or by clearing the browser's extension storage.

## Data sharing and retention

Mesurer shares hosted project and review content only as needed to provide a feature you request, such as a review link or project invitation. Anyone with access to a shared review link may be able to view the content included in that review.

Hosted data is retained while needed to provide the service, maintain account records, resolve disputes, and meet legal obligations. You may contact us to ask about your data or request deletion, subject to applicable legal and operational requirements.

## Remote code

The Chrome extension does not use remote code. JavaScript and WebAssembly executed by the extension are packaged with the extension bundle.

## Contact

For privacy questions or requests, contact [contact@interfaceoffice.com](mailto:contact@interfaceoffice.com).
