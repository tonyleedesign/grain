# Send to Grain Firefox Source Submission

This directory contains the source used to build the Firefox version of the `Send to Grain` browser extension.

## Purpose
The extension lets a signed-in Grain user:
- send the current page to Grain
- send a right-clicked link to Grain
- send a right-clicked image to Grain

The extension sends captures to the user’s Grain backend, where they are queued and later applied to the user’s private Grain canvas.

## Build Requirements
- Node.js 20+
- npm 10+

Tested from a local development environment on Windows.

## Install Dependencies
From the repository root:

```bash
npm install
```

This installs the root dependencies used by the extension build scripts, including `sharp` and `jszip`.

## Source Layout
- `manifest.json`
  - Chromium manifest
- `manifest.firefox.json`
  - Firefox manifest template
- `background.firefox.html`
  - Firefox background page entry
- `popup.html`
  - Static popup markup
- `src/background/`
  - background/context menu logic
- `src/popup/`
  - popup behavior
- `src/lib/`
  - shared extension helpers
- `scripts/copy-static.mjs`
  - copies static assets and generates icon PNGs from the Grain SVG logo
- `scripts/build-firefox.mjs`
  - creates the Firefox build output folder
- `scripts/package-firefox.mjs`
  - packages the Firefox build output into an `.xpi`

## Build Steps
To build the Firefox version exactly as submitted:

```bash
npm --prefix extension run package:firefox
```

This performs:
1. TypeScript compilation for the extension
2. static asset copying
3. icon generation from the Grain SVG logo
4. creation of the Firefox build folder
5. packaging into:
   - `extension/release/send-to-grain-firefox.xpi`

## Output Files
- Firefox build folder:
  - `extension/firefox/`
- packaged Firefox add-on:
  - `extension/release/send-to-grain-firefox.xpi`

## Notes For Reviewers
- The popup UI is static HTML in `popup.html` and does not use runtime `innerHTML` injection.
- The extension uses TypeScript source in `src/`, compiled to JavaScript during the build.
- The extension uses the browser toolbar popup, context menus, tabs, storage, and scripting APIs.
- Firefox uses a background page (`background.firefox.html`) that loads the compiled background module.
